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

  // Prepare project data (matching main ingestion schema)
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
    // Note: discovered_at doesn't exist in the table, removed it
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

  // PARALLEL TRIGGERS: Execute all analysis triggers simultaneously
  await log('parallel_triggers_start', {
    message: 'Starting parallel analysis triggers...'
  });

  const parallelTriggers = [];

  // 1. Website Analyzer Trigger
  if (body.website_url && body.website_url !== 'pending') {
    await log('website_analyzer_prepare', {
      message: 'Preparing website analyzer trigger...',
      url: body.website_url
    });

    parallelTriggers.push(
      (async () => {
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
            await log('website_analyzer_success', {
              message: 'Website analyzer triggered successfully',
              status: websiteResponse.status
            });
            return { success: true, type: 'website-analyzer' };
          } else {
            await log('website_analyzer_error', {
              message: 'Website analyzer returned error',
              status: websiteResponse.status
            });
            return { success: false, type: 'website-analyzer', status: websiteResponse.status };
          }
        } catch (error) {
          await log('website_analyzer_error', {
            message: 'Failed to trigger website analyzer',
            error: error.message
          });
          return { success: false, type: 'website-analyzer', error: error.message };
        }
      })()
    );
  }

  // 2. Whitepaper Processing - Two paths
  if (body.whitepaper_content && body.whitepaper_content.trim()) {
    // PATH A: Content provided - trigger analyzer directly
    await log('whitepaper_analyzer_prepare', {
      message: 'Preparing whitepaper analyzer trigger (content provided)...',
      contentLength: projectData.whitepaper_content.length
    });

    parallelTriggers.push(
      (async () => {
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
            await log('whitepaper_analyzer_success', {
              message: 'Whitepaper analyzer triggered successfully',
              status: analysisResponse.status
            });
            return { success: true, type: 'whitepaper-analyzer' };
          } else {
            const errorText = await analysisResponse.text();
            await log('whitepaper_analyzer_error', {
              message: 'Whitepaper analyzer returned error',
              status: analysisResponse.status,
              error: errorText.substring(0, 500)
            });
            return { success: false, type: 'whitepaper-analyzer', error: errorText };
          }
        } catch (error) {
          await log('whitepaper_analyzer_error', {
            message: 'Failed to trigger whitepaper analyzer',
            error: error.message
          });
          return { success: false, type: 'whitepaper-analyzer', error: error.message };
        }
      })()
    );

  } else if (body.whitepaper_url && body.whitepaper_url !== 'MANUALLY_PROVIDED') {
    // PATH B: URL provided - trigger fetcher which will then trigger analyzer
    await log('whitepaper_fetcher_prepare', {
      message: 'Preparing whitepaper fetcher trigger (URL provided)...',
      url: body.whitepaper_url
    });

    parallelTriggers.push(
      (async () => {
        try {
          const fetcherUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/whitepaper-fetcher`;
          const fetchResponse = await fetch(fetcherUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              projectId: projectId,
              symbol: upsertData.symbol,
              whitepaperUrl: body.whitepaper_url
            })
          });

          if (fetchResponse.ok) {
            const result = await fetchResponse.json();
            await log('whitepaper_fetcher_success', {
              message: 'Whitepaper fetcher triggered successfully',
              contentLength: result.contentLength,
              analysisTriggered: result.analysisTriggered
            });
            return { success: true, type: 'whitepaper-fetcher', contentLength: result.contentLength };
          } else {
            const errorText = await fetchResponse.text();
            await log('whitepaper_fetcher_error', {
              message: 'Whitepaper fetcher returned error',
              status: fetchResponse.status,
              error: errorText.substring(0, 500)
            });
            return { success: false, type: 'whitepaper-fetcher', error: errorText };
          }
        } catch (error) {
          await log('whitepaper_fetcher_error', {
            message: 'Failed to trigger whitepaper fetcher',
            error: error.message
          });
          return { success: false, type: 'whitepaper-fetcher', error: error.message };
        }
      })()
    );
  } else {
    await log('whitepaper_skip', {
      message: 'No whitepaper processing - no content or URL provided'
    });
  }

  // Execute all triggers in parallel
  if (parallelTriggers.length > 0) {
    await log('parallel_execution', {
      message: `Executing ${parallelTriggers.length} triggers in parallel...`
    });

    const startTime = Date.now();
    const results = await Promise.allSettled(parallelTriggers);
    const elapsed = Date.now() - startTime;

    await log('parallel_complete', {
      message: `All triggers completed in ${elapsed}ms`,
      count: parallelTriggers.length,
      duration: elapsed
    });

    // Log individual results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        const val = result.value as any;
        await log('trigger_result', {
          index: i + 1,
          type: val.type,
          success: val.success !== false,
          error: val.error || null
        });
      } else if (result.status === 'rejected') {
        await log('trigger_rejected', {
          index: i + 1,
          reason: result.reason
        });
      }
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