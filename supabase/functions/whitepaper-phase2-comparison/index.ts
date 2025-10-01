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

    // Step 4: Prepare the hierarchical bottom-up comparison prompt
    const COMPARISON_PROMPT = `Classify this whitepaper using HIERARCHICAL BOTTOM-UP evaluation:

TRASH - Copy-paste, no real innovation
BASIC - Some innovation but unclear application (college student idea level)
SOLID - Real innovation from competent team
ALPHA - Breakthrough innovation from world-class team

Project: ${symbol}
Whitepaper Analysis: ${JSON.stringify(project.whitepaper_story_analysis, null, 2)}

## CRITICAL EVALUATION PROCESS - FOLLOW EXACTLY:

1. **Start by assuming this project is TRASH tier (weakest)**
2. **For each signal below, test progressively if it BEATS the higher tier benchmarks**
3. **Project tier = HIGHEST tier achieved by ANY signal**
4. **Do NOT stop at first match - test ALL signals against ALL tiers**

## TIER BEATING BENCHMARKS:

### TRASH → BASIC (any ONE signal beats TRASH):
- Some technical content beyond pure marketing
- Attempts at innovation even if flawed
- Basic team credentials mentioned
- Not obvious copy-paste

### BASIC → SOLID (any ONE signal beats BASIC):
- PhD team with published papers
- Ex-FAANG/major tech company engineers
- Working implementation of known concepts
- Professional team with track record
- Clear technical architecture

### SOLID → ALPHA (any ONE signal beats SOLID):
- Team member created paradigm-defining projects (OpenAI/GPT, Ethereum, Bitcoin, major AI/crypto breakthroughs)
- World-class academic credentials (Stanford/MIT professors, Turing Award winners, notable researchers)
- CEO/founder of major tech companies that defined new industries (like Sam Altman at OpenAI)
- First working solution to theoretical "impossible" problems
- Invented protocols that major blockchains adopted
- Breakthrough mathematical/cryptographic innovations that became standards

## EVALUATION METHODOLOGY:
For EACH signal you find, ask: "Does this signal beat the Tier X benchmark?"
- If YES: Test against next higher tier
- Continue until signal fails to beat a tier
- Record HIGHEST tier achieved by ANY signal

## CRITICAL: Test these specific signals if found:
- If Sam Altman mentioned → TEST: "CEO/founder of major tech companies" → Should beat SOLID → ALPHA
- If "OpenAI" mentioned → TEST: "paradigm-defining projects" → Should beat SOLID → ALPHA
- If "Ex-FAANG/SpaceX/Apple engineers" → TEST: beats BASIC → SOLID minimum
- If "2M+ users" or massive scale → TEST: beats BASIC → SOLID minimum

DO NOT ACCEPT "working implementation" as final tier if stronger signals exist.

## SCORING GUIDE
- ALPHA (85-100): Breakthrough innovation, world-class team or innovation
- SOLID (60-84): Real innovation from competent team
- BASIC (35-59): Some innovation but unclear application
- TRASH (0-34): Copy-paste, no real innovation

## OUTPUT FORMAT
Provide:
1. The tier classification (TRASH/BASIC/SOLID/ALPHA)
2. A quality score (0-100)
3. Specific reasoning citing what in the whitepaper indicates this tier
4. Which specific indicators triggered this classification

Return as JSON:
{
  "tier_name": "ALPHA/SOLID/BASIC/TRASH",
  "quality_score": 0-100,
  "reasoning": "Specific evidence from whitepaper",
  "triggered_indicators": "Which specific nudge indicators applied",
  "innovation_assessment": "What innovation exists and its quality",
  "team_assessment": "Evidence of team competence or lack thereof",
  "summary": "One sentence tier justification"
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

    console.log(`✅ Phase 2 complete: ${comparisonResult.tier_name} (Score: ${comparisonResult.quality_score})`);

    // Step 5: Update database with results
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        whitepaper_tier: comparisonResult.tier_name,
        whitepaper_quality_score: comparisonResult.quality_score,
        whitepaper_phase2_comparison: {
          tier_name: comparisonResult.tier_name,
          quality_score: comparisonResult.quality_score,
          reasoning: comparisonResult.reasoning,
          triggered_indicators: comparisonResult.triggered_indicators,
          innovation_assessment: comparisonResult.innovation_assessment,
          team_assessment: comparisonResult.team_assessment,
          summary: comparisonResult.summary,
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