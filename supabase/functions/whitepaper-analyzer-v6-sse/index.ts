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
    message: `Starting V6 feasibility vs ambition analysis for ${symbol}...`
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
    message: 'V6: Analyzing technical feasibility vs ambition balance...'
  });

  const systemPrompt = 'You are an expert crypto whitepaper analyst focused on evaluating the balance between technical feasibility and ambitious vision. Consider how revolutionary claims measure against realistic implementation prospects.';

  const userPrompt = `Analyze this whitepaper with a focus on TECHNICAL FEASIBILITY vs AMBITION BALANCE.

Consider:
- How revolutionary vs realistic are the technical claims?
- What is the balance between ambitious vision and practical implementation?
- Are the technical challenges acknowledged and addressed appropriately?
- How does the scope of ambition match the team's capability and timeline?
- What are the technical risks and mitigation strategies?

Extract:
1. The main claim in one clear sentence
2. Evaluate the feasibility-ambition balance in 2-3 paragraphs focusing on:
   - Revolutionary scope vs technical realism
   - Implementation complexity and timeline feasibility
   - Technical risk assessment and mitigation
   - Balance between vision and execution capability

Whitepaper content:
${content}

Output JSON:
{
  "main_claim": "one sentence description of the primary innovation",
  "claim_evaluation": "2-3 paragraph evaluation focused on technical feasibility vs ambition balance"
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
    message: 'Saving V6 feasibility vs ambition analysis...'
  });

  // Save to a new column for V6 results
  const { error: updateError } = await supabase
    .from('crypto_projects_rated')
    .update({
      whitepaper_v6_analysis: {
        main_claim: analysis.main_claim,
        claim_evaluation: analysis.claim_evaluation,
        analyzed_at: new Date().toISOString(),
        version: 'v6-feasibility-ambition'
      }
    })
    .eq('id', project.id);

  if (updateError) {
    console.error(`Failed to update V6 results: ${updateError.message}`);
    throw updateError;
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
            message: 'V6 feasibility vs ambition analysis complete',
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