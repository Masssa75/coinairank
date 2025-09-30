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

    console.log(`💰 Analyzing market cap potential for ${symbol} (Project ID: ${projectId})`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the project's whitepaper story analysis
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

    // Prepare the prompt
    const ANALYSIS_PROMPT = `You are an expert crypto market analyst specializing in valuation through historical comparisons.

## YOUR TASK
Analyze this project's market cap potential by comparing it to similar historical projects.

## PROJECT TO ANALYZE
Symbol: ${symbol}
Whitepaper Analysis: ${JSON.stringify(project.whitepaper_story_analysis, null, 2)}

## ANALYSIS FRAMEWORK

Create a market cap potential analysis with these exact sections:

### 1. SPECULATION CASE
Identify 3-4 historical crypto projects that had similar narratives and reached significant market caps on speculation alone.
For each comparison:
- Name the project and its peak speculative market cap
- Explain why this project is comparable
- What trigger caused that project's speculation run

Estimate this project's speculation potential: $X-YB range

### 2. FULL SUCCESS CASE
Identify 3-4 companies/networks (crypto or traditional) that represent what this project could become if fully successful.
For each comparison:
- Name the entity and its current valuation
- Explain why this represents the success case
- What market share would our project need to justify similar valuation

Estimate full success potential: $X-YB range

### 3. REQUIRED ACHIEVEMENTS
List 6-8 specific milestones this project must achieve to reach full success.
Be specific and realistic based on the whitepaper's claims.

### 4. UNIQUE POSITIONING
Write one paragraph explaining what this project has that similar failed projects didn't have.
Focus on timing, approach, team, or technology advantages.

### 5. MARKET CAP TIMELINE
Provide a realistic timeline with market cap progression:

Year 0-X: Phase Name ($XM → $YB)
- Key milestones for this phase
- What drives the valuation change

Continue for 5-10 years until full success case

## OUTPUT FORMAT

Return a JSON object:
{
  "speculation_case": {
    "comparisons": [
      {
        "project": "Name",
        "peak_mcap": "$XB",
        "reasoning": "Why comparable",
        "trigger": "What caused the run"
      }
    ],
    "estimated_range": "$X-YB",
    "key_catalyst": "Most likely trigger for this project"
  },
  "full_success_case": {
    "comparisons": [
      {
        "entity": "Name",
        "valuation": "$XB",
        "reasoning": "Why this is the success case",
        "market_share_needed": "X% of Y market"
      }
    ],
    "estimated_range": "$X-YB"
  },
  "required_achievements": [
    "Specific milestone 1",
    "Specific milestone 2"
  ],
  "unique_positioning": "One paragraph explaining competitive advantages",
  "timeline": [
    {
      "years": "0-1",
      "phase": "Foundation",
      "mcap_range": "$XM → $YM",
      "milestones": ["Milestone 1", "Milestone 2"],
      "valuation_driver": "What causes the increase"
    }
  ],
  "success_probability": "X%",
  "key_risks": ["Main risk 1", "Main risk 2"],
  "summary": "2-3 sentence executive summary"
}`;

    // Call AI for analysis
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    console.log('🤖 Running market cap analysis...');
    console.log(`  Using model: moonshot-v1-128k`);
    console.log(`  Prompt length: ${ANALYSIS_PROMPT.length} characters`);

    const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'moonshot-v1-128k',
        messages: [{ role: 'user', content: ANALYSIS_PROMPT }],
        temperature: 0.3,
        max_tokens: 4000
      }),
      signal: AbortSignal.timeout(60000) // 1 minute timeout for AI call
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices[0].message.content.trim();

    // Parse AI response
    let analysisResult;
    try {
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error(`Failed to parse analysis result: ${parseError.message}`);
    }

    console.log(`✅ Market cap analysis complete`);
    console.log(`  Speculation: ${analysisResult.speculation_case.estimated_range}`);
    console.log(`  Full Success: ${analysisResult.full_success_case.estimated_range}`);
    console.log(`  Success Probability: ${analysisResult.success_probability}`);

    // Update database with results
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        market_cap_potential_analysis: {
          ...analysisResult,
          analyzed_at: new Date().toISOString(),
          version: '1.0.0'
        }
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
        ...analysisResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ Market cap analysis error: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});