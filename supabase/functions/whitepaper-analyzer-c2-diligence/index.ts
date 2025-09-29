import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
};

async function processWithSSE(
  symbol: string,
  sendEvent: (event: string, data: any) => Promise<void>
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  await sendEvent('starting', {
    message: `Starting C2 due diligence analysis for ${symbol}...`
  });

  // Get project data
  const { data: project, error: projectError } = await supabase
    .from('crypto_projects_rated')
    .select('id, symbol, whitepaper_content, whitepaper_url')
    .eq('symbol', symbol)
    .single();

  if (projectError || !project || !project.whitepaper_content) {
    throw new Error(`No whitepaper content found for ${symbol}`);
  }

  await sendEvent('content_loaded', {
    message: `Whitepaper content loaded: ${project.whitepaper_content.length} characters`,
    contentLength: project.whitepaper_content.length
  });

  let content = project.whitepaper_content;
  const maxLength = 200000;
  if (content.length > maxLength) {
    await sendEvent('truncating', {
      message: `Truncating whitepaper from ${content.length} to ${maxLength} characters`,
      originalLength: content.length,
      truncatedLength: maxLength
    });
    content = content.substring(0, maxLength);
  }

  await sendEvent('ai_analyzing', {
    message: 'C2: Conducting due diligence analysis of whitepaper...'
  });

  const systemPrompt = 'You are an experienced investor conducting due diligence on a crypto project. Analyze what this whitepaper reveals about execution readiness, team capabilities, and true motivations beyond the marketing claims.';

  const userPrompt = `Analyze what this whitepaper reveals about the team's background, true motivations, and execution readiness. Include what success would require given these observations.

Conduct due diligence analysis focusing on:

**Team Background & Capabilities:**
- What does the writing style and technical depth reveal about their expertise?
- What gaps in knowledge or experience are evident?
- Do they demonstrate understanding of the challenges they'll face?
- What evidence suggests they've built similar systems before?

**True Motivations & Incentives:**
- What are they really optimizing for beyond stated goals?
- What does their approach to tokenomics/economics reveal about priorities?
- Are they solving a problem they personally experience?
- What suggests this is more than a quick cash grab?

**Execution Readiness:**
- How realistic are their timelines and milestones?
- What critical dependencies or risks do they acknowledge vs ignore?
- Do they have concrete plans or just high-level concepts?
- What suggests they understand the operational complexity?

**Requirements for Success:**
- What specific capabilities would the team need to develop?
- What partnerships, resources, or market conditions are required?
- What are the most likely failure modes given their approach?
- What would need to change for this to actually work?

**Investment Perspective:**
- If you were considering funding this, what would concern you most?
- What would you need to see before believing in their execution ability?
- How does this compare to other projects in the space?

Respond in unstructured text - write as if briefing a potential investor on what you've discovered through your analysis.

Whitepaper content:
${content}`;

  const apiKey = Deno.env.get('MOONSHOT_API_KEY');
  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY not configured');
  }

  const aiStartTime = Date.now();
  const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'moonshot-v1-128k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 4000
    }),
    signal: AbortSignal.timeout(300000)
  });
  const aiEndTime = Date.now();

  if (!aiResponse.ok) {
    throw new Error(`AI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const analysisText = aiData.choices[0].message.content;

  await sendEvent('ai_complete', {
    message: `C2 due diligence analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
    duration_ms: aiEndTime - aiStartTime
  });

  await sendEvent('saving', {
    message: 'Saving C2 due diligence analysis...'
  });

  // Save to experiments table with unstructured text
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'c2-diligence',
      analysis_text: analysisText,
      metadata: {
        approach: 'Due diligence - investor perspective analysis',
        model: 'moonshot-v1-128k',
        track: 'C',
        description: 'Analyzes team capabilities, motivations, execution readiness from investor due diligence perspective'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save C2 results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'c2-diligence',
    symbol,
    analysis_text: analysisText
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const acceptHeader = req.headers.get('accept') || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

    const { symbol } = await req.json();

    if (!symbol) {
      throw new Error('Symbol is required');
    }

    if (wantsSSE) {
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const sendEvent = async (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(message));
      };

      (async () => {
        try {
          const result = await processWithSSE(symbol, sendEvent);
          await sendEvent('complete', {
            message: 'C2 due diligence analysis complete',
            result
          });
        } catch (error) {
          await sendEvent('error', {
            message: error.message || 'An error occurred',
            details: error.toString()
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
          'Connection': 'keep-alive',
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Non-SSE mode not implemented. Please use SSE by setting Accept: text/event-stream header.'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});