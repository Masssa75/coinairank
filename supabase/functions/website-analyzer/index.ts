import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Constants
const SCRAPERAPI_KEY = Deno.env.get('SCRAPERAPI_KEY') || '';
const OPENROUTER_API_KEY = Deno.env.get('OPEN_ROUTER_MANAGEMENT_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

// Function to scrape website - uses simple fetch first, falls back to ScraperAPI if needed
async function scrapeWebsite(url: string) {
  try {
    console.log(`Scraping website: ${url}`);
    
    // Try simple fetch first (faster, free, often sufficient)
    console.log('Trying simple fetch first...');
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      if (response.ok) {
        const html = await response.text();
        const textContent = html.replace(/<[^>]+>/g, '').trim();
        
        // Check if we got meaningful content
        if (textContent.length >= 500) {
          console.log(`Simple fetch success: ${html.length} chars of HTML`);
          return { html, status: 'success' };
        }
        console.log(`Simple fetch returned minimal content (${textContent.length} chars), trying ScraperAPI...`);
      } else {
        console.log(`Simple fetch failed with status ${response.status}`);
        // Check for specific error codes that indicate dead sites
        if (response.status === 404 || response.status >= 500) {
          return { html: '', status: 'dead', reason: `HTTP ${response.status}` };
        }
        console.log(`Trying ScraperAPI...`);
      }
    } catch (simpleError: any) {
      console.log(`Simple fetch error: ${simpleError}`);
      // Check for DNS/connection errors that indicate dead sites
      if (simpleError.message?.includes('DNS') || 
          simpleError.message?.includes('ENOTFOUND') ||
          simpleError.message?.includes('ECONNREFUSED') ||
          simpleError.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        return { html: '', status: 'dead', reason: 'DNS/Connection failed' };
      }
      console.log(`Trying ScraperAPI...`);
    }
    
    // Fall back to ScraperAPI for JavaScript-heavy sites or when simple fetch fails
    console.log('Falling back to ScraperAPI with JavaScript rendering...');
    const renderUrl = `http://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}&render=true&wait=3000`;
    
    const response = await fetch(renderUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      throw new Error(`ScraperAPI failed: ${response.status}`);
    }

    const html = await response.text();
    
    // Check if we still got minimal content (possible loading state)
    const textContent = html.replace(/<[^>]+>/g, '').trim();
    if (textContent.length < 200) {
      console.log(`Warning: Only ${textContent.length} chars of content after render. Possible loading screen.`);
      
      // Try one more time with longer wait
      const longerWaitUrl = `http://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}&render=true&wait=5000`;
      console.log('Retrying with 5s wait...');
      
      const retryResponse = await fetch(longerWaitUrl);
      if (retryResponse.ok) {
        const retryHtml = await retryResponse.text();
        const retryText = retryHtml.replace(/<[^>]+>/g, '').trim();
        
        if (retryText.length > textContent.length) {
          console.log(`Better result with longer wait: ${retryText.length} chars`);
          return retryHtml;
        }
      }
    }
    
    console.log(`Successfully scraped ${html.length} chars of HTML via ScraperAPI`);
    return { html, status: 'success' };
  } catch (error) {
    console.error(`Error scraping website: ${error}`);
    // Return dead status for complete failures
    return { html: '', status: 'dead', reason: `Scraping failed: ${error}` };
  }
}

