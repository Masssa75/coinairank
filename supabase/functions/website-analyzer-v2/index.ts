import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telegram notification helper
async function sendTelegramNotification(message) {
  try {
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN_CAR');
    const telegramChatId = Deno.env.get('TELEGRAM_GROUP_ID_CAR');
    
    if (!telegramBotToken || !telegramChatId) {
      console.log('Telegram credentials not configured, skipping notification');
      return;
    }
    
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
  }
}

// Function for Phase 2: Bottom-up tier comparison and scoring
async function compareWithBenchmarks(signals, benchmarks, symbol) {
  const COMPARISON_PROMPT = `Evaluate extracted signals using BOTTOM-UP tier assignment.

PROJECT: ${symbol}
SIGNALS: ${JSON.stringify(signals)}

TIER BENCHMARKS:
${JSON.stringify(benchmarks, null, 2)}

EVALUATION PROCESS:
1. Start by assuming all signals are Tier 4 (weakest)
2. For each signal, progressively test if it's STRONGER than benchmarks:
   - Stronger than ANY Tier 4 benchmark? → Consider for Tier 3
   - Stronger than ANY Tier 3 benchmark? → Consider for Tier 2  
   - Stronger than ANY Tier 2 benchmark? → Consider for Tier 1
   - Equal/comparable to Tier 1 benchmark? → Confirm as Tier 1
3. Signal stops at the highest tier where it truly belongs
4. The SINGLE STRONGEST signal determines final project tier

IMPORTANT RULES:
- For each tier comparison, you MUST select the most relevant benchmark from that tier to compare against
- Even if no perfect match exists, pick the closest benchmark and explain the comparison
- When comparing across categories (e.g., social vs technical), explicitly note the cross-category nature
- "Stronger" means objectively more predictive of success
- Be strict: a weak signal doesn't become strong just by being vaguely similar to a strong benchmark
- If truly not comparable, still show the closest benchmark attempted and explain why it's not comparable

CRITICAL FALSE ENDORSEMENT PATTERNS:
- Matt Furie has NEVER endorsed any crypto project and actively sues projects using his name/art
- Any claim of "by Matt Furie", "Matt Furie presents", or direct Furie involvement is FALSE
- Treat such false claims as Tier 3 at best (deceptive marketing reduces credibility)
- Similarly, be skeptical of claimed endorsements from other celebrities without verifiable proof

Return JSON:
{
  "signal_evaluations": [
    {
      "signal": "exact signal text",
      "progression": {
        "tier_4_comparison": {
          "result": "stronger/equal/weaker/not_comparable",
          "compared_to": "exact benchmark text from tier 4 that was most relevant",
          "why": "brief explanation of comparison"
        },
        "tier_3_comparison": {
          "result": "stronger/equal/weaker/not_comparable",
          "compared_to": "exact benchmark text from tier 3 that was most relevant",
          "why": "brief explanation of comparison"
        },
        "tier_2_comparison": {
          "result": "stronger/equal/weaker/not_comparable",
          "compared_to": "exact benchmark text from tier 2 that was most relevant",
          "why": "brief explanation of comparison"
        },
        "tier_1_comparison": {
          "result": "stronger/equal/weaker/not_comparable",
          "compared_to": "exact benchmark text from tier 1 that was most relevant",
          "why": "brief explanation of comparison"
        }
      },
      "assigned_tier": 1-4,
      "reasoning": "why signal belongs in this tier"
    }
  ],
  "strongest_signal": {
    "signal": "the single best signal",
    "tier": 1-4,
    "benchmark_match": "most comparable benchmark"
  },
  "final_tier": 1-4,
  "final_score": 0-100,
  "tier_name": "ALPHA/SOLID/BASIC/TRASH",
  "explanation": "concise explanation of tier assignment"
}

TIER RANGES:
- Tier 1 (ALPHA): 85-100
- Tier 2 (SOLID): 60-84
- Tier 3 (BASIC): 30-59
- Tier 4 (TRASH): 0-29`;

  try {
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    // Using Moonshot API directly instead of OpenRouter
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [
          {
            role: 'user',
            content: COMPARISON_PROMPT
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent scoring
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Phase 2 comparison failed: ${response.status} - ${errorText}`);
      
      // Send Telegram notification for Phase 2 failure
      await sendTelegramNotification(
        `🚨 *Website Analyzer V2 Error*\n\n` +
        `*Type:* Phase 2 Comparison Failure\n` +
        `*Symbol:* ${symbol}\n` +
        `*Status:* ${response.status}\n` +
        `*Error:* ${errorText.substring(0, 200)}\n` +
        `*Time:* ${new Date().toISOString()}`
      );
      
      throw new Error(`Phase 2 comparison failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      console.error('Unexpected Phase 2 API response structure:', JSON.stringify(data).substring(0, 500));
      
      if (data.error) {
        console.error('Phase 2 API Error:', data.error);
        throw new Error(`Phase 2 API Error: ${data.error.message || data.error}`);
      }
      throw new Error('Invalid Phase 2 API response structure');
    }

    const content = data.choices[0].message.content.trim();
    
    // Remove markdown blocks if present
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(cleanContent);
    
    console.log(`Phase 2 comparison complete: Tier ${result.final_tier} (${result.tier_name}) - Score ${result.final_score}`);
    
    return result;
    
  } catch (error) {
    console.error(`Phase 2 comparison error: ${error}`);
    
    // Send Telegram notification for Phase 2 exception
    await sendTelegramNotification(
      `🚨 *Website Analyzer V2 Error*\n\n` +
      `*Type:* Phase 2 Comparison Exception\n` +
      `*Symbol:* ${symbol}\n` +
      `*Error:* ${error.message}\n` +
      `*Time:* ${new Date().toISOString()}`
    );
    
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { 
      phase = 1,            // Phase 1 (extraction) or Phase 2 (scoring)
      projectId,            // ID in crypto_projects_rated table
      contractAddress,      // For logging
      network,             // Network (ethereum, etc)
      websiteUrl,          // Website to analyze
      symbol,              // Token symbol
      source               // Where request came from
    } = await req.json();
    
    // Phase 2: Benchmark comparison and scoring
    if (phase === 2) {
      if (!projectId) {
        throw new Error('Phase 2 requires projectId');
      }
      
      console.log(`Phase 2: Benchmark comparison for ${symbol} (Project ID: ${projectId})`);
      
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Load Phase 1 data from database
      const { data: project, error: projectError } = await supabase
        .from('crypto_projects_rated')
        .select('signals_found, red_flags, project_summary_rich, extraction_status')
        .eq('id', projectId)
        .single();
      
      if (projectError || !project) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to load project data: ${projectError?.message || 'Project not found'}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      if (project.extraction_status !== 'completed') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Phase 1 extraction not completed. Run with phase: 1 first.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Load active benchmarks from database
      const { data: benchmarks, error: benchmarksError } = await supabase
        .from('website_tier_benchmarks')
        .select('*')
        .eq('is_active', true)
        .order('tier', { ascending: true });
      
      if (benchmarksError || !benchmarks) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Failed to load benchmarks: ${benchmarksError?.message || 'No benchmarks found'}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log(`Loaded ${benchmarks.length} benchmarks and ${project.signals_found?.length || 0} signals`);
      
      // Run Phase 2 comparison
      const comparison = await compareWithBenchmarks(
        project.signals_found || [],
        benchmarks,
        symbol
      );
      
      // Update database with Phase 2 results
      const updatePayload = {
        website_stage1_score: comparison.final_score,
        website_stage1_tier: comparison.tier_name,
        strongest_signal: comparison.strongest_signal,
        benchmark_comparison: comparison,
        comparison_explanation: comparison.explanation,
        comparison_status: 'completed',
        comparison_completed_at: new Date().toISOString()
      };
      
      const { data: updateData, error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update(updatePayload)
        .eq('id', projectId)
        .select();
      
      if (updateError) {
        console.error(`Failed to update Phase 2 results: ${updateError.message}`);
        
        // Send Telegram notification for Phase 2 database update failure
        await sendTelegramNotification(
          `🚨 *Website Analyzer V2 Error*\n\n` +
          `*Type:* Phase 2 Database Update Failed\n` +
          `*Symbol:* ${symbol}\n` +
          `*Error:* ${updateError.message}\n` +
          `*Time:* ${new Date().toISOString()}`
        );
        
        return new Response(
          JSON.stringify({
            success: false,
            error: `Database update failed: ${updateError.message}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      console.log(`✅ Phase 2 complete for ${symbol}: Tier ${comparison.final_tier} (${comparison.tier_name}), Score ${comparison.final_score}`);
      
      // Return Phase 2 results
      return new Response(
        JSON.stringify({
          success: true,
          phase: 'scoring',
          symbol,
          final_tier: comparison.final_tier,
          tier_name: comparison.tier_name,
          final_score: comparison.final_score,
          strongest_signal: comparison.strongest_signal,
          signal_evaluations: comparison.signal_evaluations,
          explanation: comparison.explanation
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Phase 1: Website analysis and signal extraction
    if (!websiteUrl || !symbol) {
      return new Response(
        JSON.stringify({ 
          success: false,
          function: 'website-analyzer-v2',
          test_type: 'phase1_full_analysis_with_stage2_links',
          phase: 1,
          error: 'Missing websiteUrl or symbol' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`🚀 Website Analyzer V2: Starting analysis for ${symbol} - ${websiteUrl}`);

    // Step 1: Fetch the website HTML
    const fetchResponse = await fetch(websiteUrl);
    
    if (!fetchResponse.ok) {
      console.log(`⚠️ Website fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`);
      return new Response(
        JSON.stringify({
          success: false,
          function: 'website-analyzer-v2',
          test_type: 'phase1_full_analysis_with_stage2_links',
          phase: 1,
          symbol,
          websiteUrl,
          error: `Website fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`,
          http_status: fetchResponse.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const html = await fetchResponse.text();
    console.log(`📄 Fetched ${html.length} chars of raw HTML`);

    // Check 240K threshold
    if (html.length > 240000) {
      console.log(`⚠️ HTML too large: ${html.length} chars > 240K threshold - marking for parsing`);
      
      // Store in database with needs_parsing flag
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: insertData, error: dbError } = await supabase
        .from('crypto_projects_rated')
        .insert({
          symbol: symbol,
          website_url: websiteUrl,
          needs_parsing: true,
          website_status: 'needs_parsing',
          contract_address: contractAddress || 'pending',  // Provide default if not supplied
          network: network || 'unknown'  // Provide default if not supplied
        })
        .select();
      
      const totalDuration = Date.now() - startTime;
      
      return new Response(
        JSON.stringify({
          success: true,
          function: 'website-analyzer-v2',
          test_type: 'phase1_full_analysis_with_stage2_links',
          phase: 1,
          symbol,
          websiteUrl,
          needs_parsing: true,
          html_length: html.length,
          threshold: 240000,
          total_duration_ms: totalDuration,
          database_storage: {
            attempted: true,
            success: !dbError,
            error: dbError?.message || null,
            record_id: insertData?.[0]?.id || null
          },
          message: 'HTML too large for direct AI analysis - marked for parsing'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Create prompt with ALL 9 fields + complex instructions
    const prompt = `You are an expert crypto analyst specializing in identifying high-potential projects through website analysis.

HUNT FOR ALPHA in this HTML. Look for:

🎯 TIER 1 SIGNALS (Any ONE of these = potential moon mission):
- Backing from major tech corporations or conglomerates
- Investment from tier-1 venture capital firms
- Team with documented successful exits
- High-profile celebrity or influencer involvement
- Solving problem for billion-dollar market
- Patent-pending or proprietary technology
- Government contracts or partnerships
- Exchange listings or partnerships confirmed

🔍 DEEP DIVE into the HTML:
- Check ALL text, links, images, meta tags, hidden content
- Look for company names, investor logos, partnership mentions
- Find team backgrounds, professional profiles, past successes
- Identify technical innovations or unique approaches
- Spot viral potential or meme-ability
- Detect institutional interest signals

WEBSITE STATUS DETECTION:
- "dead": Parking pages, domain-for-sale, error pages, "coming soon", placeholder content
- "blocked": Instagram/social-only, access restricted, paywall
- "active": Real project website with actual content

If dead/blocked, stop analysis and return minimal response with website_status only.

DETERMINE TYPE:
Is this a meme token (focus on community/viral) or utility token (real use case)?

STAGE 2 LINK SELECTION:
Identify ALL links that would meaningfully help a crypto analyst deeply evaluate this project's legitimacy, technical substance, and real-world adoption.

Technical Assessment: 2-3 sentences describing how this website was built
SSR/CSR Classification: SSR or CSR${contractAddress ? `

CONTRACT VERIFICATION:
Search the HTML for this contract address: ${contractAddress}
Check if it appears anywhere on the website (footer, docs, token info, etc.)` : ''}

PROJECT DESCRIPTION: Write a 60-character MAX description of what this project actually does. Be specific and factual, no marketing fluff.

CREATE PROJECT SUMMARY:
Write a 75-word description covering: What the project does, website quality, key discoveries, unique aspects.

Return JSON:
{
  "website_status": "active/dead/blocked",
  "token_type": "meme/utility",
  "project_description": "60 chars max description",
  "project_summary": "75 word summary of the project",
  "technical_assessment": "2-3 sentences about website build quality",
  "ssr_csr_classification": "SSR or CSR"${contractAddress ? `,
  "contract_verification": {
    "found_on_site": true/false,
    "note": "where/how found or why not found"
  }` : ''},
  "signals_found": [
    {
      "signal": "specific discovery EXACTLY as found",
      "location": "where on site found (homepage/docs/footer/etc)",
      "context": "surrounding information that provides context",
      "importance": "why this matters",
      "success_indicator": "how strongly this predicts breakout potential",
      "category": "social_media/partnership/investment/technical/community/team/exchange/documentation/product/other",
      "similar_to": "successful project this reminds you of"
    }
  ],
  "red_flags": [
    {
      "flag": "concern if any",
      "severity": "high/medium/low"
    }
  ],
  "selected_stage_2_links": [
    {
      "url": "link url",
      "reasoning": "why this link is important"
    }
  ]
}

HTML: ${html}`;

    console.log(`📏 Minimal prompt length: ${prompt.length} chars`);

    // Step 3: Call AI with minimal prompt
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

    const aiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 15000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const aiContent = aiResult.choices[0].message.content.trim();
    console.log(`🤖 AI response: ${aiContent.substring(0, 200)}...`);

    // Step 4: Parse AI response
    let parsedData = null;
    
    try {
      // Remove markdown blocks if present
      const cleanContent = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedData = JSON.parse(cleanContent);
      
      console.log(`✅ Successfully extracted ALL fields:`);
      console.log(`🌐 Status: ${parsedData.website_status}`);
      console.log(`🎭 Type: ${parsedData.token_type}`);
      console.log(`📝 Description: ${parsedData.project_description}`);
      console.log(`📄 Summary: ${parsedData.project_summary?.substring(0, 50)}...`);
      console.log(`🔧 Tech: ${parsedData.technical_assessment?.substring(0, 50)}...`);
      console.log(`📊 SSR/CSR: ${parsedData.ssr_csr_classification}`);
      console.log(`🎯 Signals: ${parsedData.signals_found?.length || 0} found`);
      console.log(`🚩 Red flags: ${parsedData.red_flags?.length || 0} found`);
      console.log(`🔗 Stage 2 links: ${parsedData.selected_stage_2_links?.length || 0} selected`);
      
      if (contractAddress && parsedData.contract_verification) {
        console.log(`📜 Contract: ${parsedData.contract_verification.found_on_site ? '✅ Found' : '❌ Not found'}`);
      }
    } catch (e) {
      console.error(`❌ Failed to parse AI response: ${e}`);
      return new Response(
        JSON.stringify({
          success: false,
          function: 'website-analyzer-v2',
          symbol,
          websiteUrl,
          error: 'Failed to parse AI response',
          parse_error: e.message,
          ai_raw_response: aiContent
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Step 5: Store in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: insertData, error: dbError } = await supabase
      .from('crypto_projects_rated')
      .insert({
        symbol: symbol,
        website_url: websiteUrl,
        website_status: parsedData.website_status,
        token_type: parsedData.token_type,
        one_liner: parsedData.project_description,  // Maps to project_description from AI
        project_summary_rich: parsedData.project_summary,
        technical_assessment: parsedData.technical_assessment,
        ssr_csr_classification: parsedData.ssr_csr_classification,
        signals_found: parsedData.signals_found,
        red_flags: parsedData.red_flags,
        stage_2_links: parsedData.selected_stage_2_links,  // Maps to selected_stage_2_links from AI
        contract_verification: parsedData.contract_verification,
        contract_address: contractAddress || 'pending',  // Default if not provided
        network: network || 'unknown',  // Default if not provided
        extraction_status: 'completed',  // Mark Phase 1 as completed
        extraction_completed_at: new Date().toISOString()
      })
      .select();

    if (dbError) {
      console.error(`❌ Database error: ${dbError.message}`);
    }

    // Step 6: Return comprehensive results matching original structure
    const totalDuration = Date.now() - startTime;
    
    const responseData = {
      success: true,
      function: 'website-analyzer-v2',
      test_type: 'phase1_full_analysis_with_stage2_links',
      phase: 1,
      symbol,
      websiteUrl,
      html_length: html.length,
      website_status: parsedData.website_status,
      token_type: parsedData.token_type,
      project_description: parsedData.project_description,
      project_summary: parsedData.project_summary,
      technical_assessment: parsedData.technical_assessment,
      ssr_csr_classification: parsedData.ssr_csr_classification,
      signals_found: parsedData.signals_found,
      red_flags: parsedData.red_flags,
      selected_stage_2_links: parsedData.selected_stage_2_links,
      contract_verification: parsedData.contract_verification,
      counts: {
        signals: parsedData.signals_found?.length || 0,
        red_flags: parsedData.red_flags?.length || 0,
        stage_2_links: parsedData.selected_stage_2_links?.length || 0
      },
      total_duration_ms: totalDuration,
      database_storage: {
        attempted: true,
        success: !dbError,
        error: dbError?.message || null,
        record_id: insertData?.[0]?.id || null
      }
    };
    
    console.log(`🎯 Phase 1 completed in ${totalDuration}ms`);
    
    // Auto-trigger Phase 2 if database insert was successful
    const projectId = insertData?.[0]?.id;
    if (projectId && !dbError) {
      console.log(`Phase 1 complete. Auto-triggering Phase 2 for ${symbol}...`);
      
      // Small delay to ensure Phase 1 data is committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const phase2Response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/website-analyzer-v2`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phase: 2,
            projectId,
            symbol
          })
        });
        
        if (!phase2Response.ok) {
          const errorText = await phase2Response.text();
          console.error(`Phase 2 auto-trigger failed for ${symbol}: ${phase2Response.status} - ${errorText}`);
        } else {
          const result = await phase2Response.json();
          console.log(`✅ Phase 2 auto-triggered successfully for ${symbol}: Tier ${result.final_tier} (${result.tier_name}), Score ${result.final_score}`);
          // Add Phase 2 results to the response
          responseData.phase2_triggered = true;
          responseData.phase2_tier = result.final_tier;
          responseData.phase2_score = result.final_score;
        }
      } catch (error) {
        console.error(`Error auto-triggering Phase 2 for ${symbol}:`, error);
        // Don't fail Phase 1 if Phase 2 fails
        responseData.phase2_error = error.message;
      }
    }
    
    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ Error in website-analyzer-v2: ${error}`);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ 
          success: false,
          function: 'website-analyzer-v2',
          test_type: 'phase1_full_analysis_with_stage2_links',
          phase: 1,
          error: 'AI analysis timeout after 3 minutes',
          timeout: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 504 }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        function: 'website-analyzer-v2',
        test_type: 'phase1_full_analysis_with_stage2_links',
        phase: 1,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});