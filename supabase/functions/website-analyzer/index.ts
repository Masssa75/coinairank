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

// Function to scrape website using ScraperAPI
async function scrapeWebsite(url: string) {
  try {
    console.log(`Scraping website: ${url}`);
    
    // Always use JavaScript rendering with wait time for modern SPAs
    const renderUrl = `http://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}&render=true&wait=3000`;
    
    console.log('Fetching with JavaScript rendering and 3s wait...');
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
    
    console.log(`Successfully scraped ${html.length} chars of HTML`);
    return html;
  } catch (error) {
    console.error(`Error scraping website: ${error}`);
    throw error;
  }
}

// Function to parse HTML and extract content
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
      
      // Categorize the link type
      let type = 'other';
      if (/docs|documentation|whitepaper|guide|tutorial|developer|build|resources|learn/i.test(url + ' ' + text)) {
        type = 'documentation';
      } else if (url.includes('github.com') || url.includes('gitlab.com')) {
        type = 'github';
      } else if (/twitter|x\.com|telegram|discord|medium|reddit|linkedin/i.test(url)) {
        type = 'social';
      } else if (/about|team|partners|investors/i.test(url + ' ' + text)) {
        type = 'about';
      } else if (/blog|news|updates|announcements/i.test(url + ' ' + text)) {
        type = 'blog';
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

// Function to analyze with AI (Updated for 100-point system)
async function analyzeWithAI(parsedContent: any, ticker: string) {
  // Create a summary of links with their context
  const linkSummary = parsedContent.links_with_context?.slice(0, 30).map((l: any) => 
    `[${l.type}] ${l.text}: ${l.url}`
  ).join('\n') || 'No links found';
  
  // Create a summary of headers
  const headerSummary = parsedContent.headers?.slice(0, 20).map((h: any) => 
    `${'  '.repeat(h.level - 1)}H${h.level}: ${h.text}`
  ).join('\n') || 'No headers found';
  
  const prompt = `Analyze this cryptocurrency project website using ADAPTIVE SCORING based on token type.

Project: ${ticker}

META INFORMATION:
- Description: ${parsedContent.meta_tags?.description || 'None'}
- OG Title: ${parsedContent.meta_tags?.og_title || 'None'}
- OG Description: ${parsedContent.meta_tags?.og_description || 'None'}

WEBSITE STRUCTURE (Headers):
${headerSummary}

NAVIGATION LINKS (with context):
${linkSummary}

BUTTON NAVIGATION:
${parsedContent.button_texts?.join(', ') || 'None found'}

WEBSITE CONTENT (${parsedContent.text_length} chars):
${parsedContent.text_content}

IMPORTANT: Look at ALL the links above - many documentation links might be at /developers, /build, /resources, etc. not just /docs.
Check the link text and context carefully before determining if documentation exists.

STEP 1 - TOKEN TYPE CLASSIFICATION:
First classify this token as either:
- "meme": Community-driven, humor/viral focus, animal/cartoon themes, "to the moon" rhetoric, cultural references, primarily speculation/entertainment
- "utility": Clear use case, solving real problems, technical infrastructure, business model, professional presentation, actual product/service

STEP 2 - ADAPTIVE SCORING (0-14 points each category, 0-98 total possible):

IF MEME TOKEN - Score these 7 categories:
1. community_strength (0-14): Social media presence, community links, engagement indicators, active following
2. brand_identity (0-14): Memorable concept, clear theme/character, viral potential, cultural relevance
3. website_quality (0-14): Professional design, working features, visual appeal, user experience
4. authenticity (0-14): Original concept vs copycat, unique value proposition, creative execution
5. transparency (0-14): Clear tokenomics, supply info, no hidden mechanics, honest presentation  
6. safety_signals (0-14): Contract verification mentioned, security measures, liquidity info, trust indicators
7. accessibility (0-14): Team communication, community access, clear social links, responsive presence

IF UTILITY TOKEN - Score these 7 categories:
1. technical_infrastructure (0-14): GitHub repos, APIs, developer resources, technical depth
2. business_utility (0-14): Real use case, problem-solving, market need, practical application
3. documentation_quality (0-14): Whitepapers, technical docs, guides, comprehensive information
4. community_social (0-14): Active community, social presence, user engagement, ecosystem
5. security_trust (0-14): Audits, security info, transparency measures, risk mitigation
6. team_transparency (0-14): Team info, backgrounds, LinkedIn, credentials, accountability
7. website_presentation (0-14): Professional design, working features, technical presentation

Also identify:
- Exceptional signals (major partnerships, high revenue, large user base, unique achievements)
- Critical missing elements (what's lacking for this token type)
- Should this proceed to deeper Stage 2 analysis?

TIER CLASSIFICATION (Based on 0-100 scale):
- 0-29: "TRASH" (Poor quality, likely scam or very low effort)
- 30-59: "BASIC" (Some effort, but missing key elements for its type)
- 60-84: "SOLID" (Good quality, professional, most important elements present)
- 85-100: "ALPHA" (Exceptional, all elements perfect for its type)

Note: Round total score up to max 100 if it exceeds 98.

Return JSON only:
{
  "category_scores": {
    "category1_name": 0-14,
    "category2_name": 0-14,
    "category3_name": 0-14,
    "category4_name": 0-14,
    "category5_name": 0-14,
    "category6_name": 0-14,
    "category7_name": 0-14
  },
  "total_score": 0-100,
  "tier": "TRASH/BASIC/SOLID/ALPHA",
  "token_type": "meme/utility",
  "exceptional_signals": ["signal1", "signal2"],
  "missing_elements": ["element1", "element2"],
  "proceed_to_stage_2": true/false,
  "stage_2_links": ["url1", "url2", "url3"],
  "quick_take": "VERY concise summary (max 60 chars) following format: '[Key positive], but [key negatives]' Examples: '$700k institutional trades, but no team info', 'Working DEX platform, but anonymous team', 'NFT marketplace with users, but no audits', 'Payment system, but no docs or GitHub'. If only negative: 'No real content, just placeholder'. If only positive: 'Audited DeFi platform with documentation'",
  "quick_assessment": "Detailed 2-3 sentence assessment explaining the score in context of token type",
  "reasoning": "Brief explanation of tier assignment",
  "type_reasoning": "Why classified as meme or utility with key indicators"
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
        temperature: 0.3,
        max_tokens: 1000,
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
    
    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(contentStr);
    } catch {
      // If that fails, try removing markdown code blocks
      const cleanedContent = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleanedContent);
    }
    
    // Ensure score is capped at 100
    if (result.total_score > 98) {
      result.total_score = 100;
    }
    
    // Calculate tier based on 100-point scale
    if (result.total_score >= 85) result.tier = 'ALPHA';
    else if (result.total_score >= 60) result.tier = 'SOLID';
    else if (result.total_score >= 30) result.tier = 'BASIC';
    else result.tier = 'TRASH';
    
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
      
      // Create mock analysis that will be stored in database
      const mockAnalysis = {
        total_score: 15,
        tier: 'BASIC',
        token_type: 'meme',
        category_scores: {
          community_strength: 3,
          brand_identity: 5,
          website_quality: 0,
          authenticity: 2,
          transparency: 0,
          safety_signals: 0,
          accessibility: 5
        },
        exceptional_signals: ['Instagram social media presence'],
        missing_elements: ['Cannot analyze Instagram content due to platform restrictions'],
        quick_take: 'Instagram-based token - limited analysis available',
        quick_assessment: 'This token uses Instagram as its primary web presence. Instagram blocks automated analysis, so we can only provide limited assessment based on the platform type. The token appears to be meme-focused given the Instagram format.',
        reasoning: 'Instagram URLs cannot be scraped due to platform restrictions (403 Forbidden). Assigned minimal BASIC tier score as we cannot verify actual content, functionality, or legitimacy.',
        type_reasoning: 'Classified as meme token based on Instagram social media format, which typically indicates community-driven meme projects rather than technical utility tokens.',
        proceed_to_stage_2: false,
        stage_2_links: []
      };

      // Update database if projectId provided
      let updateSuccess = false;
      let updateError = null;
      
      if (projectId) {
        try {
          const { error } = await supabase
            .from('crypto_projects_rated')
            .update({
              website_stage1_score: mockAnalysis.total_score,
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
          score: mockAnalysis.total_score,
          tier: mockAnalysis.tier,
          token_type: mockAnalysis.token_type,
          category_scores: mockAnalysis.category_scores,
          exceptional_signals: mockAnalysis.exceptional_signals,
          missing_elements: mockAnalysis.missing_elements,
          quick_take: mockAnalysis.quick_take,
          quick_assessment: mockAnalysis.quick_assessment,
          reasoning: mockAnalysis.reasoning,
          type_reasoning: mockAnalysis.type_reasoning,
          proceed_to_stage_2: mockAnalysis.proceed_to_stage_2,
          stage_2_links: mockAnalysis.stage_2_links,
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
    const html = await scrapeWebsite(websiteUrl);
    
    // Step 2: Parse content
    const parsedContent = parseHtmlContent(html);
    console.log(`Parsed ${parsedContent.text_length} chars of text from ${parsedContent.content_length} chars of HTML`);
    console.log(`Found ${parsedContent.links_with_context?.length || 0} links, ${parsedContent.headers?.length || 0} headers`);
    
    // Step 3: Analyze with AI
    const analysis = await analyzeWithAI(parsedContent, symbol);
    console.log(`Analysis complete: Score ${analysis.total_score}/100 (${analysis.tier})`);
    
    // Step 4: Update database if projectId provided
    let updateSuccess = false;
    let updateError = null;
    
    if (projectId) {
      console.log(`Updating crypto_projects_rated for ${symbol} with ID ${projectId}`);
      
      try {
        // Create comprehensive analysis object for JSONB column
        const fullAnalysis = {
          category_scores: analysis.category_scores,
          exceptional_signals: analysis.exceptional_signals || [],
          missing_elements: analysis.missing_elements || [],
          quick_take: analysis.quick_take || '',
          quick_assessment: analysis.quick_assessment || analysis.reasoning,
          proceed_to_stage_2: analysis.proceed_to_stage_2,
          stage_2_links: analysis.stage_2_links || [],
          parsed_content: {
            text_length: parsedContent.text_length,
            content_length: parsedContent.content_length,
            links_count: parsedContent.links_with_context?.length || 0,
            headers_count: parsedContent.headers?.length || 0,
            has_documentation: parsedContent.has_documentation,
            has_github: parsedContent.has_github,
            has_social: parsedContent.has_social,
            meta_tags: parsedContent.meta_tags
          },
          navigation_links: parsedContent.navigation,
          type_reasoning: analysis.type_reasoning,
          analyzed_at: new Date().toISOString()
        };
        
        // Prepare update payload for crypto_projects_rated
        const updatePayload = {
          website_stage1_score: analysis.total_score,
          website_stage1_tier: analysis.tier,
          website_stage1_analysis: fullAnalysis,
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
    
    // Return analysis results
    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        websiteUrl,
        score: analysis.total_score,
        tier: analysis.tier,
        token_type: analysis.token_type,
        category_scores: analysis.category_scores,
        exceptional_signals: analysis.exceptional_signals,
        missing_elements: analysis.missing_elements || [],
        quick_take: analysis.quick_take || '',
        quick_assessment: analysis.quick_assessment,
        reasoning: analysis.reasoning,
        type_reasoning: analysis.type_reasoning,
        proceed_to_stage_2: analysis.proceed_to_stage_2,
        stage_2_links: analysis.stage_2_links || [],
        database_update: {
          attempted: !!projectId,
          success: updateSuccess,
          error: updateError ? updateError.message : null
        },
        content_stats: {
          content_length: parsedContent.content_length,
          text_length: parsedContent.text_length,
          total_links: parsedContent.links_with_context?.length || 0,
          has_documentation: parsedContent.has_documentation,
          has_github: parsedContent.has_github,
          has_social: parsedContent.has_social
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