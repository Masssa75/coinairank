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
1. Start at Tier 4 (TRASH) - match against ANY TRASH benchmark that fits
2. Compare project vs that benchmark:
   - If LOSES → Stop, assign TRASH
   - If EQUAL → Stop, assign TRASH (qualifies for this tier)
   - If WINS → Move up, match against ANY BASIC benchmark that fits
3. Compare project vs that BASIC benchmark:
   - If LOSES → Stop, assign TRASH
   - If EQUAL → Stop, assign BASIC (qualifies for this tier)
   - If WINS → Move up, match against ANY SOLID benchmark that fits
4. Compare project vs that SOLID benchmark:
   - If LOSES → Stop, assign BASIC
   - If EQUAL → Stop, assign SOLID (qualifies for this tier)
   - If WINS → Move up, match against ANY ALPHA benchmark that fits
5. Compare project vs ANY ALPHA benchmark:
   - If project matches ANY ALPHA benchmark → Stop, assign ALPHA (qualifies for this tier)
   - If LOSES to all ALPHA benchmarks → Stop, assign SOLID
   - If WINS (exceeds all ALPHA benchmarks) → Stays ALPHA (perfect score)

Return JSON:
{
  "benchmark_progression": {
    "trash_comparison": {
      "result": "stronger/equal/weaker",
      "compared_to": "exact benchmark tier_reasoning text from TRASH tier that was most relevant",
      "why": "explanation of comparison"
    },
    "basic_comparison": {
      "result": "stronger/equal/weaker",
      "compared_to": "exact benchmark tier_reasoning text from BASIC tier that was most relevant",
      "why": "explanation of comparison"
    },
    "solid_comparison": {
      "result": "stronger/equal/weaker",
      "compared_to": "exact benchmark tier_reasoning text from SOLID tier that was most relevant",
      "why": "explanation of comparison"
    },
    "alpha_comparison": {
      "result": "stronger/equal/weaker",
      "compared_to": "exact benchmark tier_reasoning text from ALPHA tier that was most relevant",
      "why": "explanation of comparison"
    }
  },
  "final_tier": 1-4,
  "tier_name": "ALPHA/SOLID/BASIC/TRASH",
  "final_score": 0-100,
  "determining_factor": "main reason for this tier assignment",
  "explanation": "2-3 sentence summary of why project landed in this tier"
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
          determining_factor: comparisonResult.determining_factor,
          benchmark_progression: comparisonResult.benchmark_progression,
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
        determining_factor: comparisonResult.determining_factor,
        benchmark_progression: comparisonResult.benchmark_progression,
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