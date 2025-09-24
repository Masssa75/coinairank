import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

// Prompt version for tracking changes
const PROMPT_VERSION = 'v3.3.0-categorized-resources';

// Helper function to extract Twitter handle from URL
function extractTwitterHandle(twitterUrl: string | null): string | null {
  if (!twitterUrl) return null;

  const patterns = [
    /twitter\.com\/([^\/\?]+)/i,
    /x\.com\/([^\/\?]+)/i,
    /@([^\/\s]+)/
  ];

  for (const pattern of patterns) {
    const match = twitterUrl.match(pattern);
    if (match && match[1]) {
      return match[1].replace('@', '');
    }
  }

  // If no pattern matches, try using it directly if it looks like a handle
  if (!twitterUrl.includes('/') && !twitterUrl.includes('.')) {
    return twitterUrl.replace('@', '');
  }

  return null;
}

// Trigger follow-up analyses after website analysis completes
async function triggerFollowUpAnalyses(projectId: number, symbol: string, supabase: any) {
  try {
    // Get the project's URLs
    const { data: project, error } = await supabase
      .from('crypto_projects_rated')
      .select('twitter_url, whitepaper_url, x_analyzed_at, whitepaper_analysis')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      console.log(`Could not fetch project data for follow-up analysis: ${error?.message}`);
      return;
    }

    // Trigger X analysis if we have a Twitter URL and haven't analyzed yet
    if (project.twitter_url && !project.x_analyzed_at) {
      const handle = extractTwitterHandle(project.twitter_url);
      if (handle) {
        console.log(`🐦 Triggering X analysis for @${handle}`);

        try {
          const xResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/x-signal-analyzer-v3`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'analyze',
              symbol,
              handle,
              projectId
            })
          });

          if (!xResponse.ok) {
            const errorText = await xResponse.text();
            console.error(`❌ X analysis trigger failed with ${xResponse.status}: ${errorText}`);
          } else {
            console.log(`✅ X analysis triggered successfully for @${handle}`);
          }
        } catch (error) {
          console.error('❌ Failed to trigger X analysis:', error);
        }
      } else {
        console.log(`⚠️ Could not extract Twitter handle from: ${project.twitter_url}`);
      }
    }

    // Trigger whitepaper analysis if we have a URL and haven't analyzed yet
    if (project.whitepaper_url && !project.whitepaper_analysis) {
      console.log(`📄 Triggering whitepaper analysis for ${symbol}`);

      try {
        const wpResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whitepaper-fetcher`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            whitepaperUrl: project.whitepaper_url,
            symbol: symbol
          })
        });

        if (!wpResponse.ok) {
          const errorText = await wpResponse.text();
          console.error(`❌ Whitepaper analysis trigger failed with ${wpResponse.status}: ${errorText}`);
        } else {
          console.log(`✅ Whitepaper analysis triggered successfully for ${symbol}`);
        }
      } catch (error) {
        console.error('❌ Failed to trigger whitepaper analysis:', error);
      }
    }

  } catch (error) {
    console.error('Error triggering follow-up analyses:', error);
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fetch website with Browserless.io for full JavaScript rendering
async function fetchWithBrowserless(url: string): Promise<string> {
  const apiKey = Deno.env.get('BROWSERLESS_API_KEY');
  if (!apiKey) {
    throw new Error('BROWSERLESS_API_KEY not configured');
  }

  console.log('🌐 Connecting to Browserless.io...');

  try {
    // Use Browserless.io's content endpoint - simpler and returns HTML directly
    const browserlessUrl = `https://production-sfo.browserless.io/content?token=${apiKey}`;

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        waitForSelector: {
          selector: 'body',
          timeout: 30000
        },
        waitForTimeout: 3000  // Wait 3 seconds after selector for dynamic content
      }),
      signal: AbortSignal.timeout(60000) // 60 second timeout for the fetch itself
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Browserless response: ${errorText}`);
      throw new Error(`Browserless API error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`✅ Browserless fetch successful: ${html.length} chars`);
    return html;
  } catch (error) {
    console.error(`❌ Browserless fetch failed: ${error.message}`);
    throw error;
  }
}

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
          },
          // Update comparison status fields that frontend progress tracker checks
          comparison_status: 'completed',
          comparison_completed_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      if (updateError) {
        console.error(`Failed to update Phase 2 results: ${updateError.message}`);
      }
      
      console.log(`✅ Phase 2 completed: ${comparison.tier_name} (Score: ${comparison.final_score})`);

      // Trigger X and whitepaper analysis now that website analysis is complete
      await triggerFollowUpAnalyses(projectId, symbol, supabase);

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

    // Step 0.5: Fetch CoinGecko links if project exists
    let coingeckoLinks = null;
    if (projectId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: projectData, error: fetchError } = await supabase
        .from('crypto_projects_rated')
        .select('whitepaper_url, github_url, docs_url, links_source')
        .eq('id', projectId)
        .single();

      if (!fetchError && projectData) {
        if (projectData.whitepaper_url || projectData.github_url || projectData.docs_url) {
          coingeckoLinks = {
            whitepaper: projectData.whitepaper_url,
            github: projectData.github_url,
            docs: projectData.docs_url,
            source: projectData.links_source
          };
          console.log(`📎 Found stored links for project ${projectId}:`);
          console.log(`  Whitepaper: ${coingeckoLinks.whitepaper || 'Not found'}`);
          console.log(`  GitHub: ${coingeckoLinks.github || 'Not found'}`);
          console.log(`  Docs: ${coingeckoLinks.docs || 'Not found'}`);
          console.log(`  Source: ${coingeckoLinks.source || 'unknown'}`);
        } else {
          console.log(`📎 No stored links found for project ${projectId}`);
        }
      } else {
        console.log(`⚠️ Error fetching project data: ${fetchError?.message || 'Unknown error'}`);
      }
    }

    // Step 1: Fetch the website HTML with proper headers and timeout
    let fetchResponse;
    try {
      fetchResponse = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
    } catch (fetchError: any) {
      console.log(`⚠️ Website fetch error: ${fetchError?.message || 'Unknown error'}`);
      return new Response(
        JSON.stringify({
          success: false,
          function: 'website-analyzer-v3',
          test_type: 'phase1_full_analysis_with_stage2_links',
          phase: 1,
          symbol,
          websiteUrl,
          error: `Website fetch failed: ${fetchError?.message || 'Unknown error'}`,
          timeout: fetchError?.name === 'AbortError'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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
    const prompt = `[PROMPT VERSION: ${PROMPT_VERSION}]

You are an expert crypto analyst specializing in identifying high-potential projects through website analysis.

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

RESOURCE EXTRACTION:
Identify and categorize critical resources for deeper analysis:
1. WHITEPAPER - Technical document explaining tokenomics, consensus, architecture
2. GITHUB - Main code repository showing development activity
3. DOCUMENTATION - Technical docs, API docs, or developer guides
4. SOCIAL CHANNELS - Twitter, Discord, Telegram for community assessment
5. OTHER CRITICAL - Any unique resources crucial for understanding this specific project
   (e.g., research papers, audit reports, partnership pages, roadmap)

For each link found, specify its category.

Technical Assessment: 2-3 sentences describing how this website was built
SSR/CSR Classification: SSR (content visible without JavaScript) or CSR (requires JavaScript for content)
Browser Rendering Check: Does this website need browser rendering to access its full navigation and content? Provide both decision and reasoning.${contractAddress ? `

CONTRACT VERIFICATION:${contractAddress.startsWith('native:') ? `
This is a native L1 blockchain token (${contractAddress}).
Native tokens don't have contract addresses since they're the base currency of their blockchain.
Mark as verified if this is clearly the official website for the L1 blockchain mentioned.` : `
Search the HTML for this contract address: ${contractAddress}
Check if it appears anywhere on the website (footer, docs, token info, etc.)`}` : ''}

PROJECT DESCRIPTION: Write a 60-character MAX description of what this project actually does. Be specific and factual, no marketing fluff.

CREATE PROJECT SUMMARY:
Write a 75-word description covering: What the project does, website quality, key discoveries, unique aspects.

Return JSON:
{
  "prompt_version": "${PROMPT_VERSION}",
  "website_status": "active/dead/blocked",
  "token_type": "meme/utility",
  "project_description": "60 chars max description",
  "project_summary": "75 word summary of the project",
  "technical_assessment": "4-5 sentences: First describe the technical implementation (framework, SSR/CSR, responsiveness, performance). Then assess WHO likely built this (amateur solo, mid-tier agency, elite team) and EFFORT level (weekend project vs months of polish). Estimate implied INVESTMENT based on execution quality ($1K template vs $50K professional vs $100K+ enterprise). Finally, evaluate if the content and claimed innovations appear genuine or AI-generated, and explain your reasoning.",
  "ssr_csr_classification": "SSR or CSR",
  "needs_browser_rendering": {
    "decision": "NEEDS_BROWSER or STATIC_SUFFICIENT",
    "reasoning": "1-2 sentences explaining why browser rendering is/isn't needed based on what you observed in the HTML"
  }${contractAddress ? `,
  "contract_verification": {
    "found_on_site": true/false,
    "note": "${contractAddress.startsWith('native:') ? 'Native L1 token - verified if official blockchain website' : 'where/how found or why not found'}"
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
  "extracted_resources": [
    {
      "url": "resource url",
      "category": "whitepaper|github|docs|twitter|discord|telegram|other",
      "reasoning": "why this resource is important for analysis"
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
    let browserRenderAttempted = false;
    let browserRenderError = null;

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
      console.log(`🌐 Browser Rendering: ${parsedData.needs_browser_rendering?.decision} - ${parsedData.needs_browser_rendering?.reasoning?.substring(0, 50)}...`);
      console.log(`🎯 Signals: ${parsedData.signals_found?.length || 0} found`);
      console.log(`🚩 Red flags: ${parsedData.red_flags?.length || 0} found`);
      console.log(`🔗 Extracted resources: ${parsedData.extracted_resources?.length || 0} found`);
      
      if (contractAddress && parsedData.contract_verification) {
        console.log(`📜 Contract: ${parsedData.contract_verification.found_on_site ? '✅ Found' : '❌ Not found'}`);
      }

      // Step 4.5: Check if browser rendering is needed
      if (parsedData.needs_browser_rendering?.decision === 'NEEDS_BROWSER') {
        console.log('🌐 Browser rendering needed - attempting with Browserless.io...');
        browserRenderAttempted = true;

        try {
          // Fetch with browser rendering
          const browserHtml = await fetchWithBrowserless(websiteUrl);
          const browserHtmlLength = browserHtml.length;
          console.log(`📄 Browser-rendered HTML: ${browserHtmlLength} chars`);

          // Apply same parsing logic if needed
          let htmlForBrowserAnalysis = browserHtml;
          let browserWasParsed = false;
          let browserParsingNote = '';

          if (browserHtml.length > 240000) {
            console.log(`⚠️ Browser HTML too large: ${browserHtml.length} chars > 240K threshold - applying parser`);

            const parsedBrowserHTML = parseAndSimplifyHTML(browserHtml);
            const parsedBrowserLength = parsedBrowserHTML.length;

            console.log(`✅ Parsed browser HTML: ${browserHtmlLength} chars → ${parsedBrowserLength} chars (${Math.round(parsedBrowserLength/browserHtmlLength*100)}% of original)`);

            if (parsedBrowserLength > 240000) {
              console.log(`❌ Even after parsing, browser HTML is still too large: ${parsedBrowserLength} chars`);
              // Still use it but note the issue
              browserRenderError = `Browser HTML too large even after parsing: ${parsedBrowserLength} chars`;
            }

            htmlForBrowserAnalysis = parsedBrowserHTML;
            browserWasParsed = true;
            browserParsingNote = `NOTE: This HTML was preprocessed due to size (original: ${Math.round(browserHtmlLength/1024)}KB). All visible text content is preserved but scripts, styles, and attributes have been removed. Structure is simplified to semantic tags only. Framework detection may be limited.\n\n`;
          }

          // Add parsing note if HTML was parsed
          const browserHtmlWithNote = browserWasParsed ? browserParsingNote + htmlForBrowserAnalysis : htmlForBrowserAnalysis;

          // Re-run the FULL analysis with browser-rendered HTML
          console.log('🤖 Re-analyzing with browser-rendered content...');

          const browserAiResponse = await fetch('https://api.moonshot.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'kimi-k2-0905-preview',
              messages: [{ role: 'user', content: prompt.replace(htmlForAnalysis, browserHtmlWithNote) }],
              temperature: 0.1,
              max_tokens: 15000
            }),
            signal: controller.signal
          });

          if (!browserAiResponse.ok) {
            throw new Error(`AI API error for browser content: ${browserAiResponse.status}`);
          }

          const browserAiResult = await browserAiResponse.json();
          const browserAiContent = browserAiResult.choices[0].message.content.trim();

          // Parse the browser-based analysis
          const cleanBrowserContent = browserAiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const browserParsedData = JSON.parse(cleanBrowserContent);

          // Completely overwrite with browser results, but keep the original browser rendering decision
          const originalBrowserDecision = parsedData.needs_browser_rendering;
          parsedData = {
            ...browserParsedData,
            needs_browser_rendering: originalBrowserDecision, // Keep original reasoning
            browser_rendered: true,
            original_html_length: browserWasParsed ? browserHtmlLength : browserHtml.length,
            parsed_html_length: browserWasParsed ? htmlForBrowserAnalysis.length : null
          };

          console.log('✅ Successfully re-analyzed with browser-rendered content');
          console.log(`🌐 New signals found: ${parsedData.signals_found?.length || 0}`);
          console.log(`🔗 New Stage 2 links: ${parsedData.selected_stage_2_links?.length || 0}`);

        } catch (browserError) {
          console.error(`⚠️ Browser rendering failed, using original static results: ${browserError.message}`);
          browserRenderError = browserError.message;
          // Keep original parsedData, just add the error info
          parsedData.browser_render_attempted = true;
          parsedData.browser_render_error = browserRenderError;
        }
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

    // Step 4.5: Process extracted resources and populate dedicated fields
    let whitepaperUrl = null;
    let githubUrl = null;
    let docsUrl = null;
    const socialUrls = [];
    const importantResources = [];

    // First, process AI-extracted resources
    if (parsedData.extracted_resources) {
      for (const resource of parsedData.extracted_resources) {
        switch (resource.category) {
          case 'whitepaper':
            if (!whitepaperUrl) whitepaperUrl = resource.url;
            break;
          case 'github':
            if (!githubUrl) githubUrl = resource.url;
            break;
          case 'docs':
            if (!docsUrl) docsUrl = resource.url;
            break;
          case 'twitter':
          case 'discord':
          case 'telegram':
            socialUrls.push({
              url: resource.url,
              type: resource.category,
              reasoning: resource.reasoning
            });
            break;
          case 'other':
          default:
            importantResources.push({
              url: resource.url,
              reasoning: resource.reasoning
            });
            break;
        }
      }
    }

    // Then, merge CoinGecko links if not already found
    if (coingeckoLinks) {
      if (coingeckoLinks.whitepaper && !whitepaperUrl) {
        whitepaperUrl = coingeckoLinks.whitepaper;
        // Also add to extracted_resources for backwards compatibility
        if (!parsedData.extracted_resources) parsedData.extracted_resources = [];
        parsedData.extracted_resources.push({
          url: coingeckoLinks.whitepaper,
          category: 'whitepaper',
          reasoning: "Official whitepaper from CoinGecko"
        });
      }

      if (coingeckoLinks.github && !githubUrl) {
        githubUrl = coingeckoLinks.github;
        if (!parsedData.extracted_resources) parsedData.extracted_resources = [];
        parsedData.extracted_resources.push({
          url: coingeckoLinks.github,
          category: 'github',
          reasoning: "GitHub repository from CoinGecko"
        });
      }

      if (coingeckoLinks.docs && !docsUrl) {
        docsUrl = coingeckoLinks.docs;
        if (!parsedData.extracted_resources) parsedData.extracted_resources = [];
        parsedData.extracted_resources.push({
          url: coingeckoLinks.docs,
          category: 'docs',
          reasoning: "Documentation from CoinGecko"
        });
      }
    }

    console.log(`📎 Categorized resources:`);
    console.log(`  Whitepaper: ${whitepaperUrl || 'Not found'}`);
    console.log(`  GitHub: ${githubUrl || 'Not found'}`);
    console.log(`  Docs: ${docsUrl || 'Not found'}`);
    console.log(`  Social: ${socialUrls.length} links`);
    console.log(`  Other: ${importantResources.length} links`);

    // Step 5: Store in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build update object, only including contract/network if provided
    // Calculate total duration before saving
    const totalDuration = Date.now() - startTime;

    const updateData: any = {
        symbol: symbol,
        website_url: websiteUrl,
        website_status: parsedData.website_status,
        token_type: parsedData.token_type,
        one_liner: parsedData.project_description,  // Changed from project_description
        project_summary_rich: parsedData.project_summary,
        technical_assessment: parsedData.technical_assessment,
        ssr_csr_classification: parsedData.ssr_csr_classification,
        needs_browser_rendering: parsedData.needs_browser_rendering,
        signals_found: parsedData.signals_found,
        red_flags: parsedData.red_flags,
        // New dedicated fields
        whitepaper_url: whitepaperUrl,
        github_url: githubUrl,
        docs_url: docsUrl,
        social_urls: socialUrls.length > 0 ? socialUrls : null,
        important_resources: importantResources.length > 0 ? importantResources : null,
        // Continue with other fields
        contract_verification: parsedData.contract_verification,
        original_html_length: parsedData.original_html_length || originalLength,
        parsed_html_length: parsedData.parsed_html_length || (wasParsed ? html.length : null),
        browser_rendered: parsedData.browser_rendered || false,
        browser_render_error: parsedData.browser_render_error || null,
        prompt_version: PROMPT_VERSION,
        extraction_status: 'completed',
        extraction_completed_at: new Date().toISOString(),
        // Add duration tracking
        website_analysis_duration_ms: totalDuration,
        website_stage1_analyzed_at: new Date().toISOString()
    };

    // Only update contract/network if they were explicitly provided
    if (contractAddress) {
        updateData.contract_address = contractAddress;
    }
    if (network) {
        updateData.network = network;
    }

    // Either update existing record or insert new one
    let insertData, dbError;

    if (projectId) {
      // Update existing record
      console.log(`📝 Updating existing record for project ID: ${projectId}`);
      ({ data: insertData, error: dbError } = await supabase
        .from('crypto_projects_rated')
        .update(updateData)
        .eq('id', projectId)
        .select());
    } else {
      // Insert new record
      console.log(`➕ Creating new record for ${symbol}`);
      ({ data: insertData, error: dbError } = await supabase
        .from('crypto_projects_rated')
        .insert(updateData)
        .select());
    }

    if (dbError) {
      console.error(`❌ Database error: ${dbError.message}`);
    }

    // Step 6: Return comprehensive results matching original structure
    // totalDuration already calculated above

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
      needs_browser_rendering: parsedData.needs_browser_rendering,
      browser_rendered: parsedData.browser_rendered || false,
      browser_render_error: parsedData.browser_render_error || null,
      prompt_version: PROMPT_VERSION,
      signals_found: parsedData.signals_found,
      red_flags: parsedData.red_flags,
      extracted_resources: parsedData.extracted_resources,
      whitepaper_url: whitepaperUrl,
      github_url: githubUrl,
      docs_url: docsUrl,
      social_urls: socialUrls,
      important_resources: importantResources,
      contract_verification: parsedData.contract_verification,
      counts: {
        signals: parsedData.signals_found?.length || 0,
        red_flags: parsedData.red_flags?.length || 0,
        extracted_resources: parsedData.extracted_resources?.length || 0,
        social_links: socialUrls.length,
        important_resources: importantResources.length
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
    // Use either the provided projectId or the newly created record's ID
    const finalProjectId = projectId || insertData?.[0]?.id;

    if (finalProjectId && !dbError) {
      console.log(`🚀 Auto-triggering Phase 2 for project ${finalProjectId}`);

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
            projectId: finalProjectId,
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