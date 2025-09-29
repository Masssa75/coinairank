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
    message: `Starting B3 comparative-ready extraction for ${symbol}...`
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
    message: 'B3: Creating comparative-ready representation...'
  });

  const systemPrompt = 'You are creating a comprehensive yet comparable representation of a whitepaper that can be directly compared with other projects.';

  const userPrompt = `Create a comprehensive representation of this whitepaper optimized for comparative ranking.

Capture these comparable dimensions:
- Problem scope and importance
- Solution sophistication and novelty
- Technical implementation depth
- Market opportunity and fit
- Team capability indicators
- Token utility and economics
- Competitive differentiation

For each dimension:
- Be specific and factual
- Include concrete details that enable comparison
- Preserve unique aspects while maintaining comparability
- Focus on what can be objectively compared

The representation should:
- Enable direct comparison with other projects
- Capture both common and unique elements
- Maintain factual accuracy
- Include all information relevant for quality assessment

Extract:
1. Comparable claim: The core value proposition in comparable terms (1-2 sentences)
2. Comparative representation: A comprehensive yet structured representation covering all key dimensions (3-4 paragraphs)

Whitepaper content:
${content}

Output JSON:
{
  "comparable_claim": "the core value proposition framed for comparison in 1-2 sentences",
  "comparative_representation": "3-4 paragraphs covering all key comparable dimensions while preserving unique aspects"
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
    message: `B3 extraction complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
    duration_ms: aiEndTime - aiStartTime
  });

  let analysis;
  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      // Clean the JSON string of problematic control characters
      let cleanedJson = jsonMatch[0]
        .replace(/\\n/g, '\\\\n')  // Escape newlines
        .replace(/\\t/g, '\\\\t')  // Escape tabs
        .replace(/\\r/g, '\\\\r')  // Escape carriage returns
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // Remove other control chars

      // First attempt with cleaned JSON
      try {
        analysis = JSON.parse(cleanedJson);
      } catch (e) {
        // If that fails, try a more aggressive cleaning
        cleanedJson = jsonMatch[0]
          .replace(/\n/g, ' ')  // Replace actual newlines with spaces
          .replace(/\t/g, ' ')  // Replace tabs with spaces
          .replace(/\r/g, '')   // Remove carriage returns
          .replace(/[\x00-\x1F\x7F]/g, ''); // Remove all control characters
        analysis = JSON.parse(cleanedJson);
      }
    } else {
      throw new Error('No valid JSON found in response');
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
    console.error('Raw AI content:', aiContent.substring(0, 500));
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }

  await sendEvent('saving', {
    message: 'Saving B3 comparative-ready representation...'
  });

  // Save to experiments table
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'b3-comparative-ready',
      comparable_claim: analysis.comparable_claim || analysis.core_thesis || analysis.main_claim,
      comparative_representation: analysis.comparative_representation || analysis.authentic_essence || analysis.claim_evaluation,
      metadata: {
        approach: 'Comparative-ready representation',
        model: 'kimi-k2-0905-preview',
        track: 'B'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save B3 results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'b3-comparative-ready',
    symbol,
    comparable_claim: analysis.comparable_claim || analysis.core_thesis || analysis.main_claim,
    comparative_representation: analysis.comparative_representation || analysis.authentic_essence || analysis.claim_evaluation
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
            message: 'B3 comparative-ready extraction complete',
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