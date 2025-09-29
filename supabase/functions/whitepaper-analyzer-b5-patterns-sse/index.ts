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
    message: `Starting B5 pattern analysis for ${symbol}...`
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
    message: 'B5: Analyzing claim patterns and frequency...'
  });

  const systemPrompt = 'You are analyzing crypto project whitepapers to identify and categorize claims into recognizable patterns with frequency analysis.';

  const userPrompt = `Analyze this whitepaper to categorize claims into recognizable patterns and assess their frequency in the crypto space.

For each major claim/feature, identify:
1. Pattern Category: Which pattern does this claim fit into?
   - Marketing patterns (revolutionary, game-changing, next-generation, etc.)
   - Technical patterns (novel consensus, interoperability, scalability, etc.)
   - Economic patterns (tokenomics, staking rewards, deflationary, etc.)
   - Problem patterns (existing solutions inadequate, market gap, user pain point, etc.)

2. Frequency Classification:
   - Universal (99%+ of projects): Basic blockchain functionality, token economics, community focus
   - Common (50-90%): Scalability solutions, interoperability claims, DeFi integration
   - Emerging (10-50%): AI integration, specific use cases, novel mechanisms
   - Rare (1-10%): Truly novel approaches, first-of-kind features
   - Novel (<1%): Genuinely unprecedented concepts or implementations

3. Pattern Analysis: Why does this project use this pattern? What does it reveal about their positioning strategy?

Focus on identifying:
- Which patterns this project gravitates toward most
- Whether they're following safe/common patterns or taking risks with novel ones
- How they combine different pattern types
- What their pattern choices reveal about their market strategy

Whitepaper content:
${content}

Output JSON:
{
  "pattern_analysis": [
    {
      "claim": "specific claim or feature from whitepaper",
      "pattern_category": "marketing/technical/economic/problem",
      "frequency": "universal/common/emerging/rare/novel",
      "pattern_description": "describe the specific pattern this claim follows",
      "strategic_insight": "what this pattern choice reveals about project strategy"
    }
  ],
  "pattern_summary": {
    "primary_patterns": ["list of main patterns used"],
    "risk_profile": "conservative/moderate/aggressive based on pattern frequency choices",
    "positioning_strategy": "summary of how pattern choices position the project"
  }
}

Extract 5-7 key claims that best show the project's pattern usage and strategic positioning.`;

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
    message: `B5 pattern analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
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
    message: 'Saving B5 pattern analysis...'
  });

  // Save to experiments table
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'b5-patterns',
      pattern_analysis: analysis.pattern_analysis || [],
      pattern_summary: analysis.pattern_summary || {},
      metadata: {
        approach: 'Pattern recognition and frequency analysis of whitepaper claims',
        model: 'kimi-k2-0905-preview',
        track: 'B'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save B5 pattern results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'b5-patterns',
    symbol,
    pattern_analysis: analysis.pattern_analysis || [],
    pattern_summary: analysis.pattern_summary || {}
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
            message: 'B5 pattern analysis complete',
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