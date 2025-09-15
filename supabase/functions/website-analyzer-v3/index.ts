import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse large HTML to extract visible content while preserving basic structure
function parseAndSimplifyHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    
    // Remove all non-content elements
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('svg').remove();
    $('img').remove();
    $('link').remove();
    $('meta').remove();
    $('iframe').remove();
    $('video').remove();
    $('audio').remove();
    $('canvas').remove();
    $('embed').remove();
    $('object').remove();
    $('source').remove();
    
    // Remove all comments
    $('*').contents().each(function() {
      if (this.type === 'comment') {
        $(this).remove();
      }
    });
    
    // Strip all attributes except href on links
    $('*').each(function() {
      const elem = $(this);
      const tagName = this.name;
      const attributes = this.attribs || {};
      
      // Remove all attributes
      for (const attr in attributes) {
        if (tagName === 'a' && attr === 'href') {
          // Keep href on links
          continue;
        }
        elem.removeAttr(attr);
      }
    });
    
    // Get the simplified HTML
    let simplifiedHTML = $.html();
    
    // Additional cleanup: remove empty tags and excessive whitespace
    simplifiedHTML = simplifiedHTML
      .replace(/<(\w+)>\s*<\/\1>/g, '') // Remove empty tags
      .replace(/\n\s*\n/g, '\n') // Remove multiple blank lines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return simplifiedHTML;
  } catch (error) {
    console.error('HTML parsing error:', error);
    // If parsing fails, return truncated original
    return html.substring(0, 240000);
  }
}

