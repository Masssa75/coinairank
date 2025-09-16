import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PROMPT_VERSION = 'lightweight-v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { symbol, websiteUrl, projectId } = await req.json();

    if (!symbol || !websiteUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing symbol or websiteUrl' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`🚀 Lightweight analyzer for ${symbol}: ${websiteUrl}`);

    // Step 1: Quick fetch with timeout
    let html = '';
    try {
      const response = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CoinAIRank/1.0)',
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (response.ok) {
        html = await response.text();
        // Limit to 50K chars for faster processing
        html = html.substring(0, 50000);
        console.log(`✅ Fetched ${html.length} chars`);
      } else {
        console.log(`⚠️ Fetch failed: ${response.status}`);
      }
    } catch (e) {
      console.log(`⚠️ Fetch error: ${e.message}`);
    }

    // Step 2: Ultra-light AI analysis
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    const prompt = `Analyze this crypto project website quickly.

Website: ${websiteUrl}
Symbol: ${symbol}

Based on the HTML, provide:
1. One-line description
2. Quality tier: ALPHA (90+), SOLID (70-89), BASIC (40-69), TRASH (<40)
3. Score (0-100)
4. 2-3 key signals or partnerships
5. Technical assessment (2 sentences)

HTML (first 30K chars):
${html.substring(0, 30000)}

Return JSON only:
{
  "one_liner": "description",
  "tier": "SOLID",
  "score": 75,
  "signals": ["signal1", "signal2"],
  "technical_assessment": "assessment"
}`;

    let analysis = {
      one_liner: `${symbol} - Crypto project`,
      tier: 'BASIC',
      score: 50,
      signals: [],
      technical_assessment: 'Unable to analyze website content.'
    };

    try {
      const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'moonshot-v1-8k',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        }),
        signal: AbortSignal.timeout(20000) // 20 second timeout
      });

      if (aiResponse.ok) {
        const result = await aiResponse.json();
        const content = result.choices?.[0]?.message?.content || '';

        // Try to extract JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
            console.log(`✅ AI analysis complete: ${analysis.tier} (${analysis.score})`);
          } catch (e) {
            console.log('⚠️ Could not parse AI response');
          }
        }
      }
    } catch (e) {
      console.log(`⚠️ AI error: ${e.message}`);
    }

    // Step 3: Update database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const updateData = {
      website_stage1_score: analysis.score,
      website_stage1_tier: analysis.tier,
      one_liner: analysis.one_liner,
      technical_assessment: analysis.technical_assessment,
      extraction_status: 'completed',
      extraction_completed_at: new Date().toISOString(),
      prompt_version: PROMPT_VERSION
    };

    if (projectId) {
      await supabase
        .from('crypto_projects_rated')
        .update(updateData)
        .eq('id', projectId);
    } else {
      await supabase
        .from('crypto_projects_rated')
        .update(updateData)
        .eq('symbol', symbol);
    }

    console.log(`✅ Database updated`);

    return new Response(
      JSON.stringify({
        success: true,
        ...analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});