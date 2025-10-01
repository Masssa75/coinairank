import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, symbol } = await req.json();

    if (!projectId || !symbol) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing projectId or symbol'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`🎯 Phase 2: Whitepaper story comparison for ${symbol} (Project ID: ${projectId})`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Fetch the project's whitepaper story analysis
    const { data: project, error: projectError } = await supabase
      .from('crypto_projects_rated')
      .select('whitepaper_story_analysis')
      .eq('id', projectId)
      .single();

    if (projectError || !project?.whitepaper_story_analysis) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch project analysis: ${projectError?.message || 'No analysis found'}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Step 2: Fetch all benchmark projects with full analyses
    const { data: benchmarks, error: benchmarksError } = await supabase
      .from('whitepaper_story_benchmarks')
      .select('*')
      .eq('is_active', true)
      .order('rank', { ascending: true });

    if (benchmarksError || !benchmarks || benchmarks.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to load benchmarks: ${benchmarksError?.message || 'No benchmarks found'}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📚 Loaded ${benchmarks.length} benchmark projects for comparison`);

    // Step 3: Group benchmarks by tier for pattern matching
    const tiers = {
      ALPHA: benchmarks.filter(b => b.tier_name === 'ALPHA'),
      SOLID: benchmarks.filter(b => b.tier_name === 'SOLID'),
      BASIC: benchmarks.filter(b => b.tier_name === 'BASIC'),
      TRASH: benchmarks.filter(b => b.tier_name === 'TRASH')
    };

    // Step 4: Use website analyzer v3 Phase 2 prompt with whitepaper data
    const COMPARISON_PROMPT = `Evaluate whitepaper analysis using BOTTOM-UP tier assignment.

TIER BENCHMARKS:
${JSON.stringify(benchmarks, null, 2)}

WHITEPAPER ANALYSIS:
${JSON.stringify(project.whitepaper_story_analysis, null, 2)}

EVALUATION PROCESS:
1. Start by assuming all signals are Tier 4 (weakest)
2. For each signal, progressively test if it's STRONGER than benchmarks:
   - Stronger than ANY Tier 4 benchmark? → Consider for Tier 3
   - Stronger than ANY Tier 3 benchmark? → Consider for Tier 2
   - Stronger than ANY Tier 2 benchmark? → Consider for Tier 1
3. Project tier = highest tier achieved by ANY signal

Return JSON:
{
  "final_tier": 1-4,
  "tier_name": "ALPHA/SOLID/BASIC/TRASH",
  "final_score": 0-100,
  "strongest_signal": "exact signal that determined tier",
  "signal_evaluations": [
    {
      "signal": "signal text",
      "assigned_tier": 1-4,
      "reasoning": "why this tier"
    }
  ],
  "explanation": "2-3 sentences on tier logic"
}`;

    // Step 5: Call AI for comparison
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    console.log('🤖 Running Phase 2 tier-based comparison...');

    const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-turbo-preview',  // Using turbo for 262K context
        messages: [{ role: 'user', content: COMPARISON_PROMPT }],
        temperature: 0.3,
        max_tokens: 3000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices[0].message.content.trim();

    // Parse AI response
    let comparisonResult;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      comparisonResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error(`Failed to parse comparison result: ${parseError.message}`);
    }

    console.log(`✅ Phase 2 complete: ${comparisonResult.tier_name} (Score: ${comparisonResult.final_score})`);

    // Step 5: Update database with results
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        whitepaper_tier: comparisonResult.tier_name,
        whitepaper_quality_score: comparisonResult.final_score,
        whitepaper_phase2_comparison: {
          final_tier: comparisonResult.final_tier,
          tier_name: comparisonResult.tier_name,
          final_score: comparisonResult.final_score,
          strongest_signal: comparisonResult.strongest_signal,
          signal_evaluations: comparisonResult.signal_evaluations,
          explanation: comparisonResult.explanation,
          completed_at: new Date().toISOString()
        },
        whitepaper_phase2_completed_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      console.error(`Failed to update database: ${updateError.message}`);
      // Continue anyway to return results
    }

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        projectId,
        tier_name: comparisonResult.tier_name,
        quality_score: comparisonResult.final_score,
        strongest_signal: comparisonResult.strongest_signal,
        signal_evaluations: comparisonResult.signal_evaluations,
        explanation: comparisonResult.explanation
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ Phase 2 comparison error: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});