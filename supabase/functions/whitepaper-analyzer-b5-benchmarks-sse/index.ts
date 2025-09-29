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
    message: `Starting B5 competitive benchmarking for ${symbol}...`
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
    message: 'B5: Analyzing competitive positioning and benchmarks...'
  });

  const systemPrompt = 'You are analyzing crypto project whitepapers for direct competitive positioning analysis, identifying category leaders and differentiation strategies.';

  const userPrompt = `Analyze this whitepaper for competitive positioning - for each major feature/claim, identify the competitive landscape and how this project differentiates.

For each key feature/capability, determine:
1. Category: What specific market/technology category does this feature compete in?
2. Current Leaders: Who are the established/leading projects in this category?
3. Differentiation: How does this project claim to be different/better?
4. Differentiation Value: Assess the meaningfulness of their differentiation
   - Breakthrough: Genuinely novel approach with significant advantages
   - Incremental: Modest improvements on existing solutions
   - Marketing: Rebranding existing concepts without technical differentiation
   - Questionable: Claims advantages that may not hold up to scrutiny

Focus on direct competitive analysis:
- Don't just identify what they do, but WHO they're competing against
- Evaluate whether their differentiation is technical, economic, or marketing-based
- Assess if their competitive advantages are defensible or easily copied
- Consider market timing and competitive moats

Examples:
- "Faster consensus" → Category: Layer 1 blockchains, Leaders: Ethereum, Solana, differentiation: specific mechanism, value: incremental/breakthrough?
- "Cross-chain bridges" → Category: Interoperability, Leaders: Chainlink CCIP, Wormhole, differentiation: security model, value: incremental/questionable?

Whitepaper content:
${content}

Output JSON:
{
  "competitive_analysis": [
    {
      "feature": "specific feature or capability claimed",
      "category": "market/tech category this feature competes in",
      "current_leaders": ["list of 2-3 leading projects in this category"],
      "differentiation": "how this project claims to be different/better",
      "differentiation_value": "breakthrough/incremental/marketing/questionable",
      "competitive_assessment": "analysis of competitive positioning strength"
    }
  ],
  "competitive_summary": {
    "primary_competition": ["main projects this directly competes with"],
    "differentiation_strength": "strong/moderate/weak overall differentiation",
    "competitive_moats": ["list of potential competitive advantages"],
    "market_positioning": "summary of how they position against competition"
  }
}

Extract 5-7 key features that best show the project's competitive positioning and differentiation strategy.`;

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
    message: `B5 competitive analysis complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
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
    message: 'Saving B5 competitive analysis...'
  });

  // Save to experiments table
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'b5-benchmarks',
      competitive_analysis: analysis.competitive_analysis || [],
      competitive_summary: analysis.competitive_summary || {},
      metadata: {
        approach: 'Competitive benchmarking and differentiation analysis',
        model: 'kimi-k2-0905-preview',
        track: 'B'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save B5 benchmark results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'b5-benchmarks',
    symbol,
    competitive_analysis: analysis.competitive_analysis || [],
    competitive_summary: analysis.competitive_summary || {}
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
            message: 'B5 competitive analysis complete',
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