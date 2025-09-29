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
    message: `Starting B5 reality check analysis for ${symbol}...`
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
    message: 'B5: Performing reality check on claims and promises...'
  });

  const systemPrompt = 'You are performing reality checks on crypto project whitepapers, analyzing required assumptions and checking claims against technical, market, economic, and regulatory reality.';

  const userPrompt = `Analyze this whitepaper to perform reality checks on major claims and promises. For each significant promise or claim, identify what would need to be true for it to work and assess against reality.

For each major promise/claim, analyze:
1. The Promise: What exactly is being promised or claimed?
2. Required Assumptions: What must be true for this to work as described?
3. Reality Check Categories:
   - Technical Reality: Is this technically feasible with current/near-future technology?
   - Market Reality: Do market conditions support this (adoption, liquidity, demand)?
   - Economic Reality: Do the economics make sense (incentives, sustainability, value flows)?
   - Regulatory Reality: Are there regulatory constraints or risks?
   - Timeline Reality: Is the proposed timeline realistic given complexity?

4. Reality Assessment:
   - Solid: Assumptions are reasonable and well-supported
   - Optimistic: Requires favorable conditions but possible
   - Ambitious: Requires multiple things to go right, significant assumptions
   - Questionable: Key assumptions may not hold up to scrutiny
   - Unrealistic: Contradicts known limitations or market realities

Focus on identifying gaps between promises and practical reality:
- What are they not telling you about the challenges?
- What assumptions are they making about user behavior, market conditions, technical capabilities?
- What could go wrong that they're not addressing?
- Are their timelines and milestones realistic?

Don't be negative - be analytical about what needs to align for their vision to work.

Whitepaper content:
${content}

Output JSON:
{
  "reality_checks": [
    {
      "promise": "specific promise or claim being made",
      "required_assumptions": ["list of key assumptions that must be true"],
      "technical_reality": "assessment of technical feasibility",
      "market_reality": "assessment of market conditions and adoption requirements",
      "economic_reality": "assessment of economic sustainability and incentives",
      "regulatory_reality": "assessment of regulatory constraints or risks",
      "timeline_reality": "assessment of proposed timeline feasibility",
      "reality_assessment": "solid/optimistic/ambitious/questionable/unrealistic",
      "key_risks": "main things that could prevent this promise from being fulfilled"
    }
  ],
  "overall_reality_check": {
    "realism_score": "conservative/optimistic/aggressive/unrealistic based on overall promises",
    "critical_dependencies": ["list of critical factors the project depends on"],
    "major_assumptions": ["biggest assumptions the project is making"],
    "reality_gaps": ["areas where promises may not align with practical constraints"]
  }
}

Extract 5-7 key promises that best represent the project's ambition level and reality alignment.`;

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
    message: `B5 reality check complete in ${Math.round((aiEndTime - aiStartTime) / 1000)}s`,
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
    message: 'Saving B5 reality check analysis...'
  });

  // Save to experiments table
  const { error: saveError } = await supabase
    .from('whitepaper_experiments')
    .upsert({
      symbol,
      version: 'b5-reality',
      reality_checks: analysis.reality_checks || [],
      overall_reality_check: analysis.overall_reality_check || {},
      metadata: {
        approach: 'Reality check analysis of whitepaper claims and promises',
        model: 'kimi-k2-0905-preview',
        track: 'B'
      }
    }, {
      onConflict: 'symbol,version'
    });

  if (saveError) {
    console.error(`Failed to save B5 reality results: ${saveError.message}`);
    // Don't throw, just log the error
  }

  return {
    success: true,
    version: 'b5-reality',
    symbol,
    reality_checks: analysis.reality_checks || [],
    overall_reality_check: analysis.overall_reality_check || {}
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
            message: 'B5 reality check analysis complete',
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