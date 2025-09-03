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

// Function to analyze with AI using raw HTML - Full Freedom Approach
async function analyzeWithAI(html: string, ticker: string, isDead: boolean = false) {
  const prompt = `Analyze this crypto project's HTML and provide a comprehensive report. Don't hold back - tell me EVERYTHING you discover.

Project: ${ticker}

HTML (${html.length} characters):
${html}

CRITICAL FIRST CHECK - Is this a real project website?
- Is this a domain parking page (GoDaddy, Namecheap, Sedo, etc.)?
- Is this a "coming soon" or "under construction" page?
- Is this an error page (404, 403, 500, etc.)?
- Does it have less than 500 chars of meaningful content?
- Is this just a domain for sale listing?
- Is this a blank or default server page?

Provide a thorough analysis covering:
1. What this project REALLY is (not just claims)
2. All hidden details in the code
3. Business model and revenue streams
4. Technical implementation quality
5. Red flags and concerns
6. Positive signals
7. What the code reveals about the team
8. Anything unusual, suspicious, or noteworthy

Extract ALL resources needed for Stage 2 verification:
- Smart contract addresses (with network)
- GitHub repositories
- Team member profiles (LinkedIn, Twitter)
- Documentation links (whitepaper, GitBook, docs)
- Audit reports
- Social channels

Determine if this is meme or utility, score it 0-100, and decide tier:
- 0-29: "TRASH" (Poor quality, likely scam)
- 30-59: "BASIC" (Some effort, missing key elements)
- 60-84: "SOLID" (Good quality, professional)
- 85-100: "ALPHA" (Exceptional)

Return comprehensive JSON:
{
  "website_status": "active/dead/blocked",
  "dead_reason": "parking/coming_soon/error/no_content/for_sale/blank" (only if dead),
  "token_type": "meme/utility",
  "score": 0-100 (0 if dead),
  "tier": "TRASH/BASIC/SOLID/ALPHA/DEAD",
  
  "tooltip": {
    "one_liner": "60 char max summary",
    "pros": ["top 5 positives for tooltip"],
    "cons": ["top 3 negatives for tooltip"]
  },
  
  "full_analysis": {
    "report": "Complete narrative analysis (be thorough)",
    "hidden_discoveries": ["all hidden/unusual findings"],
    "red_flags": ["all concerns found"],
    "green_flags": ["all positive signals"],
    "revenue_model": "how they really make money",
    "technical_assessment": "code quality and implementation",
    "most_revealing": "the single most important discovery"
  },
  
  "stage_2_recommended": true/false,
  "stage_2_reason": "what needs verification",
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
}`;

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
            content: prompt
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
    
    console.log(`AI Response first 200 chars: ${contentStr.substring(0, 200)}`);
    
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
    
    // The AI now returns the tier directly, but ensure score is capped
    if (result.score > 100) {
      result.score = 100;
    }
    
    return result;
  } catch (error) {
    console.error(`AI analysis error: ${error}`);
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
      projectId,            // ID in crypto_projects_rated table
      contractAddress,      // For logging
      websiteUrl,          // Website to analyze
      symbol,              // Token symbol
      source               // Where request came from
    } = await req.json();
    
    if (!websiteUrl || !symbol) {
      throw new Error('Missing required parameters: websiteUrl and symbol');
    }

    console.log(`Analyzing website for ${symbol}: ${websiteUrl}`);
    console.log(`Project ID: ${projectId}, Source: ${source || 'unknown'}`);

    // Check for Instagram URLs - they can't be scraped due to 403 blocking
    if (websiteUrl.includes('instagram.com')) {
      console.log(`Instagram URL detected - returning mock analysis for ${symbol}`);
      
      // Create mock analysis with new comprehensive structure
      const mockAnalysis = {
        score: 15,
        tier: 'BASIC',
        token_type: 'meme',
        
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
              website_stage1_analysis: mockAnalysis
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
    const analysis = await analyzeWithAI(html, symbol);
    
    // Check if AI detected a dead/parking page
    if (analysis.website_status === 'dead') {
      console.log(`AI detected dead/parking page: ${analysis.dead_reason}`);
      
      if (projectId) {
        const { error } = await supabase
          .from('crypto_projects_rated')
          .update({
            website_status: 'dead',
            website_stage1_score: 0,
            website_stage1_tier: 'DEAD',
            website_stage1_analyzed_at: new Date().toISOString(),
            website_stage1_analysis: analysis
          })
          .eq('id', projectId);
          
        if (error) {
          console.error(`Failed to update dead site status: ${error}`);
        }
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          symbol,
          websiteUrl,
          website_status: 'dead',
          dead_reason: analysis.dead_reason,
          score: 0,
          tier: 'DEAD',
          message: `Website is a ${analysis.dead_reason} page`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }
    
    console.log(`Analysis complete: Score ${analysis.score}/100 (${analysis.tier})`);
    
    // Step 4: Update database if projectId provided
    let updateSuccess = false;
    let updateError = null;
    
    if (projectId) {
      console.log(`Updating crypto_projects_rated for ${symbol} with ID ${projectId}`);
      
      try {
        // Store the complete analysis object
        const fullAnalysis = {
          ...analysis,
          html_length: html.length,
          analyzed_at: new Date().toISOString()
        };
        
        // Prepare update payload for crypto_projects_rated with new columns
        const updatePayload = {
          website_status: 'active',  // Mark as active since we successfully analyzed it
          website_stage1_score: analysis.score,
          website_stage1_tier: analysis.tier,
          website_stage1_analysis: fullAnalysis,  // Full comprehensive JSON (everything)
          website_stage1_tooltip: analysis.tooltip,  // Just tooltip for fast loading
          website_stage2_resources: analysis.stage_2_resources,  // Just resources for Stage 2
          website_stage1_analyzed_at: new Date().toISOString(),
          token_type: analysis.token_type
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
        }
      } catch (err) {
        updateError = err;
        console.error('Exception during update:', err);
      }
    } else {
      console.log('No projectId provided, skipping database update');
    }
    
    // Return comprehensive analysis results
    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        websiteUrl,
        score: analysis.score,
        tier: analysis.tier,
        token_type: analysis.token_type,
        tooltip: analysis.tooltip,
        full_analysis: analysis.full_analysis,
        stage_2_recommended: analysis.stage_2_recommended,
        stage_2_reason: analysis.stage_2_reason,
        stage_2_resources: analysis.stage_2_resources,
        database_update: {
          attempted: !!projectId,
          success: updateSuccess,
          error: updateError ? updateError.message : null
        },
        content_stats: {
          html_length: html.length
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