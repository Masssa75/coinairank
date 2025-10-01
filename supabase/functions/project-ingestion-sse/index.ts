import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
};

// Keep all the existing interfaces and functions here
// ... (will be copied from original)

// Import the actual ingestion logic from the main function
async function processIngestion(
  body: any,
  sendEvent?: (event: string, data: any) => Promise<void>
) {
  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  // Send events if SSE is enabled
  const log = async (event: string, data: any) => {
    console.log(`[${event}]`, data);
    if (sendEvent) {
      await sendEvent(event, data);
    }
  };

  await log('validation', {
    message: 'Validating input...',
    hasWhitepaperContent: !!body.whitepaper_content,
    whitepaperContentLength: body.whitepaper_content?.length || 0
  });

  // Validate required fields
  if (!body.contract_address || !body.network || !body.website_url || !body.source) {
    throw new Error('Missing required fields: contract_address, network, website_url, source');
  }

  await log('processing', {
    message: `Processing ${body.symbol || body.contract_address}...`,
    network: body.network,
    website: body.website_url
  });

  // Prepare project data
  const projectData: any = {
    contract_address: body.contract_address.toLowerCase(),
    network: body.network,
    website_url: body.website_url,
    source: body.source,
    symbol: body.symbol || '',
    name: body.name || '',
    whitepaper_url: body.whitepaper_url || null,
    twitter_url: body.twitter_url || null,
    telegram_url: body.telegram_url || null,
    discord_url: body.discord_url || null,
    medium_url: body.medium_url || null,
    youtube_url: body.youtube_url || null,
    github_url: body.github_url || null,
    reddit_url: body.reddit_url || null,
    discovered_at: new Date().toISOString(),
    website_stage1_analyzed_at: null,
    website_stage1_analysis: null
  };

  // Handle whitepaper content if provided
  if (body.whitepaper_content && body.whitepaper_content.trim()) {
    const content = body.whitepaper_content.trim().substring(0, 240000);
    projectData.whitepaper_content = content;
    projectData.whitepaper_extraction_status = 'extracted';

    await log('whitepaper_content', {
      message: 'Whitepaper content provided',
      contentLength: content.length,
      status: 'extracted'
    });
  }

  await log('storing', {
    message: 'Storing project data...',
    whitepaper_content_provided: !!projectData.whitepaper_content
  });

  // Insert or update the project
  const { data: upsertData, error: upsertError } = await supabase
    .from('crypto_projects_rated')
    .upsert(projectData, {
      onConflict: 'contract_address,network',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (upsertError) {
    throw new Error(`Failed to store project: ${upsertError.message}`);
  }

  const projectId = upsertData.id;

  await log('stored', {
    message: 'Project stored successfully',
    projectId: projectId,
    symbol: upsertData.symbol
  });

  // Trigger website analyzer
  await log('website_analyzer_trigger', {
    message: 'Triggering website analyzer...'
  });

  try {
    const websiteAnalyzerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/website-analyzer`;
    const websiteResponse = await fetch(websiteAnalyzerUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId: projectId,
        websiteUrl: body.website_url,
        symbol: upsertData.symbol,
        source: body.source
      })
    });

    if (websiteResponse.ok) {
      await log('website_analyzer_triggered', {
        message: 'Website analyzer triggered successfully',
        status: websiteResponse.status
      });
    } else {
      await log('website_analyzer_error', {
        message: 'Website analyzer returned error',
        status: websiteResponse.status
      });
    }
  } catch (error) {
    await log('website_analyzer_error', {
      message: 'Failed to trigger website analyzer',
      error: error.message
    });
  }

  // If whitepaper content was provided, trigger analyzer directly
  if (body.whitepaper_content && body.whitepaper_content.trim()) {
    await log('whitepaper_analyzer_trigger', {
      message: 'Triggering whitepaper analyzer for manually provided content...',
      contentLength: projectData.whitepaper_content.length
    });

    try {
      const analyzerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whitepaper-analyzer-v4-sse`;
      const analysisResponse = await fetch(analyzerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId,
          symbol: upsertData.symbol
        })
      });

      if (analysisResponse.ok) {
        await log('whitepaper_analyzer_triggered', {
          message: 'Whitepaper analyzer triggered successfully',
          status: analysisResponse.status
        });
      } else {
        const errorText = await analysisResponse.text();
        await log('whitepaper_analyzer_error', {
          message: 'Whitepaper analyzer returned error',
          status: analysisResponse.status,
          error: errorText
        });
      }
    } catch (error) {
      await log('whitepaper_analyzer_error', {
        message: 'Failed to trigger whitepaper analyzer',
        error: error.message
      });
    }
  }

  await log('complete', {
    message: 'Project ingestion complete!',
    projectId: projectId,
    symbol: upsertData.symbol
  });

  return {
    success: true,
    projectId: projectId,
    symbol: upsertData.symbol,
    message: 'Project ingested successfully'
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if client wants SSE
  const acceptHeader = req.headers.get('accept');
  const wantsSSE = acceptHeader?.includes('text/event-stream');

  // Parse the request body first
  const body = await req.json();

  if (wantsSSE) {
    // SSE Response
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Helper to send SSE events
    const sendEvent = async (event: string, data: any) => {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // Process in background
    (async () => {
      try {
        await sendEvent('start', { message: 'Starting project ingestion...' });

        // Run the actual ingestion
        const result = await processIngestion(body, sendEvent);

        await sendEvent('success', result);

      } catch (error) {
        await sendEvent('error', {
          error: error.message
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

  } else {
    // Normal JSON response
    try {
      const result = await processIngestion(body);
      return new Response(
        JSON.stringify(result),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
  }
});