// Function for Phase 2: Bottom-up tier comparison
async function compareWithBenchmarks(signals: any[], benchmarks: any[], symbol: string) {
  const COMPARISON_PROMPT = `Evaluate extracted signals using BOTTOM-UP tier assignment.

TIER BENCHMARKS:
${JSON.stringify(benchmarks, null, 2)}

EXTRACTED SIGNALS:
${JSON.stringify(signals, null, 2)}

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

  try {
    const apiKey = Deno.env.get('KIMI_K2_API_KEY');
    if (!apiKey) {
      throw new Error('KIMI_K2_API_KEY not configured');
    }

    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [{ role: 'user', content: COMPARISON_PROMPT }],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanContent);
    
    console.log(`Phase 2 comparison complete: Tier ${result.final_tier} (${result.tier_name}) - Score ${result.final_score}`);
    
    return result;
  } catch (error) {
    console.error(`Phase 2 comparison error: ${error}`);
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
      phase = 1,
      projectId,
      contractAddress,
      network,
      websiteUrl,
      symbol,
      source
    } = await req.json();
    
    // Phase 2: Benchmark comparison and scoring
    if (phase === 2) {
      if (!projectId) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Phase 2 requires projectId'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log(`📊 Phase 2: Starting benchmark comparison for ${symbol} (Project ID: ${projectId})`);
      
      // Get project data and signals
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: project, error: fetchError } = await supabase
        .from('crypto_projects_rated')
        .select('signals_found')
        .eq('id', projectId)
        .single();
      
      if (fetchError || !project) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Failed to fetch project: ${fetchError?.message || 'Not found'}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Load benchmarks
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
      
      // Run Phase 2 comparison using AI
      const comparison = await compareWithBenchmarks(
        project.signals_found || [],
        benchmarks,
        symbol
      );
      
      // Update database with Phase 2 results
      const { error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update({
          website_stage1_score: comparison.final_score,
          website_stage1_tier: comparison.tier_name,
          website_stage1_analysis: {
            final_tier: comparison.final_tier,
            tier_name: comparison.tier_name,
            final_score: comparison.final_score,
            strongest_signal: comparison.strongest_signal,
            signal_evaluations: comparison.signal_evaluations,
            explanation: comparison.explanation,
            completed_at: new Date().toISOString()
          }
        })
        .eq('id', projectId);
      
      if (updateError) {
        console.error(`Failed to update Phase 2 results: ${updateError.message}`);
      }
      
      console.log(`✅ Phase 2 completed: ${comparison.tier_name} (Score: ${comparison.final_score})`);
      
      return new Response(
        JSON.stringify({
          success: true,
          phase: 2,
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
    
    // Phase 1: Website analysis
    if (!websiteUrl || !symbol) {
      return new Response(
        JSON.stringify({ 
          success: false,
          function: 'website-analyzer-v3',
          test_type: 'phase1_full_analysis_with_stage2_links',
          phase: 1,
          error: 'Missing websiteUrl or symbol' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`🚀 Website Analyzer V2: Starting Phase ${phase} for ${symbol} - ${websiteUrl || 'Phase 2'}`);

    // Step 1: Fetch the website HTML
    const fetchResponse = await fetch(websiteUrl);
    
    if (!fetchResponse.ok) {
      console.log(`⚠️ Website fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`);
      return new Response(
        JSON.stringify({
          success: false,
          function: 'website-analyzer-v3',
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
    
    let html = await fetchResponse.text();
    const originalLength = html.length;
    console.log(`📄 Fetched ${originalLength} chars of raw HTML`);

    // Check 240K threshold and parse if needed
    let wasParsed = false;
    let parsingNote = '';
    
    if (html.length > 240000) {
      console.log(`⚠️ HTML too large: ${html.length} chars > 240K threshold - applying parser`);
      
      // Parse the HTML to extract content
      const parsedHTML = parseAndSimplifyHTML(html);
      const parsedLength = parsedHTML.length;
      
      console.log(`✅ Parsed HTML: ${originalLength} chars → ${parsedLength} chars (${Math.round(parsedLength/originalLength*100)}% of original)`);
      
      // Check if parsed version is still too large
      if (parsedLength > 240000) {
        console.log(`❌ Even after parsing, HTML is still too large: ${parsedLength} chars`);
        
        // Store error in database
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        const { data: insertData, error: dbError } = await supabase
          .from('crypto_projects_test')
          .insert({
            symbol: symbol,
            website_url: websiteUrl,
            needs_parsing: true,
            website_status: 'failed_parsing_still_too_large',
            contract_address: contractAddress || 'pending',
            network: network || 'unknown',
            original_html_length: originalLength,
            parsed_html_length: parsedLength
          })
          .select();
        
        const totalDuration = Date.now() - startTime;
        
        return new Response(
          JSON.stringify({
            success: false,
            function: 'website-analyzer-v3',
            test_type: 'phase1_full_analysis_with_stage2_links',
            phase: 1,
            symbol,
            websiteUrl,
            parsing_attempted: true,
            original_length: originalLength,
            parsed_length: parsedLength,
            threshold: 240000,
            total_duration_ms: totalDuration,
            error: 'HTML still too large after parsing',
            message: 'Website content exceeds processing limits even after simplification'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Use parsed HTML and add context note
      html = parsedHTML;
      wasParsed = true;
      parsingNote = `NOTE: This HTML was preprocessed due to size (original: ${Math.round(originalLength/1024)}KB). All visible text content is preserved but scripts, styles, and attributes have been removed. Structure is simplified to semantic tags only. Framework detection may be limited.\n\n`;
    }

    // Step 2: Create prompt with ALL 9 fields + complex instructions
    // Add parsing note if HTML was parsed
    const htmlForAnalysis = wasParsed ? parsingNote + html : html;
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
  "technical_assessment": "4-5 sentences: First describe the technical implementation (framework, SSR/CSR, responsiveness, performance). Then assess WHO likely built this (amateur solo, mid-tier agency, elite team) and EFFORT level (weekend project vs months of polish). Estimate implied INVESTMENT based on execution quality ($1K template vs $50K professional vs $100K+ enterprise). Finally, evaluate if the content and claimed innovations appear genuine or AI-generated, and explain your reasoning.",
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

HTML: ${htmlForAnalysis}`;

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
          function: 'website-analyzer-v3',
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
      .update({
        symbol: symbol,
        website_url: websiteUrl,
        website_status: parsedData.website_status,
        token_type: parsedData.token_type,
        one_liner: parsedData.project_description,  // Changed from project_description
        project_summary_rich: parsedData.project_summary,
        technical_assessment: parsedData.technical_assessment,
        ssr_csr_classification: parsedData.ssr_csr_classification,
        signals_found: parsedData.signals_found,
        red_flags: parsedData.red_flags,
        stage_2_links: parsedData.selected_stage_2_links,  // Changed from selected_stage_2_links
        contract_verification: parsedData.contract_verification,
        contract_address: contractAddress || 'pending',
        network: network || 'unknown',
        extraction_status: 'completed',
        extraction_completed_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select();

    if (dbError) {
      console.error(`❌ Database error: ${dbError.message}`);
    }

    // Step 6: Return comprehensive results matching original structure
    const totalDuration = Date.now() - startTime;
    
    const responseData = {
      success: true,
      function: 'testest',
      test_type: 'phase1_full_analysis_with_stage2_links',
      phase: 1,
      symbol,
      websiteUrl,
      html_length: wasParsed ? originalLength : html.length,
      parsed_html_length: wasParsed ? html.length : undefined,
      was_parsed: wasParsed,
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
    
    // Auto-trigger Phase 2 if Phase 1 was successful and we have a project ID
    if (projectId && !dbError) {
      console.log(`🚀 Auto-triggering Phase 2 for project ${projectId}`);
      
      // Small delay to ensure Phase 1 data is committed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const phase2Response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/website-analyzer-v3`, {
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
          console.error(`Phase 2 trigger failed: ${errorText}`);
        } else {
          const phase2Result = await phase2Response.json();
          console.log(`✅ Phase 2 triggered successfully: ${phase2Result.tier_name} (${phase2Result.final_score})`);
          
          // Add Phase 2 results to the response
          responseData.phase2_triggered = true;
          responseData.phase2_result = {
            tier: phase2Result.tier_name,
            score: phase2Result.final_score
          };
        }
      } catch (error) {
        console.error(`Failed to trigger Phase 2: ${error}`);
        responseData.phase2_triggered = false;
        responseData.phase2_error = error.message;
      }
    }
    
    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`❌ Error in testest: ${error}`);
    
    // Handle timeout specifically
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ 
          success: false,
          function: 'website-analyzer-v3',
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
        function: 'testest',
        test_type: 'phase1_full_analysis_with_stage2_links',
        phase: 1,
        error: error.message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});