// Function to parse HTML and extract content with enhanced detection
function parseHtmlContent(html: string) {
  // Extract text content (remove scripts and styles first)
  const cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ''); // Remove styles
  
  const textContent = cleanHtml
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 15000); // Limit to 15k chars
  
  // Enhanced feature detection for better analysis
  const features = {
    hasGitHub: false,
    hasDocs: false,
    hasWhitepaper: false,
    hasTeam: false,
    hasTokenomics: false,
    hasRoadmap: false,
    hasTwitter: false,
    hasTelegram: false,
    hasDiscord: false
  };
  
  // Enhanced detection patterns
  const patterns = {
    github: [/github\.com/gi, /href=["'][^"']*github[^"']*["']/gi, />\s*github\s*</gi],
    docs: [/docs\./gi, /documentation/gi, /\/docs(?:\/|"|')/gi, /href=["'][^"']*docs[^"']*["']/gi, />\s*docs\s*</gi, />\s*documentation\s*</gi],
    whitepaper: [/whitepaper/gi, /white-paper/gi, /litepaper/gi, /href=["'][^"']*(?:white|lite)paper[^"']*["']/gi],
    team: [/\/team(?:\/|"|'|\s|$)/gi, /href=["'][^"']*team[^"']*["']/gi, />\s*team\s*</gi, />\s*our team\s*</gi, />\s*about us\s*</gi],
    tokenomics: [/tokenomics/gi, /token economics/gi, />\s*tokenomics\s*</gi],
    roadmap: [/roadmap/gi, />\s*roadmap\s*</gi, /href=["'][^"']*roadmap[^"']*["']/gi],
    twitter: [/twitter\.com/gi, /x\.com/gi],
    telegram: [/t\.me/gi, /telegram/gi],
    discord: [/discord\.com/gi, /discord\.gg/gi]
  };
  
  // Check each pattern
  for (const [key, patternList] of Object.entries(patterns)) {
    for (const pattern of patternList) {
      if (pattern.test(html)) {
        features[`has${key.charAt(0).toUpperCase() + key.slice(1)}`] = true;
        break;
      }
    }
  }
  
  // Extract ALL links with their text context
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  const linksWithContext: Array<{url: string, text: string, type: string}> = [];
  const uniqueUrls = new Set<string>();
  let match;
  
  while ((match = linkRegex.exec(cleanHtml)) !== null) {
    const url = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    
    // Skip duplicates and anchors
    if (!uniqueUrls.has(url) && !url.startsWith('#')) {
      uniqueUrls.add(url);
      
      // Enhanced categorization with better patterns
      let type = 'other';
      if (/docs|documentation|whitepaper|guide|tutorial|developer|build|resources|learn|api/i.test(url + ' ' + text)) {
        type = 'documentation';
        features.hasDocs = true;
      } else if (url.includes('github.com') || url.includes('gitlab.com')) {
        type = 'github';
        features.hasGitHub = true;
      } else if (/twitter|x\.com|telegram|discord|medium|reddit|linkedin/i.test(url)) {
        type = 'social';
      } else if (/about|team|partners|investors/i.test(url + ' ' + text)) {
        type = 'about';
        if (/team/i.test(url + ' ' + text)) features.hasTeam = true;
      } else if (/blog|news|updates|announcements/i.test(url + ' ' + text)) {
        type = 'blog';
      } else if (/whitepaper|litepaper/i.test(url + ' ' + text)) {
        type = 'documentation';
        features.hasWhitepaper = true;
      } else if (/roadmap/i.test(url + ' ' + text)) {
        features.hasRoadmap = true;
      } else if (/tokenomics/i.test(url + ' ' + text)) {
        features.hasTokenomics = true;
      }
      
      linksWithContext.push({ url, text: text || 'No text', type });
    }
  }
  
  // Also extract button links (modern sites use buttons for navigation)
  const buttonRegex = /<button[^>]*onclick=["'][^"']*["'][^>]*>([^<]*)<\/button>/gi;
  const buttonTexts: string[] = [];
  while ((match = buttonRegex.exec(cleanHtml)) !== null) {
    const buttonText = match[1].replace(/<[^>]+>/g, '').trim();
    if (buttonText) buttonTexts.push(buttonText);
  }
  
  // Extract headers to understand page structure
  const headers: Array<{level: number, text: string}> = [];
  const headerRegex = /<h([1-6])[^>]*>([^<]+)<\/h[1-6]>/gi;
  while ((match = headerRegex.exec(cleanHtml)) !== null) {
    headers.push({
      level: parseInt(match[1]),
      text: match[2].replace(/<[^>]+>/g, '').trim()
    });
  }
  
  // Extract meta tags for additional context
  const metaDescription = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
  const metaKeywords = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
  const ogDescription = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
  
  // Check for React/Next.js __NEXT_DATA__ (often contains pre-loaded content)
  const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
  let hasNextData = false;
  let nextDataPreview = '';
  if (nextDataMatch) {
    hasNextData = true;
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      nextDataPreview = JSON.stringify(nextData).substring(0, 500);
    } catch (e) {
      // Invalid JSON, ignore
    }
  }
  
  // Build categorized link summary
  const categorizedLinks = {
    documentation: linksWithContext.filter(l => l.type === 'documentation').map(l => l.url),
    github: linksWithContext.filter(l => l.type === 'github').map(l => l.url),
    social: linksWithContext.filter(l => l.type === 'social').map(l => l.url),
    all_links: linksWithContext.slice(0, 150)
  };
  
  return {
    text_content: textContent,
    navigation: categorizedLinks,
    links_with_context: linksWithContext.slice(0, 100),
    headers: headers.slice(0, 50),
    button_texts: buttonTexts.slice(0, 20),
    meta_tags: {
      description: metaDescription,
      keywords: metaKeywords,
      og_title: ogTitle,
      og_description: ogDescription
    },
    content_length: html.length,
    text_length: textContent.length,
    has_documentation: categorizedLinks.documentation.length > 0,
    has_github: categorizedLinks.github.length > 0,
    has_social: categorizedLinks.social.length > 0,
    has_next_data: hasNextData,
    next_data_preview: nextDataPreview
  };
}

// Function to analyze with AI - Phase 1: Pure extraction without scoring
async function analyzeWithAI(html: string, ticker: string, contractAddress: string, network: string, isDead: boolean = false) {
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
${html}

CONTRACT VERIFICATION:
Search for this exact contract address: ${contractAddress}
Check everywhere - text, buttons, links, explorer URLs, hidden elements.

EXTRACT RESOURCES:
Find ALL resources for Stage 2 verification:
- Smart contract addresses (with network and type)
- Code repositories
- Team member profiles (name, role, professional links)
- Documentation (technical docs, whitepapers)
- Audit reports (firm, URL, findings)
- Social channels (all platforms)

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
  
  "stage_2_resources": {
    "contract_addresses": [
      {
        "address": "full address",
        "network": "ethereum/base/solana/etc",
        "type": "token/liquidity/staking"
      }
    ],
    "github_repos": ["urls"],
    "team_profiles": [
      {
        "name": "name if found",
        "role": "role",
        "linkedin": "url if found",
        "twitter": "url if found"
      }
    ],
    "documentation": {
      "whitepaper": "url if found",
      "gitbook": "url if found",
      "technical_docs": "url if found"
    },
    "audits": [
      {
        "auditor": "company name",
        "url": "audit link",
        "report": "report url if available"
      }
    ],
    "social_channels": {
      "twitter": "url",
      "telegram": "url",
      "discord": "url"
    }
  }
}

IMPORTANT: Extract signals EXACTLY as they appear. Do NOT score or rate anything - only extract and categorize.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://coinairank.com',
        'X-Title': 'CAR Website Analyzer'
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2',
        messages: [
          {
            role: 'user',
            content: EXTRACTION_PROMPT
          }
        ],
        temperature: 0.4,
        max_tokens: 3000,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI analysis failed: ${response.status} - ${errorText}`);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const data = await response.json();
    const contentStr = data.choices[0].message.content;
    
    // Extract token usage information if available
    const tokenUsage = data.usage ? {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
      model: 'kimi-k1'
    } : null;
    
    console.log(`AI Response first 200 chars: ${contentStr.substring(0, 200)}`);
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
    
    return result;
  } catch (error) {
    console.error(`AI analysis error: ${error}`);
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
      throw new Error(`Phase 2 comparison failed: ${response.status}`);
    }

    const data = await response.json();
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
        }
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
            text_length: 0,
            total_links: 0,
            has_documentation: false,
            has_github: false,
            has_social: true
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
    
    // Check if site is dead
    if (scrapeResult.status === 'dead') {
      console.log(`Website is dead: ${scrapeResult.reason}`);
      
      // Update database with dead status
      if (projectId) {
        const { error } = await supabase
          .from('crypto_projects_rated')
          .update({
            website_status: 'dead',
            website_stage1_score: 0,
            website_stage1_tier: 'DEAD',
            website_stage1_analyzed_at: new Date().toISOString(),
            website_stage1_analysis: {
              website_status: 'dead',
              dead_reason: scrapeResult.reason,
              score: 0,
              tier: 'DEAD',
              analyzed_at: new Date().toISOString()
            }
          })
          .eq('id', projectId);
          
        if (error) {
          console.error(`Failed to update dead site status: ${error}`);
        } else {
          console.log(`✅ Marked ${symbol} as dead site`);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          symbol,
          websiteUrl,
          website_status: 'dead',
          dead_reason: scrapeResult.reason,
          score: 0,
          tier: 'DEAD',
          message: `Website is not accessible: ${scrapeResult.reason}`
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
    
    if (projectId) {
      console.log(`Updating crypto_projects_rated for ${symbol} with ID ${projectId}`);
      
      try {
        // Store the complete extraction object
        const fullAnalysis = {
          ...analysis,
          html_length: html.length,
          extracted_at: new Date().toISOString()
        };
        
        // Phase 1 extraction update payload
        const updatePayload = {
          // Phase 1 extraction results
          signals_found: analysis.signals_found || [],
          red_flags: analysis.red_flags || [],
          project_summary_rich: analysis.project_summary_rich || {},
          token_type: analysis.token_type,
          contract_verification: analysis.contract_verification,
          website_stage2_resources: analysis.stage_2_resources,
          extraction_status: 'completed',
          extraction_completed_at: new Date().toISOString(),
          
          // Store full extraction data
          website_stage1_analysis: fullAnalysis,
          website_stage1_tooltip: analysis.tooltip,
          
          // Clear scoring fields (will be set by Phase 2)
          website_stage1_score: null,
          website_stage1_tier: null,
          
          // Keep for backward compatibility
          website_status: 'active',
          website_stage1_analyzed_at: new Date().toISOString(),
          // Don't auto-set is_imposter - this should only be set by admin manual verification
          // is_imposter field is reserved for admin-confirmed imposters only
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
        } else {
          updateSuccess = true;
          console.log(`✅ Database UPDATE SUCCESS for ${symbol}`);
          console.log('Updated record:', data?.[0]?.id, data?.[0]?.symbol);
          
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
      }
    } else {
      console.log('No projectId provided, skipping database update');
    }
    
    // Return Phase 1 extraction results (no scores)
    return new Response(
      JSON.stringify({
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
        message: updateSuccess ? 'Phase 1 extraction complete. Call with phase: 2 to score.' : 'Phase 1 extraction complete.',
        database_update: {
          attempted: !!projectId,
          success: updateSuccess,
          error: updateError ? updateError.message : null
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Error in website-analyzer:', error);
    
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