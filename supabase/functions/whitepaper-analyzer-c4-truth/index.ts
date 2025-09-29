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
    message: `Starting C4 simple truth analysis for ${symbol}...`
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
    message: 'C4: Conducting simple truth analysis of whitepaper...'
  });

  const systemPrompt = 'You are direct and insightful, focused on cutting through marketing speak to reveal what this document actually tells us about the people behind it and their real chances of success.';

  const userPrompt = `Tell me what this whitepaper reveals about: 1. Who wrote this and their background, 2. What problem they're actually solving (vs what they claim), 3. What would need to happen for this to succeed. Focus on what the document reveals through its style, focus, and omissions rather than its explicit claims.

Cut through the marketing and tell me the simple truth about:

**Who wrote this and their background:**
- What can you tell about these people from how they write and think?
- What's their actual level of expertise in the areas they're tackling?
- Are they technical people trying to do business, business people trying to do tech, or something else?
- What do they seem to understand well vs what they're clearly winging?

**What problem they're actually solving (vs what they claim):**
- Strip away the grand vision - what are they really building?
- What problem are they personally experiencing that led to this?
- How much of their solution addresses real pain vs creates new complexity?
- What are they actually good at vs what they think they need to be good at?

**What would need to happen for this to succeed:**
- What would have to be true about the market, technology, and team for this to work?
- What are the 2-3 most critical things that could make or break this?
- What would success actually look like in practical terms?
- What are they not talking about that they definitely should be?

**The simple truth:**
- If you had to bet your own money, what would you actually be betting on?
- What's the most likely way this plays out in reality?
- What do they need to prove first before anything else matters?

Be direct and honest. Focus on what you can actually observe in the document rather than what they want you to believe. Respond in unstructured text - just tell me what you really think.

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
      temperature: 0.5,
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
    message: `C4 simple truth analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
    duration_ms: aiEndTime - aiStartTime
  });

  await sendEvent('saving', {
    message: 'Saving C4 simple truth analysis...'
  });

  // Save to experiments table with unstructured text
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'c4-truth',
      analysis_text: analysisText,
      metadata: {
        approach: 'Simple truth - direct analysis cutting through marketing speak',
        model: 'moonshot-v1-128k',
        track: 'C',
        description: 'Direct, honest analysis of who the authors are, what they are actually building, and what success requires'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save C4 results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'c4-truth',
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
            message: 'C4 simple truth analysis complete',
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