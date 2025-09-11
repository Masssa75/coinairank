import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Constants
const BROWSERLESS_API_KEY = Deno.env.get('BROWSERLESS_API_KEY') || '';
const OPENROUTER_API_KEY = Deno.env.get('OPEN_ROUTER_MANAGEMENT_API_KEY') || '';
const KIMI_K2_API_KEY = Deno.env.get('KIMI_K2_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Hard limits for safety
const MAX_PROMPT_SIZE = 250000; // 250K chars - safe buffer under kimi-k2's 262K context window

// Check for required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Present' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? 'Present' : 'MISSING');
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Telegram notification helper
async function sendTelegramNotification(message: string) {
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
    
    console.log('Telegram notification sent successfully');
  } catch (error) {
    console.error('Failed to send Telegram notification:', error);
    // Don't throw - notification failure shouldn't break the main function
  }
}

// Function to scrape website - temporarily use ScraperAPI to match local tests
async function scrapeWebsite(url: string) {
  try {
    console.log(`Scraping website with ScraperAPI: ${url}`);
    
    const scraperApiKey = Deno.env.get('SCRAPERAPI_KEY');
    if (!scraperApiKey) {
      throw new Error('SCRAPERAPI_KEY not configured');
    }
    
    // Use ScraperAPI to match our working local tests exactly
    const scraperUrl = `http://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(url)}`;
    const scraperResponse = await fetch(scraperUrl, {
      signal: AbortSignal.timeout(120000) // 2 minute timeout
    });

    if (!scraperResponse.ok) {
      const errorText = await scraperResponse.text();
      const errorMessage = `ScraperAPI failed with status ${scraperResponse.status}: ${errorText}`;
      console.error(errorMessage);
      
      // Send Telegram notification for scraping failure
      await sendTelegramNotification(
        `🚨 *Website Analyzer Error*\n\n` +
        `*Type:* ScraperAPI Scraping Failure\n` +
        `*URL:* ${url}\n` +
        `*Status:* ${scraperResponse.status}\n` +
        `*Time:* ${new Date().toISOString()}`
      );
      
      return { html: '', status: 'error', reason: errorMessage };
    }

    const html = await scraperResponse.text();
    
    // Check if we got content
    const textContent = html.replace(/<[^>]+>/g, '').trim();
    if (textContent.length < 100) {
      console.log(`Warning: Browserless returned minimal content (${textContent.length} chars)`);
      // Still return it - let the AI decide if it's useful
    }
    
    console.log(`Successfully scraped ${html.length} chars of HTML via Browserless`);
    return { html, status: 'success' };
  } catch (error) {
    console.error(`Error scraping website: ${error}`);
    
    // Send Telegram notification for scraping error
    await sendTelegramNotification(
      `🚨 *Website Analyzer Error*\n\n` +
      `*Type:* Scraping Exception\n` +
      `*URL:* ${url}\n` +
      `*Error:* ${error.message || error}\n` +
      `*Time:* ${new Date().toISOString()}`
    );
    
    return { html: '', status: 'error', reason: `Scraping failed: ${error}` };
  }
}




