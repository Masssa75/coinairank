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

    // Step 3: Prepare the comparison prompt
    const COMPARISON_PROMPT = `You are an expert crypto whitepaper analyst performing a Phase 2 quality comparison.

## YOUR TASK
Compare this new project's whitepaper story analysis against our benchmark projects using BOTTOM-UP tier assignment.

## NEW PROJECT TO EVALUATE
Symbol: ${symbol}
Analysis: ${JSON.stringify(project.whitepaper_story_analysis, null, 2)}

## BENCHMARK PROJECTS (Ranked 1-11)
${benchmarks.map(b => `
### Rank #${b.rank}: ${b.symbol} (${b.tier_name}, Score: ${b.quality_score})
Full Analysis: ${JSON.stringify(b.full_story_analysis, null, 2)}
Key Strengths: ${b.key_strengths.join(', ')}
Key Weaknesses: ${b.key_weaknesses.join(', ')}
Tier Reasoning: ${b.tier_reasoning}
`).join('\n')}

## EVALUATION METHODOLOGY

1. **BOTTOM-UP COMPARISON**: Start by assuming the project is TRASH (Tier 4)

2. **PROGRESSIVE TIER TESTING**:
   - Is it STRONGER than SKYNET/TAO (ranks 10-11)? → Consider BASIC (Tier 3)
   - Is it STRONGER than AIX/AERO/KAS (ranks 7-9)? → Consider SOLID (Tier 2)
   - Is it STRONGER than ALGO/APT/CWEB (ranks 4-6)? → Consider ALPHA (Tier 1)
   - Is it STRONGER than KTA/WLD/ICP (ranks 1-3)? → Top of ALPHA

3. **COMPARISON DIMENSIONS**:
   - Vision ambition and clarity
   - Innovation depth and novelty
   - Market opportunity size and accessibility
   - Team credibility and track record
   - Technical maturity and feasibility
   - Success probability
   - Critical flaws severity
   - Risk profile

4. **KEY QUESTION FOR EACH COMPARISON**:
   "Would a rational investor prefer this project over [benchmark] based purely on the whitepaper analysis?"

## SCORING GUIDE
- ALPHA (85-100): Ranks 1-3 level - Revolutionary vision with clear path
- SOLID (60-84): Ranks 4-6 level - Solid innovation with meaningful differentiation
- BASIC (35-59): Ranks 7-9 level - Decent project with limited upside
- TRASH (0-34): Ranks 10-11 level - Weak fundamentals or critical flaws

## REQUIRED OUTPUT FORMAT
{
  "final_tier": 1-4,
  "tier_name": "ALPHA/SOLID/BASIC/TRASH",
  "quality_score": 0-100,
  "predicted_rank": 1-11,
  "most_similar_to": "Which benchmark project this most resembles",
  "stronger_than": ["List of benchmark symbols this project beats"],
  "weaker_than": ["List of benchmark symbols this project loses to"],
  "comparison_rationale": {
    "vs_tier_4": "Why stronger/weaker than SKYNET/TAO",
    "vs_tier_3": "Why stronger/weaker than AIX/AERO/KAS",
    "vs_tier_2": "Why stronger/weaker than ALGO/APT/CWEB",
    "vs_tier_1": "Why stronger/weaker than KTA/WLD/ICP"
  },
  "key_differentiators": ["What makes this project unique vs benchmarks"],
  "placement_confidence": "HIGH/MEDIUM/LOW - How confident in this tier placement",
  "summary": "2-3 sentences explaining the tier assignment"
}`;

    // Step 4: Call AI for comparison
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    console.log('🤖 Running Phase 2 comparison with Kimi K2...');

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

    console.log(`✅ Phase 2 complete: ${comparisonResult.tier_name} (Score: ${comparisonResult.quality_score})`);

    // Step 5: Update database with results
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        whitepaper_tier: comparisonResult.tier_name,
        whitepaper_quality_score: comparisonResult.quality_score,
        whitepaper_predicted_rank: comparisonResult.predicted_rank,
        whitepaper_phase2_comparison: {
          final_tier: comparisonResult.final_tier,
          tier_name: comparisonResult.tier_name,
          quality_score: comparisonResult.quality_score,
          predicted_rank: comparisonResult.predicted_rank,
          most_similar_to: comparisonResult.most_similar_to,
          stronger_than: comparisonResult.stronger_than,
          weaker_than: comparisonResult.weaker_than,
          comparison_rationale: comparisonResult.comparison_rationale,
          key_differentiators: comparisonResult.key_differentiators,
          placement_confidence: comparisonResult.placement_confidence,
          summary: comparisonResult.summary,
          compared_against_count: benchmarks.length,
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
        ...comparisonResult
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