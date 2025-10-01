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

    console.log(`✨ Extracting beacons for ${symbol} (Project ID: ${projectId})`);

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
    const ANALYSIS_PROMPT = `You are an expert crypto analyst identifying BEACONS - the 2-3 extraordinary signals that make a project stand out for investment.

## YOUR TASK
Extract the most important beacons from this project's analysis. Focus on EXTRAORDINARY signals, not basic features.

## PROJECT TO ANALYZE
Symbol: ${symbol}
Whitepaper Analysis: ${JSON.stringify(project.whitepaper_story_analysis, null, 2)}

## BEACON CATEGORIES TO LOOK FOR

### LEGENDARY FOUNDER (Worth 40+ points)
- Turing Award winners (e.g., Silvio Micali)
- Invented foundational protocols (e.g., Sompolinsky/GHOST)
- Industry titans (e.g., Sam Altman, CZ)
- Created major projects (e.g., Vitalik/Ethereum)

### IMPOSSIBLE PROBLEM SOLVED (Worth 35+ points)
- First working solution after years of failures
- Breakthrough everyone wanted but couldn't build
- Patent-worthy fundamental innovation
- Solves blockchain trilemma aspect

### UNIQUE MARKET POSITION (Worth 30+ points)
- Only one targeting specific $100B+ market
- Regulatory moat or compliance advantage
- Hardware deployment (hard to copy)
- Network effects already building

### ELITE BACKING (Worth 25+ points)
- Tier-1 VCs (a16z, Paradigm, etc.)
- Strategic corporate investors
- Government or institutional backing
- $100M+ funding rounds

### TECHNICAL BREAKTHROUGH (Worth 30+ points)
- Novel consensus mechanism that works
- Order of magnitude improvement
- Academic paper with 1000+ citations
- Solves known impossible problem

## OUTPUT FORMAT

Return a JSON object with exactly this structure:
{
  "beacons": [
    {
      "category": "LEGENDARY_FOUNDER/IMPOSSIBLE_PROBLEM/UNIQUE_MARKET/ELITE_BACKING/TECHNICAL_BREAKTHROUGH",
      "beacon": "Short, specific description (e.g., 'Turing Award winner Silvio Micali')",
      "score": 25-50,
      "evidence": "Specific evidence from the analysis supporting this beacon"
    }
  ],
  "total_beacon_score": 0-150,
  "tier_recommendation": "ALPHA/SOLID/BASIC/TRASH",
  "key_differentiator": "The ONE thing that most sets this project apart",
  "comparison_context": "Most similar to [PROJECT] because [REASON]",
  "red_flags": ["Any concerning signals that offset the beacons"],
  "summary": "2-3 sentence executive summary of beacon analysis"
}

## SCORING GUIDELINES
- ALPHA tier: 80+ beacon score (multiple extraordinary signals)
- SOLID tier: 50-79 beacon score (one clear beacon or strong fundamentals)
- BASIC tier: 25-49 beacon score (decent but no extraordinary signals)
- TRASH tier: 0-24 beacon score (red flags or no meaningful differentiation)

## IMPORTANT
- Be SELECTIVE - only true beacons, not standard features
- Look for signals that would make a VC write a check
- Anonymous teams are red flags UNLESS they've already delivered something extraordinary
- Consider both positive beacons and negative signals
- Maximum 3-4 beacons per project (quality over quantity)`;

    // Call AI for analysis
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    console.log('🤖 Running beacon extraction...');
    console.log(`  Using model: moonshot-v1-128k`);

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
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(60000) // 1 minute timeout
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

    console.log(`✅ Beacon extraction complete`);
    console.log(`  Total Score: ${analysisResult.total_beacon_score}`);
    console.log(`  Tier: ${analysisResult.tier_recommendation}`);
    console.log(`  Beacons: ${analysisResult.beacons.length}`);

    // Update database with results
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update({
        beacon_analysis: {
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
    console.error(`❌ Beacon extraction error: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});