import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Function to scrape website using direct fetch() - COPIED FROM test-direct-fetch
async function directFetchWebsite(url: string) {
  try {
    console.log(`🌐 Direct fetch: ${url}`);
    
    const startTime = Date.now();
    
    // Direct fetch with proper headers to mimic a real browser (copied from test-direct-fetch)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    const endTime = Date.now();
    const fetchDuration = endTime - startTime;

    // Collect response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log(`📋 Response headers:`, headers);

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        html: '', 
        status: 'error', 
        reason: `Direct fetch failed: ${response.status} - ${errorText}`,
        fetchDuration,
        responseHeaders: headers
      };
    }

    const html = await response.text();
    console.log(`✅ Direct fetch successful: ${html.length} chars in ${fetchDuration}ms`);
    
    return { 
      html, 
      status: 'success', 
      fetchDuration,
      htmlLength: html.length,
      responseHeaders: headers
    };
  } catch (error) {
    console.error(`❌ Direct fetch error: ${error}`);
    return { 
      html: '', 
      status: 'error', 
      reason: `Direct fetch failed: ${error}`,
      fetchDuration: 0,
      responseHeaders: null
    };
  }
}

// Function to analyze website technical implementation and build quality - PHASE 1 COMPREHENSIVE ASSESSMENT + CONTRACT VERIFICATION + SIGNALS DETECTION + TOKEN TYPE + STAGE 2 LINKS
async function checkRenderingType(html: string, apiKey: string, contractAddress?: string): Promise<{isCSR: boolean | null, technicalAssessment: string | null, ssrCsrClassification: string | null, fullReasoning: string | null, contractVerification: any | null, signalsFound: any[] | null, redFlags: any[] | null, websiteStatus: string | null, tokenType: string | null, selectedStage2Links: any[] | null}> {
  try {
    console.log(`🤖 Analyzing website technical implementation for ${html.length} chars`);
    console.log(`🔑 Contract address provided: ${contractAddress ? 'YES' : 'NO'}`);
    
    const aiStartTime = Date.now();
    
    const contractVerificationSection = contractAddress ? `

CONTRACT VERIFICATION:
Search for this exact contract address: ${contractAddress}
Check everywhere - text, buttons, links, explorer URLs, hidden elements.` : '';
    
    console.log(`📝 Contract verification section: ${contractVerificationSection.length} chars`);

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

❌ RED FLAGS to spot:
- Generic template website
- No real team information
- Copy-pasted content
- Fake partnerships
- No technical documentation or code repositories

WEBSITE STATUS DETECTION:
- "dead": Parking pages, domain-for-sale, error pages, "coming soon", placeholder content
- "blocked": Instagram/social-only, access restricted, paywall
- "active": Real project website with actual content

If dead/blocked, stop analysis and return minimal response with website_status only.

DETERMINE TYPE:
Is this a meme token (focus on community/viral) or utility token (real use case)?

STAGE 2 LINK SELECTION:
Identify ALL links that would meaningfully help a crypto analyst deeply evaluate this project's legitimacy, technical substance, and real-world adoption.

Focus on links that prove the project is real and working, not just marketing pages. Include every link that adds unique analytical value - this could be 2 links for a simple project or 10+ for a complex ecosystem.

For each selected link, explain why it's essential for serious project evaluation.

Technical Assessment: 2-3 sentences describing how this website was built (platform/framework used, custom development vs template, professional vs amateur indicators, any scam/fake project red flags)
SSR/CSR Classification: SSR or CSR${contractVerificationSection}

PROJECT DESCRIPTION: Write a 60-character MAX description of what this project actually does. Be specific and factual, no marketing fluff.

CREATE PROJECT SUMMARY:
Write a 75-word description covering: What the project does, website quality, key discoveries, unique aspects.

Return detailed JSON (ALL FIELDS REQUIRED):
{
  "website_status": "active/dead/blocked",
  "token_type": "meme/utility",
  "technical_assessment": "2-3 sentences about website build quality",
  "ssr_csr_classification": "SSR or CSR"${contractAddress ? `,
  "contract_verification": {
    "found_on_site": true/false,
    "note": "where/how found or why not found"
  },` : ','}
  "signals_found": [
    {
      "signal": "PROJECT_DESCRIPTION",
      "location": "SPECIAL",
      "context": "60 chars MAX - what this project actually does",
      "importance": "REQUIRED",
      "success_indicator": "REQUIRED",
      "category": "product",
      "similar_to": "REQUIRED"
    },
    {
      "signal": "PROJECT_SUMMARY",
      "location": "SPECIAL",
      "context": "75-word overview of what the project does, website quality, key findings",
      "importance": "REQUIRED",
      "success_indicator": "REQUIRED",
      "category": "product",
      "similar_to": "REQUIRED"
    },
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
      "flag": "specific concern found",
      "severity": "high/medium/low",
      "evidence": "what proves this"
    }
  ],
  "selected_stage_2_links": [
    {
      "url": "complete-url",
      "reasoning": "why this link was selected for Stage 2 analysis - what valuable information it likely contains"
    }
  ]
}

HTML: ${html}`;

    console.log(`📏 Prompt constructed: ${prompt.length} total chars`);
    console.log(`🌐 HTML content: ${html.length} chars`);
    console.log(`🔑 API key available: ${apiKey ? 'YES' : 'NO'}`);
    console.log(`🚀 Making AI API call...`);

    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(120000), // 2 minute timeout for AI
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,  // Consistent responses
        max_tokens: 15000  // Reserve 15K for output, leaves ~241K for input
      })
    });

    const aiEndTime = Date.now();
    const aiDuration = aiEndTime - aiStartTime;
    
    console.log(`⏱️ AI call completed in ${aiDuration}ms`);
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ AI API error: ${response.status} - ${errorText}`);
      return null;
    }

    const result = await response.json();
    console.log(`📦 Response structure:`, {
      choices: result.choices?.length,
      usage: result.usage,
      model: result.model
    });
    
    const answer = result.choices[0].message.content.trim();
    
    console.log(`🤖 AI response in ${aiDuration}ms: "${answer.substring(0, 200)}..."`);
    console.log(`📏 AI response length: ${answer.length} chars`);
    
    // Try to parse JSON response first
    let parsedResponse = null;
    let technicalAssessment = null;
    let ssrCsrSection = null;
    let contractVerification = null;
    let signalsFound = null;
    let redFlags = null;
    let websiteStatus = null;
    let tokenType = null;
    let projectDescription = null;
    let projectSummary = null;
    let selectedStage2Links = null;
    
    try {
      console.log(`🔍 Looking for JSON in AI response...`);
      // Look for JSON in the response
      const jsonMatch = answer.match(/\{[\s\S]*\}/);
      console.log(`🎯 JSON match found: ${jsonMatch ? 'YES' : 'NO'}`);
      
      if (jsonMatch) {
        console.log(`📄 JSON string length: ${jsonMatch[0].length} chars`);
        console.log(`📄 JSON preview: ${jsonMatch[0].substring(0, 300)}...`);
        
        parsedResponse = JSON.parse(jsonMatch[0]);
        console.log(`🔧 Parsed JSON keys:`, Object.keys(parsedResponse));
        
        websiteStatus = parsedResponse.website_status || 'active';
        tokenType = parsedResponse.token_type || null;
        technicalAssessment = parsedResponse.technical_assessment;
        ssrCsrSection = parsedResponse.ssr_csr_classification;
        contractVerification = parsedResponse.contract_verification || null;
        signalsFound = parsedResponse.signals_found || [];
        redFlags = parsedResponse.red_flags || [];
        selectedStage2Links = parsedResponse.selected_stage_2_links || [];
        
        // Extract nested project description and summary from signals
        if (signalsFound && signalsFound.length > 0) {
          // Look for PROJECT_DESCRIPTION signal
          const descSignal = signalsFound.find(s => s.signal === 'PROJECT_DESCRIPTION');
          if (descSignal) {
            projectDescription = descSignal.context; // The 60-char description is in context field
            // Remove this special signal from the array
            signalsFound = signalsFound.filter(s => s.signal !== 'PROJECT_DESCRIPTION');
          }
          
          // Look for PROJECT_SUMMARY signal
          const summarySignal = signalsFound.find(s => s.signal === 'PROJECT_SUMMARY');
          if (summarySignal) {
            projectSummary = summarySignal.context; // The 75-word summary is in context field
            // Remove this special signal from the array
            signalsFound = signalsFound.filter(s => s.signal !== 'PROJECT_SUMMARY');
          }
        }
        
        console.log(`✅ Successfully parsed JSON response from AI`);
        console.log(`🌐 Website status: ${websiteStatus}`);
        console.log(`🎭 Token type: ${tokenType}`);
        console.log(`📝 Project description (from nested): ${projectDescription}`);
        console.log(`📄 Project summary (from nested): ${projectSummary ? projectSummary.substring(0, 50) + '...' : 'null'}`);
        console.log(`🎯 Signals found: ${signalsFound ? signalsFound.length : 'null'} (after removing special entries)`);
        console.log(`🚩 Red flags found: ${redFlags ? redFlags.length : 'null'}`);
        console.log(`🔗 Stage 2 links selected: ${selectedStage2Links ? selectedStage2Links.length : 'null'}`);
      } else {
        console.log(`❌ No JSON found in AI response`);
      }
    } catch (jsonError) {
      console.log(`⚠️ JSON parsing failed, falling back to text parsing: ${jsonError}`);
    }
    
    // Fallback to text parsing if JSON parsing failed
    if (!parsedResponse) {
      const assessmentMatch = answer.match(/Technical Assessment[:\s]*\n(.+?)(?=\n\nSSR\/CSR Classification|$)/is);
      const classificationMatch = answer.match(/SSR\/CSR Classification[:\s]*\n(.+?)(?=\n|$)/is);
      
      technicalAssessment = assessmentMatch ? assessmentMatch[1].trim() : null;
      ssrCsrSection = classificationMatch ? classificationMatch[1].trim() : null;
    }
    
    // Extract just SSR or CSR for boolean logic
    const classification = ssrCsrSection ? (ssrCsrSection.toUpperCase().includes('CSR') ? 'CSR' : 'SSR') : null;
    const isCSR = classification === 'CSR';
    
    if (contractVerification) {
      console.log(`🔍 Contract verification: ${contractVerification.found_on_site ? 'FOUND' : 'NOT FOUND'} - ${contractAddress}`);
      console.log(`🔍 AI note: "${contractVerification.note}"`);
    }
    
    console.log(`📝 Rendering type: ${isCSR ? 'CSR (needs browser)' : 'SSR (can analyze directly)'}`);
    console.log(`💭 Technical assessment: ${technicalAssessment?.substring(0, 100)}...`);
    
    return { 
      isCSR, 
      technicalAssessment, 
      ssrCsrClassification: ssrCsrSection,
      fullReasoning: answer,
      contractVerification,
      signalsFound,
      redFlags,
      websiteStatus,
      tokenType,
      projectDescription,
      projectSummary,
      selectedStage2Links,
    };
  } catch (error) {
    console.error(`❌ AI rendering type detection error: ${error}`);
    console.error(`❌ Error details: ${JSON.stringify({message: error.message, stack: error.stack, name: error.name})}`);
    return { isCSR: null, technicalAssessment: null, ssrCsrClassification: null, fullReasoning: null, contractVerification: null, signalsFound: null, redFlags: null, websiteStatus: null, tokenType: null, projectDescription: null, projectSummary: null, selectedStage2Links: null };
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables inside the function
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const KIMI_K2_API_KEY = Deno.env.get('KIMI_K2_API_KEY');
    
    if (!KIMI_K2_API_KEY) {
      throw new Error('KIMI_K2_API_KEY environment variable not found');
    }
    
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { websiteUrl, symbol, contractAddress } = await req.json();

    if (!websiteUrl || !symbol) {
      throw new Error('Missing required parameters: websiteUrl and symbol');
    }

    console.log(`🧪 PHASE 1 FULL ANALYSIS TEST - WEBSITE ANALYZER + SIGNALS + STAGE 2 LINKS: ${symbol} - ${websiteUrl}`);
    const totalStartTime = Date.now();

    // Step 1: Direct fetch website
    const fetchResult = await directFetchWebsite(websiteUrl);
    
    if (fetchResult.status !== 'success') {
      throw new Error(`Failed to fetch website: ${fetchResult.reason}`);
    }

    const html = fetchResult.html;
    
    // Step 2: 240K threshold check (key Phase 1 logic)
    console.log(`🔍 HTML length check: ${html.length} chars (threshold: 240,000)`);
    console.log(`🎯 Will use AI path: ${html.length <= 240000 ? 'YES' : 'NO'}`);
    
    let needsBrowserRendering: boolean | null = null;
    let technicalAssessment: string | null = null;
    let ssrCsrClassification: string | null = null;
    let aiReasoning: string | null = null;
    let contractVerification: any | null = null;
    let signalsFound: any[] | null = null;
    let redFlags: any[] | null = null;
    let websiteStatus: string | null = null;
    let tokenType: string | null = null;
    let projectDescription: string | null = null;
    let projectSummary: string | null = null;
    let selectedStage2Links: any[] | null = null;
    let allDiscoveredLinks: string[] | null = null;
    
    if (html.length > 240000) {
      console.log(`⚠️ Large HTML detected: ${html.length} chars - SKIPPING AI ANALYSIS`);
      // TODO: Phase 2 - implement parsing logic for large HTML
      needsBrowserRendering = null; // Skip AI for now on large HTML
      technicalAssessment = "Skipped - HTML too large (>240K chars)";
      ssrCsrClassification = "Skipped - HTML too large";
      aiReasoning = "Skipped AI analysis - HTML too large (>240K chars)";
    } else {
      console.log(`✅ Small HTML: ${html.length} chars - sending directly to AI`);
      console.log(`🚀 About to call checkRenderingType with contract: ${contractAddress || 'none'}`);
      
      // Step 3: Send to AI for comprehensive technical assessment + signals detection
      const renderingResult = await checkRenderingType(html, KIMI_K2_API_KEY, contractAddress);
      console.log(`📊 checkRenderingType completed, result:`, {
        isCSR: renderingResult?.isCSR,
        websiteStatus: renderingResult?.websiteStatus,
        tokenType: renderingResult?.tokenType,
        signalsCount: renderingResult?.signalsFound?.length || 0,
        redFlagsCount: renderingResult?.redFlags?.length || 0,
        linksCount: renderingResult?.selectedStage2Links?.length || 0,
        completed: true
      });
      
      websiteStatus = renderingResult?.websiteStatus ?? 'active';
      tokenType = renderingResult?.tokenType ?? null;
      projectDescription = renderingResult?.projectDescription ?? null;
      projectSummary = renderingResult?.projectSummary ?? null;
      needsBrowserRendering = renderingResult?.isCSR ?? null;
      technicalAssessment = renderingResult?.technicalAssessment ?? null;
      ssrCsrClassification = renderingResult?.ssrCsrClassification ?? null;
      aiReasoning = renderingResult?.fullReasoning ?? null;
      contractVerification = renderingResult?.contractVerification ?? null;
      signalsFound = renderingResult?.signalsFound ?? null;
      redFlags = renderingResult?.redFlags ?? null;
      selectedStage2Links = renderingResult?.selectedStage2Links ?? null;
      allDiscoveredLinks = renderingResult?.allDiscoveredLinks ?? null;
      
    }
    
    const totalEndTime = Date.now();
    const totalDuration = totalEndTime - totalStartTime;
    
    // Step 4: Check for dead/blocked website status
    if (websiteStatus === 'dead' || websiteStatus === 'blocked') {
      console.log(`🚫 Website detected as ${websiteStatus} - ending analysis`);
      
      const deadRecord = {
        symbol: symbol,
        website_url: websiteUrl,
        scraped_html_temp: html,
        needs_browser_rendering: null,
        technical_assessment: null,
        ssr_csr_classification: null,
        ai_reasoning: aiReasoning,
        signals_found: null,
        red_flags: null,
        token_type: tokenType,
        test_analysis_data: {
          test_type: 'dead_site_detection',
          phase: 1,
          fetch_status: fetchResult.status,
          fetch_duration_ms: fetchResult.fetchDuration,
          html_length: fetchResult.htmlLength,
          website_status: websiteStatus,
          total_duration_ms: totalDuration,
          tested_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      };

      const { data: deadData, error: deadError } = await supabase
        .from('crypto_projects_test')
        .insert(deadRecord)
        .select();

      if (deadError) {
        console.error(`Failed to store dead site results: ${deadError.message}`);
      } else {
        console.log(`✅ Dead/blocked site results stored with ID: ${deadData?.[0]?.id}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          test_type: 'dead_site_detection',
          phase: 1,
          symbol,
          websiteUrl,
          website_status: websiteStatus,
          extraction_complete: false,
          message: `Website is ${websiteStatus} - no further analysis possible`,
          total_duration_ms: totalDuration,
          database_storage: {
            attempted: true,
            success: !deadError,
            error: deadError?.message || null,
            record_id: deadData?.[0]?.id || null
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }
    
    // Step 5: Store results in database
    const testRecord = {
      symbol: symbol,
      website_url: websiteUrl,
      project_description: projectDescription,
      project_summary_rich: projectSummary,
      scraped_html_temp: html,
      needs_browser_rendering: needsBrowserRendering,
      technical_assessment: technicalAssessment,
      ssr_csr_classification: ssrCsrClassification,
      ai_reasoning: aiReasoning,
      signals_found: signalsFound,
      red_flags: redFlags,
      token_type: tokenType,
      stage_2_links: selectedStage2Links,
      test_analysis_data: {
        test_type: 'phase1_full_analysis_with_stage2_links',
        phase: 1,
        fetch_status: fetchResult.status,
        fetch_duration_ms: fetchResult.fetchDuration,
        html_length: fetchResult.htmlLength,
        html_over_240k: html.length > 240000,
        ai_checked: needsBrowserRendering !== null,
        website_status: websiteStatus,
        token_type: tokenType,
        project_description: projectDescription,
        rendering_type: needsBrowserRendering === null ? null : (needsBrowserRendering ? 'CSR' : 'SSR'),
        needs_browser_rendering: needsBrowserRendering,
        contract_address: contractAddress || null,
        contract_verification: contractVerification,
        signals_found: signalsFound,
        red_flags: redFlags,
        selected_stage_2_links: selectedStage2Links,
        signals_count: signalsFound?.length || 0,
        red_flags_count: redFlags?.length || 0,
        stage_2_links_count: selectedStage2Links?.length || 0,
        total_duration_ms: totalDuration,
        response_headers: fetchResult.responseHeaders,
        tested_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('crypto_projects_test')
      .insert(testRecord)
      .select();

    if (insertError) {
      console.error(`Failed to store test results: ${insertError.message}`);
    } else {
      console.log(`✅ Phase 1 results stored with ID: ${insertData?.[0]?.id}`);
    }

    // Return Phase 1 test results
    const responseData = {
      success: true,
      test_type: 'phase1_full_analysis_with_stage2_links',
      phase: 1,
      symbol,
      websiteUrl,
      contractAddress: contractAddress || null,
      fetch_duration_ms: fetchResult.fetchDuration,
      html_length: fetchResult.htmlLength,
      html_over_240k: html.length > 240000,
      ai_checked: needsBrowserRendering !== null,
      website_status: websiteStatus,
      token_type: tokenType,
      project_description: projectDescription,
      project_summary_rich: projectSummary,
      rendering_type: needsBrowserRendering === null ? null : (needsBrowserRendering ? 'CSR' : 'SSR'),
      needs_browser_rendering: needsBrowserRendering,
      technical_assessment: technicalAssessment,
      ssr_csr_classification: ssrCsrClassification,
      ai_reasoning: aiReasoning,
      contract_verification: contractVerification,
      signals_found: signalsFound,
      red_flags: redFlags,
      stage_2_links: selectedStage2Links,
      signals_count: signalsFound?.length || 0,
      red_flags_count: redFlags?.length || 0,
      stage_2_links_count: selectedStage2Links?.length || 0,
      total_duration_ms: totalDuration,
      database_storage: {
        attempted: true,
        success: !insertError,
        error: insertError?.message || null,
        record_id: insertData?.[0]?.id || null
      }
    };
    
    console.log(`🎯 Phase 1 completed in ${totalDuration}ms`);
    
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Error in website-analyzer-test:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        test_type: 'phase1_full_analysis_with_stage2_links',
        phase: 1,
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});