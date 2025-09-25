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
    const startTime = Date.now();
    const { websiteUrl, symbol, contractAddress } = await req.json();
    
    if (!websiteUrl || !symbol) {
      return new Response(
        JSON.stringify({ 
          success: false,
          function: 'testest',
          test_type: 'phase1_full_analysis_with_stage2_links',
          phase: 1,
          error: 'Missing websiteUrl or symbol' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`🚀 TESTEST: Starting minimal analysis for ${symbol} - ${websiteUrl}`);

    // Step 1: Fetch the website HTML
    const fetchResponse = await fetch(websiteUrl);
    
    if (!fetchResponse.ok) {
      console.log(`⚠️ Website fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`);
      return new Response(
        JSON.stringify({
          success: false,
          function: 'testest',
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
        .from('crypto_projects_test')
        .insert({
          symbol: symbol,
          website_url: websiteUrl,
          needs_parsing: true,
          website_status: 'needs_parsing',
          test_analysis_data: {
            function: 'testest',
            html_length: html.length,
            threshold_exceeded: true,
            timestamp: new Date().toISOString()
          }
        })
        .select();
      
      const totalDuration = Date.now() - startTime;
      
      return new Response(
        JSON.stringify({
          success: true,
          function: 'testest',
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
          function: 'testest',
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
      .from('crypto_projects_test')
      .insert({
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
        test_analysis_data: {
          function: 'testest',
          test_type: 'full_implementation',
          all_fields_present: true,
          timestamp: new Date().toISOString()
        }
      })
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
          function: 'testest',
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