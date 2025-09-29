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
    message: `Starting B2 technical/fundamental distillation for ${symbol}...`
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
    message: 'B2: Distilling technical and fundamental aspects...'
  });

  const systemPrompt = 'You are distilling the technical innovation and fundamental contribution of a whitepaper for comparative analysis.';

  const userPrompt = `Distill this whitepaper to its technical and fundamental essence for benchmark comparison.

Focus on:
- The core technical innovation or mechanism
- The fundamental problem being solved
- The specific approach that makes this unique
- The concrete implementation details that matter

Be specific about:
- Technical architecture and design choices
- Economic mechanisms and incentives
- Consensus or coordination mechanisms
- Data structures or algorithms used

Avoid:
- Marketing language or hype
- Generic blockchain benefits
- Vague future promises
- Non-technical aspects unless core to the innovation

Extract:
1. Technical innovation: The specific technical contribution in 1-2 sentences
2. Implementation essence: The concrete technical approach, mechanisms, and design choices in 3-4 paragraphs

Whitepaper content:
${content}

Output JSON:
{
  "technical_innovation": "the specific technical contribution in 1-2 sentences",
  "implementation_essence": "3-4 paragraphs describing the concrete technical approach and mechanisms"
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
    message: `B2 distillation complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
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
    message: 'Saving B2 technical/fundamental distillation...'
  });

  // Save to experiments table
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'b2-technical-fundamental',
      technical_innovation: analysis.technical_innovation || analysis.core_thesis || analysis.main_claim,
      implementation_essence: analysis.implementation_essence || analysis.authentic_essence || analysis.claim_evaluation,
      metadata: {
        approach: 'Technical and fundamental distillation',
        model: 'kimi-k2-0905-preview',
        track: 'B'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save B2 results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'b2-technical-fundamental',
    symbol,
    technical_innovation: analysis.technical_innovation || analysis.core_thesis || analysis.main_claim,
    implementation_essence: analysis.implementation_essence || analysis.authentic_essence || analysis.claim_evaluation
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
            message: 'B2 technical/fundamental distillation complete',
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