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
    message: `Starting V9 question-driven analysis for ${symbol}...`
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
    message: 'V9: Answering key reader questions...'
  });

  const systemPrompt = 'You are answering reader questions about a new crypto project. Be direct, clear, and balanced. Address what readers really want to know.';

  const userPrompt = `Answer the key questions readers have about this project.

Answer these 4 questions:

Q1: What problem does this actually solve?
- Give a clear, specific answer
- Use a real-world comparison if helpful
- 2-3 sentences max

Q2: Why should I believe they can pull it off?
- List 2-3 credible reasons
- Be specific about what gives them credibility
- Avoid hype, stick to facts

Q3: What are the red flags?
- List 2-3 genuine concerns
- Be specific about risks
- Don't sugarcoat problems

Q4: Is this worth paying attention to?
- Give a clear yes/no/maybe
- Explain your reasoning in 1-2 sentences
- Who specifically should care and why

Extract:
1. Main claim as a question they're answering
2. Q&A format evaluation addressing:
   - Problem/solution fit
   - Credibility factors
   - Risk factors
   - Investment of attention worthiness

Whitepaper content:
${content}

Output JSON:
{
  "main_claim": "one sentence news-style description of what this project claims to do",
  "claim_evaluation": "2-3 paragraph balanced journalistic analysis presenting both opportunities and challenges"
}`;

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
      model: 'kimi-k2-0905-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 12000
    }),
    signal: AbortSignal.timeout(300000)
  });
  const aiEndTime = Date.now();

  if (!aiResponse.ok) {
    throw new Error(`AI API error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const aiContent = aiData.choices[0].message.content;

  await sendEvent('ai_complete', {
    message: `V6 analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
    duration_ms: aiEndTime - aiStartTime
  });

  let analysis;
  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No valid JSON found in response');
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }

  await sendEvent('saving', {
    message: 'Saving V9 Q&A analysis...'
  });

  // Save to experiments table
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'v9-questions',
      main_claim: analysis.main_claim,
      claim_evaluation: analysis.claim_evaluation,
      metadata: {
        approach: 'question-driven format',
        model: 'kimi-k2-0905-preview'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save V9 results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'v6-feasibility-ambition',
    symbol,
    main_claim: analysis.main_claim,
    claim_evaluation: analysis.claim_evaluation
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
            message: 'V9 question-driven analysis complete',
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