// HTML cleanup function for large websites (>150K chars) - WORKING VERSION
function cleanLargeHTML(html: string, originalSize: number): string {
  if (originalSize <= 150000) return html;
  
  console.log(`🧹 Applying HTML cleanup (${originalSize} > 150K chars)...`);
  
  let cleaned = html
    .replace(/\sclass="[^"]*"/g, '')           // CSS classes  
    .replace(/\ssrcset="[^"]*"/g, '')         // Responsive images
    .replace(/\sid="[^"]*"/g, '')             // CSS/JS IDs
    .replace(/\sdata-wf-[^=]*="[^"]*"/g, '') // Webflow metadata
    .replace(/\saria-label="[^"]*"/g, '')     // Accessibility
    .replace(/https:\/\/cdn\.prod\.website-files\.com\/[^\s"<>]+/g, '[CDN]') // CDN URLs
    .replace(/\s{2,}/g, ' ')                  // Extra whitespace
    .replace(/>\s+</g, '><');                 // Tag whitespace
    
  console.log(`✅ HTML cleaned: ${originalSize} → ${cleaned.length} (-${originalSize - cleaned.length} chars, ${Math.round((1 - cleaned.length/originalSize) * 100)}% reduction)`);
  return cleaned;
}

// Hard limit validation - WORKING VERSION
function validatePromptSize(html: string): { success: boolean; error?: string; htmlSize?: number; totalSize?: number } {
  const basePromptSize = 1500; // Base prompt without HTML
  const totalSize = basePromptSize + html.length;
  
  if (totalSize > MAX_PROMPT_SIZE) {
    return {
      success: false,
      error: 'PROMPT_TOO_LARGE',
      htmlSize: html.length,
      totalSize: totalSize
    };
  }
  
  return { success: true };
}

// Function to analyze with AI - WORKING VERSION (matches local tests exactly)
async function analyzeWithAI(html: string, ticker: string, contractAddress: string, network: string, isDead: boolean = false) {
  const originalSize = html.length;
  console.log(`Starting AI analysis: ${originalSize} chars`);
  
  // Apply HTML cleanup if needed - EXACTLY as in working local tests
  let processedHtml = cleanLargeHTML(html, originalSize);
  
  // Hard limit check - EXACTLY as in working local tests  
  const validation = validatePromptSize(processedHtml);
  if (!validation.success) {
    console.error(`Prompt too large: ${validation.totalSize} chars (limit: ${MAX_PROMPT_SIZE})`);
    throw new Error(`Content too large for analysis. HTML: ${validation.htmlSize} chars, Total: ${validation.totalSize} chars`);
  }
  
  const EXTRACTION_PROMPT = `You are an expert crypto analyst specializing in identifying high-potential projects through website analysis.

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

Project: ${ticker}
Network: ${network}
Current Price: unknown

HTML Content (ANALYZE EVERYTHING):
${processedHtml}

CONTRACT VERIFICATION:
Search for this exact contract address: ${contractAddress}
Check everywhere - text, buttons, links, explorer URLs, hidden elements.

⚡ CRITICAL DATABASE UPDATE: This prompt version requires BOTH link arrays ⚡

STEP 1: MANDATORY - Extract ALL links and return in "all_discovered_links" array
STEP 2: MANDATORY - Select best links and return in "selected_stage_2_links" array

🚨 BREAKING CHANGE: You MUST return BOTH link arrays or the database update will FAIL
- all_discovered_links: Every single clickable element found  
- selected_stage_2_links: Your curated selection with reasoning

For stage_2_links selection, explain WHY you chose each one:
- What information this link likely contains  
- How it helps assess project legitimacy/development quality

DETERMINE TYPE:
Is this a meme token (focus on community/viral) or utility token (real use case)?

CREATE DESCRIPTION:
Write a clear 100-character description of what this project actually does.

CREATE RICH PROJECT SUMMARY:
Write a comprehensive 200+ word description covering:
- What the project does (detailed explanation)
- Website quality and design (professional/template/basic with specifics)
- Where key information was found (homepage, docs, footer, etc)
- Technical depth observed
- Team presentation (if any)
- Community indicators
- Unique aspects that stand out
- Credibility markers found
- Concerns or missing elements

Return detailed JSON with ONLY EXTRACTION (NO SCORES):
{
  "website_status": "active/dead/blocked",
  
  "project_description": "Clear 100-char description of what this project actually does",
  
  "token_type": "meme/utility",
  
  "contract_verification": {
    "found_on_site": true/false,
    "confidence": "high/medium/low",
    "note": "where/how found or why not found"
  },
  
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
      "flag": "specific concern found",
      "severity": "high/medium/low",
      "evidence": "what proves this"
    }
  ],
  
  "project_summary_rich": {
    "overview": "Detailed 200+ word description of the project and its purpose",
    "website_quality": "Professional/template/basic with specific details",
    "key_findings": "Most important discoveries with locations",
    "technical_depth": "What technical information is available",
    "team_presentation": "How team is presented if at all",
    "community_indicators": "Social proof and community metrics observed",
    "unique_aspects": "What makes this project different",
    "credibility_markers": "Trust signals found",
    "concerns": "What's missing or questionable",
    "information_structure": "How information is organized on the site"
  },
  
  "tooltip": {
    "one_liner": "60 char max - what makes this unique",
    "top_signals": ["up to 3 best discoveries, brief"],
    "main_concerns": ["up to 2 biggest red flags, brief"]
  },
  
  "all_discovered_links": [
    {
      "url": "complete-url",
      "text": "link text or button text", 
      "type": "documentation/social/github/other"
    }
  ],
  
  "selected_stage_2_links": [
    {
      "url": "discovered link url",
      "reasoning": "why this link was selected for Stage 2 analysis"
    }
  ],
  
  "prompt_version": "v2.1_database_restructure"
}

IMPORTANT: Extract signals EXACTLY as they appear. Do NOT score or rate anything - only extract and categorize.`;

  try {
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIMI_K2_API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(300000), // 5 minute timeout for AI analysis
      body: JSON.stringify({
        model: 'kimi-k2-0905-preview',
        messages: [
          {
            role: 'user',
            content: EXTRACTION_PROMPT
          }
        ],
        temperature: 0.4,
        max_tokens: 200000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI analysis failed: ${response.status} - ${errorText}`);
      console.error(`Prompt length: ${EXTRACTION_PROMPT.length}`);
      console.error(`API Key present: ${KIMI_K2_API_KEY ? 'YES' : 'NO'}`);
      console.error(`Full error response: ${errorText}`);
      
      // Send Telegram notification for AI analysis failure
      await sendTelegramNotification(
        `🚨 *Website Analyzer Error*\n\n` +
        `*Type:* AI Analysis Failure\n` +
        `*Symbol:* ${ticker}\n` +
        `*Status:* ${response.status}\n` +
        `*Error:* ${errorText}\n` +
        `*Prompt Length:* ${EXTRACTION_PROMPT.length}\n` +
        `*Model:* kimi-k2\n` +
        `*Time:* ${new Date().toISOString()}`
      );
      
      throw new Error(`AI analysis failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Debug log the response
    console.log('OpenRouter API response keys:', Object.keys(data));
    
    // Check if response has expected structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected API response structure:', JSON.stringify(data).substring(0, 500));
      // Check if it's a different error format
      if (data.error) {
        console.error('API Error:', data.error);
        throw new Error(`API Error: ${data.error.message || data.error}`);
      }
      throw new Error('Invalid API response structure');
    }
    
    const contentStr = data.choices[0].message.content;
    
    // Extract token usage information if available
    const tokenUsage = data.usage ? {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
      model: 'kimi-k1'
    } : null;
    
    console.log(`AI Response length: ${contentStr.length} chars`);
    console.log(`AI Response first 500 chars: ${contentStr.substring(0, 500)}`);
    console.log(`AI Response last 500 chars: ${contentStr.substring(contentStr.length - 500)}`);
    console.log(`Contains stage_2_links: ${contentStr.includes('stage_2_links')}`);
    console.log(`Contains all_discovered_links: ${contentStr.includes('all_discovered_links')}`);
    console.log(`Contains prompt_version: ${contentStr.includes('prompt_version')}`);
    if (tokenUsage) {
      console.log(`Token usage: ${tokenUsage.total_tokens} total (${tokenUsage.prompt_tokens} prompt + ${tokenUsage.completion_tokens} completion)`);
    }
    
    // Parse the JSON response with better error handling
    let result;
    try {
      result = JSON.parse(contentStr);
    } catch (e) {
      console.log('First parse failed, trying to clean content...');
      // Try removing markdown code blocks and any leading text
      let cleanedContent = contentStr;
      
      // Remove markdown code blocks
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // If it starts with non-JSON text, find the first { 
      const jsonStart = cleanedContent.indexOf('{');
      if (jsonStart > 0) {
        console.log(`Found JSON starting at position ${jsonStart}`);
        cleanedContent = cleanedContent.substring(jsonStart);
      }
      
      try {
        result = JSON.parse(cleanedContent);
      } catch (e2) {
        console.error('Failed to parse AI response even after cleaning:', e2);
        console.error('Full content:', contentStr);
        throw new Error(`Failed to parse AI response: ${e2.message}`);
      }
    }
    
    // DEBUG: Log parsed result fields to check what AI actually returned
    console.log(`Parsed result fields: ${Object.keys(result).join(', ')}`);
    console.log(`prompt_version in result: ${result.prompt_version || 'NOT_FOUND'}`);
    console.log(`all_discovered_links in result: ${result.all_discovered_links ? 'YES' : 'NO'}`);
    console.log(`selected_stage_2_links in result: ${result.selected_stage_2_links ? 'YES' : 'NO'}`);
    
    // Use the final_score which should match strongest_signal.score
    if (!result.final_score && result.strongest_signal) {
      result.final_score = result.strongest_signal.score;
    }
    
    // Ensure score is capped at 100
    if (result.final_score > 100) {
      result.final_score = 100;
    }
    
    // Add token usage to result if available
    if (tokenUsage) {
      result.token_usage = tokenUsage;
    }
    
    
    // DEBUG: Add raw AI response to debug missing stage_2_links
    result.debug_raw_response = contentStr.substring(0, 2000);
    
    return result;
  } catch (error) {
    console.error(`AI analysis error: ${error}`);
    
    // Send Telegram notification for AI analysis exception
    await sendTelegramNotification(
      `🚨 *Website Analyzer Error*\n\n` +
      `*Type:* AI Analysis Exception\n` +
      `*Symbol:* ${ticker}\n` +
      `*Error:* ${error.message || error}\n` +
      `*Model:* kimi-k2\n` +
      `*Time:* ${new Date().toISOString()}`
    );
    
    throw error;
  }
}

// Function for Phase 2: Bottom-up tier comparison and scoring
async function compareWithBenchmarks(signals: any[], benchmarks: any[], symbol: string) {
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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://coinairank.com',
        'X-Title': 'CAR Phase 2 Comparison'
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2',
        messages: [
          {
            role: 'user',
            content: COMPARISON_PROMPT
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent scoring
        max_tokens: 2000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Phase 2 comparison failed: ${response.status} - ${errorText}`);
      
      // Send Telegram notification for Phase 2 failure
      await sendTelegramNotification(
        `🚨 *Website Analyzer Error*\n\n` +
        `*Type:* Phase 2 Comparison Failure\n` +
        `*Symbol:* ${symbol}\n` +
        `*Status:* ${response.status}\n` +
        `*Model:* kimi-k2\n` +
        `*Time:* ${new Date().toISOString()}`
      );
      
      throw new Error(`Phase 2 comparison failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Debug log the response
    console.log('Phase 2 OpenRouter API response keys:', Object.keys(data));
    
    // Check if response has expected structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected Phase 2 API response structure:', JSON.stringify(data).substring(0, 500));
      // Check if it's a different error format
      if (data.error) {
        console.error('Phase 2 API Error:', data.error);
        throw new Error(`Phase 2 API Error: ${data.error.message || data.error}`);
      }
      throw new Error('Invalid Phase 2 API response structure');
    }
    
    let contentStr = data.choices[0].message.content;
    
    // Clean the response - remove markdown code blocks if present
    contentStr = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // If it starts with non-JSON text, find the first {
    const jsonStart = contentStr.indexOf('{');
    if (jsonStart > 0) {
      contentStr = contentStr.substring(jsonStart);
    }
    
    const result = JSON.parse(contentStr);
    
    console.log(`Phase 2 comparison complete: Tier ${result.final_tier} (${result.tier_name}) - Score ${result.final_score}`);
    
    return result;
  } catch (error) {
    console.error(`Phase 2 comparison error: ${error}`);
    
    // Send Telegram notification for Phase 2 exception
    await sendTelegramNotification(
      `🚨 *Website Analyzer Error*\n\n` +
      `*Type:* Phase 2 Comparison Exception\n` +
      `*Symbol:* ${symbol}\n` +
      `*Error:* ${error.message || error}\n` +
      `*Model:* kimi-k2\n` +
      `*Time:* ${new Date().toISOString()}`
    );
    
    throw error;
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
    const { 
      phase = 1,            // Phase 1 (extraction) or Phase 2 (scoring)
      projectId,            // ID in crypto_projects_rated table
      contractAddress,      // For logging
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
          `🚨 *Website Analyzer Error*\n\n` +
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
          explanation: comparison.explanation,
          database_update: {
            success: true,
            projectId: projectId
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    // Phase 1: Extraction (existing logic)
    if (!websiteUrl || !symbol) {
      throw new Error('Missing required parameters: websiteUrl and symbol');
    }

    console.log(`Phase 1: Analyzing website for ${symbol}: ${websiteUrl}`);
    console.log(`Project ID: ${projectId}, Source: ${source || 'unknown'}`);

    // Check for Instagram URLs - they can't be scraped due to 403 blocking
    if (websiteUrl.includes('instagram.com')) {
      console.log(`Instagram URL detected - returning mock analysis for ${symbol}`);
      
      // Create mock analysis with new comprehensive structure
      const mockAnalysis = {
        score: 15,
        tier: 'BASIC',
        token_type: 'meme',
        
        contract_verification: {
          found_on_site: false,
          confidence: 'high',
          note: 'Cannot verify - Instagram blocks analysis'
        },
        
        tooltip: {
          one_liner: 'Instagram-only presence, analysis blocked',
          pros: ['Has social media presence'],
          cons: ['Instagram blocks analysis', 'No website or documentation', 'Cannot verify legitimacy']
        },
        
        full_analysis: {
          report: 'This token uses Instagram as its primary web presence. Instagram blocks automated analysis (403 Forbidden), preventing comprehensive evaluation. Based on the platform choice alone, this appears to be a meme token focused on social media engagement rather than technical utility.',
          hidden_discoveries: ['Instagram-only presence suggests minimal technical development'],
          red_flags: ['No traditional website', 'Cannot verify claims', 'Instagram blocks analysis'],
          green_flags: ['Has some social media presence'],
          revenue_model: 'Unknown - cannot analyze Instagram content',
          technical_assessment: 'No technical infrastructure visible',
          most_revealing: 'Instagram-only presence indicates low technical investment'
        },
        
        stage_2_recommended: false,
        stage_2_reason: 'No verifiable resources available',
        stage_2_resources: {
          contract_addresses: [],
          github_repos: [],
          team_profiles: [],
          documentation: {},
          audits: [],
          social_channels: {
            instagram: websiteUrl
          }
        },
        
      };

      // Update database if projectId provided
      let updateSuccess = false;
      let updateError = null;
      
      if (projectId) {
        try {
          const { error } = await supabase
            .from('crypto_projects_rated')
            .update({
              website_status: 'blocked',  // Instagram blocks scraping
              website_stage1_score: mockAnalysis.score,
              website_stage1_tier: mockAnalysis.tier,
              token_type: mockAnalysis.token_type,
              website_stage1_analyzed_at: new Date().toISOString(),
              website_stage1_analysis: mockAnalysis,
              contract_verification: mockAnalysis.contract_verification
              // Don't set is_imposter - reserved for admin manual verification only
            })
            .eq('id', projectId);
            
          if (error) throw error;
          updateSuccess = true;
          console.log(`✅ Updated project ${projectId} with Instagram mock analysis`);
        } catch (err) {
          updateError = err;
          console.error(`Failed to update project ${projectId}:`, err);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          symbol,
          websiteUrl,
          score: mockAnalysis.score,
          tier: mockAnalysis.tier,
          token_type: mockAnalysis.token_type,
          contract_verification: mockAnalysis.contract_verification,
          tooltip: mockAnalysis.tooltip,
          full_analysis: mockAnalysis.full_analysis,
          stage_2_recommended: mockAnalysis.stage_2_recommended,
          stage_2_reason: mockAnalysis.stage_2_reason,
          stage_2_resources: mockAnalysis.stage_2_resources,
          database_update: {
            attempted: !!projectId,
            success: updateSuccess,
            error: updateError ? updateError.message : null
          },
          content_stats: {
            content_length: 0,
            analysis_blocked: true,
            reason: 'Instagram blocks automated analysis'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Step 1: Scrape website
    const scrapeResult = await scrapeWebsite(websiteUrl);
    
    // Check if scraping failed
    if (scrapeResult.status === 'error') {
      console.log(`Website scraping failed: ${scrapeResult.reason}`);
      
      // Update database with error status (not dead, just failed to scrape)
      if (projectId) {
        const { error } = await supabase
          .from('crypto_projects_rated')
          .update({
            website_status: 'scrape_error',
            website_stage1_score: null,  // null means we couldn't determine
            website_stage1_tier: 'ERROR',
            website_stage1_analyzed_at: new Date().toISOString(),
            website_stage1_analysis: {
              website_status: 'scrape_error',
              error_reason: scrapeResult.reason,
              score: null,
              tier: 'ERROR',
              analyzed_at: new Date().toISOString()
            }
          })
          .eq('id', projectId);
          
        if (error) {
          console.error(`Failed to update scrape error status: ${error}`);
        } else {
          console.log(`⚠️ Marked ${symbol} as scraping error`);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          symbol,
          websiteUrl,
          website_status: 'scrape_error',
          error_reason: scrapeResult.reason,
          score: null,
          tier: 'ERROR',
          message: `Failed to scrape website: ${scrapeResult.reason}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }
    
    const html = scrapeResult.html;
    console.log(`Scraped ${html.length} chars of HTML`);
    
    // Step 2: Analyze with AI (using raw HTML)
    const analysis = await analyzeWithAI(html, symbol, contractAddress || '', 'base');
    
    // Check if AI detected a dead/parking page
    if (analysis.website_status === 'dead') {
      console.log(`AI detected dead/parking page: ${analysis.dead_reason}`);
      
      if (projectId) {
        const { error } = await supabase
          .from('crypto_projects_rated')
          .update({
            website_status: 'dead',
            extraction_status: 'failed',
            extraction_completed_at: new Date().toISOString(),
            website_stage1_analyzed_at: new Date().toISOString(),
            website_stage1_analysis: analysis,
            // Clear scoring fields
            website_stage1_score: null,
            website_stage1_tier: null
          })
          .eq('id', projectId);
          
        if (error) {
          console.error(`Failed to update dead site status: ${error}`);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          phase: 'extraction',
          symbol,
          websiteUrl,
          website_status: 'dead',
          dead_reason: analysis.dead_reason,
          extraction_complete: false,
          message: `Website is a ${analysis.dead_reason} page - no extraction possible`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }
    
    console.log(`Phase 1 extraction complete. Signals found: ${analysis.signals_found?.length || 0}`);
    
    // Step 4: Update database if projectId provided
    let updateSuccess = false;
    let updateError = null;
    
    // Prepare response data early so we can add phase 2 results if needed
    const responseData: any = {
      success: true,
      phase: 'extraction',
      symbol,
      websiteUrl,
      extraction_complete: true,
      signals_count: analysis.signals_found?.length || 0,
      has_rich_summary: !!analysis.project_summary_rich,
      signals_found: analysis.signals_found || [],
      red_flags: analysis.red_flags || [],
      project_summary: analysis.project_summary_rich,
      token_type: analysis.token_type,
      extraction_status: 'completed',
      message: 'Phase 1 extraction complete.',
      stage_2_links: analysis.stage_2_links || [], // FORCE INCLUDE stage_2_links!
      // DEBUG: Include new fields to verify AI response
      prompt_version: analysis.prompt_version || 'NOT_FOUND',
      all_discovered_links: analysis.all_discovered_links || [],
      selected_stage_2_links: analysis.selected_stage_2_links || [],
      database_update: {
        attempted: false,
        success: false,
        error: null
      }
    };
    
    if (projectId) {
      console.log(`Updating crypto_projects_rated for ${symbol} with ID ${projectId}`);
      
      try {
        // Store the complete extraction object
        const fullAnalysis = {
          ...analysis,
          html_length: html.length,
          original_html_size: originalSize,
          html_cleaned: originalSize > 150000,
          extracted_at: new Date().toISOString()
        };
        
        // Phase 1 extraction update payload
        const updatePayload = {
          // Phase 1 extraction results
          signals_found: analysis.signals_found || [],
          red_flags: analysis.red_flags || [],
          project_summary_rich: analysis.project_summary_rich || '',
          token_type: analysis.token_type,
          contract_verification: analysis.contract_verification,
          
          // NEW: Structured link data
          discovered_links: analysis.all_discovered_links || [],
          stage_2_links: analysis.selected_stage_2_links || [],
          links_discovered_at: new Date().toISOString(),
          
          // Store full extraction data
          website_stage1_analysis: fullAnalysis,
          website_stage1_tooltip: analysis.website_stage1_tooltip || '',
          
          // Extraction status
          extraction_status: 'completed',
          extraction_completed_at: new Date().toISOString(),
          
          // Clear scoring fields (will be set by Phase 2)
          website_stage1_score: null,
          website_stage1_tier: null,
          
          // Keep for backward compatibility
          website_status: 'active',
          website_stage1_analyzed_at: new Date().toISOString()
        };
        
        console.log('Update payload ready, executing...');
        
        const { data, error } = await supabase
          .from('crypto_projects_rated')
          .update(updatePayload)
          .eq('id', projectId)
          .select();
        
        if (error) {
          updateError = error;
          console.error(`Database update FAILED:`, error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          
          // Send Telegram notification for Phase 1 database update failure
          await sendTelegramNotification(
            `🚨 *Website Analyzer Error*\n\n` +
            `*Type:* Phase 1 Database Update Failed\n` +
            `*Symbol:* ${symbol}\n` +
            `*Error:* ${error.message}\n` +
            `*Time:* ${new Date().toISOString()}`
          );
          
          // Update response data with error status
          responseData.database_update.attempted = true;
          responseData.database_update.success = false;
          responseData.database_update.error = error.message;
        } else {
          updateSuccess = true;
          console.log(`✅ Database UPDATE SUCCESS for ${symbol}`);
          console.log('Updated record:', data?.[0]?.id, data?.[0]?.symbol);
          
          // Update response data with success status
          responseData.database_update.attempted = true;
          responseData.database_update.success = true;
          responseData.message = 'Phase 1 extraction complete. Call with phase: 2 to score.';
          
          // Auto-trigger Phase 2 scoring - AWAIT it properly to ensure it runs
          console.log(`Phase 1 complete. Auto-triggering Phase 2 for ${symbol}...`);
          
          // Small delay to ensure Phase 1 data is committed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            const phase2Response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/website-analyzer`, {
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
      } catch (err) {
        updateError = err;
        console.error('Exception during update:', err);
        
        // Send Telegram notification for database update exception
        await sendTelegramNotification(
          `🚨 *Website Analyzer Error*\n\n` +
          `*Type:* Database Update Exception\n` +
          `*Symbol:* ${symbol}\n` +
          `*Error:* ${err.message || err}\n` +
          `*Time:* ${new Date().toISOString()}`
        );
      }
    } else {
      console.log('No projectId provided, skipping database update');
    }
    
    // Return Phase 1 extraction results (no scores)
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Error in website-analyzer:', error);
    
    // Send Telegram notification for general function error
    await sendTelegramNotification(
      `🚨 *Website Analyzer Error*\n\n` +
      `*Type:* General Function Error\n` +
      `*Error:* ${error.message || error}\n` +
      `*Time:* ${new Date().toISOString()}`
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});