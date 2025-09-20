import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Tweet {
  text: string;
  date: string;
  likes: number;
  retweets: number;
  length: number;
}

interface AnalysisRequest {
  symbol: string;
  handle: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const timings: Record<string, number> = {};

  try {
    const { symbol, handle } = await req.json() as AnalysisRequest;

    if (!symbol || !handle) {
      throw new Error('Missing required parameters: symbol and handle');
    }

    console.log(`Starting X analysis for ${symbol} (@${handle})`);

    // Step 1: Fetch tweets from Twitter/X via Nitter
    const fetchStartTime = Date.now();
    const tweets = await fetchTwitterHistory(handle);
    timings.fetch_tweets_ms = Date.now() - fetchStartTime;
    console.log(`Fetched ${tweets.length} tweets for @${handle} in ${timings.fetch_tweets_ms}ms`);

    if (tweets.length === 0) {
      throw new Error(`No tweets found for @${handle}. The account may not exist or may be protected.`);
    }

    // Log sample tweet for debugging
    if (tweets.length > 0) {
      console.log('Sample tweet:', {
        text: tweets[0].text.substring(0, 100),
        date: tweets[0].date,
        likes: tweets[0].likes
      });
    }

    // Step 2: Analyze tweets with AI
    const aiStartTime = Date.now();
    const analysis = await analyzeWithKimiK2(tweets, handle, symbol);
    timings.ai_analysis_ms = Date.now() - aiStartTime;
    console.log(`AI analysis complete for ${symbol} in ${timings.ai_analysis_ms}ms`);

    // Step 3: Store analysis in database
    const dbStartTime = Date.now();
    await storeAnalysis(symbol, handle, analysis, tweets, timings);
    timings.db_storage_ms = Date.now() - dbStartTime;
    timings.total_ms = Date.now() - startTime;
    console.log(`Analysis stored for ${symbol} in ${timings.db_storage_ms}ms (Total: ${timings.total_ms}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        symbol,
        handle,
        tweets_analyzed: tweets.length,
        behavioral_breakdown: analysis.behavioral_percentages,
        primary_focus: analysis.content_patterns.primary_focus,
        substance_ratio: analysis.content_patterns.substance_vs_hype_ratio,
        red_flags_count: analysis.red_flags.length,
        positive_signals_count: analysis.positive_signals.length,
        character_type: analysis.trust_assessment.character_type,
        analysis,
        performance: {
          fetch_tweets_ms: timings.fetch_tweets_ms,
          ai_analysis_ms: timings.ai_analysis_ms,
          db_storage_ms: timings.db_storage_ms,
          total_ms: timings.total_ms
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in x-deep-analyzer:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'An error occurred during analysis'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function fetchTwitterHistory(handle: string): Promise<Tweet[]> {
  const tweets: Tweet[] = [];
  const scraperApiKey = Deno.env.get('SCRAPERAPI_KEY');

  if (!scraperApiKey) {
    throw new Error('SCRAPERAPI_KEY not configured');
  }

  // Try to fetch multiple pages to get ~100 tweets
  const cursors = ['', '?cursor=20', '?cursor=40', '?cursor=60', '?cursor=80'];

  for (const cursor of cursors) {
    try {
      const nitterUrl = `https://nitter.net/${handle}${cursor}`;
      console.log(`Fetching from: ${nitterUrl}`);

      // Use ScraperAPI to fetch the Nitter page
      const response = await fetch(
        `https://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(nitterUrl)}&render=false`,
        {
          method: 'GET',
          headers: {
            'Accept': 'text/html',
          }
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch page ${cursor}: ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Parse HTML with Cheerio
      const $ = cheerio.load(html);

      // Extract tweets
      let tweetsOnPage = 0;
      $('.timeline-item').each((index, element) => {
        const $element = $(element);

        // Skip if it's a retweet or pinned tweet indicator
        if ($element.find('.retweet-header').length > 0) {
          return;
        }

        const tweetContent = $element.find('.tweet-content').text().trim();
        const tweetDate = $element.find('.tweet-date').text().trim();

        // Skip empty tweets
        if (!tweetContent || tweetContent.length < 5) {
          return;
        }

        // Extract engagement metrics
        const statsContainer = $element.find('.tweet-stats');
        const likesText = statsContainer.find('.icon-heart').parent().text().trim();
        const retweetsText = statsContainer.find('.icon-retweet').parent().text().trim();

        // Parse numbers from text (handle K notation, e.g., "1.2K")
        const parseLikes = (text: string): number => {
          if (!text) return 0;
          const cleanText = text.replace(/[^0-9.K]/gi, '');
          if (cleanText.includes('K')) {
            return Math.round(parseFloat(cleanText.replace('K', '')) * 1000);
          }
          return parseInt(cleanText) || 0;
        };

        tweets.push({
          text: tweetContent,
          date: tweetDate,
          likes: parseLikes(likesText),
          retweets: parseLikes(retweetsText),
          length: tweetContent.length
        });

        tweetsOnPage++;
      });

      console.log(`Found ${tweetsOnPage} tweets on page ${cursor || 'main'}`);

      // Stop if we have enough tweets or no more tweets on page
      if (tweets.length >= 100 || tweetsOnPage === 0) {
        break;
      }

    } catch (error) {
      console.error(`Error fetching page ${cursor}:`, error);
      continue;
    }
  }

  // Return up to 100 tweets
  return tweets.slice(0, 100);
}

async function analyzeWithKimiK2(tweets: Tweet[], handle: string, symbol: string) {
  const kimiApiKey = Deno.env.get('KIMI_K2_API_KEY');

  if (!kimiApiKey) {
    throw new Error('KIMI_K2_API_KEY not configured');
  }

  const prompt = `
    Analyze these ${tweets.length} tweets from @${handle} (${symbol} crypto project).

    Raw tweet data:
    ${JSON.stringify(tweets, null, 2)}

    Please analyze the Twitter/X behavior patterns and provide:

    1. BEHAVIORAL PERCENTAGES (what % of tweets fall into each category):
       - Defensive/Scam warnings (constant warnings about impersonators, "official account" reminders)
       - Technical development (actual development updates, code releases, github activity, technical improvements)
       - Community building (supporting ecosystem projects, thanking contributors, community engagement)
       - Marketing/Hype (vague excitement, "revolutionary" claims, price pumping language)
       - Timeline promises (mainnet coming, launching soon, future promises without specifics)
       - Educational content (explaining technology, teaching, deep dives, technical education)
       - Financial products (yield, staking, APY, trading, DeFi products)

    2. CONTENT PATTERNS:
       - What is the primary focus of this account?
       - What's the ratio of substance vs hype?
       - Are there any concerning patterns (like 40% identical scam warnings)?

    3. RED FLAGS (things that indicate low credibility):
       - Excessive defensive messaging (over 30% scam warnings)
       - Timeline promises without delivery evidence
       - Vague hype without technical substance
       - Suspicious engagement patterns
       - Copy-paste identical tweets

    4. POSITIVE SIGNALS (things that indicate high credibility):
       - Consistent technical updates and development progress
       - Real ecosystem building and project support
       - Educational focus helping community understand technology
       - Authentic community interaction
       - Substantive announcements with details

    5. TRUST ASSESSMENT:
       - Trust score (0-100 where 100 is highest trust)
       - Character type must be one of: 'technical_community', 'product_ecosystem', 'marketing_operation', or 'mixed'
       - One-line verdict explaining the assessment

    Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
    {
      "behavioral_percentages": {
        "defensive_messaging": 0,
        "technical_development": 0,
        "community_building": 0,
        "marketing_hype": 0,
        "timeline_promises": 0,
        "educational_content": 0,
        "financial_products": 0
      },
      "content_patterns": {
        "primary_focus": "string describing main focus",
        "substance_vs_hype_ratio": "string like '80% substance, 20% hype'",
        "concerning_patterns": ["array of concerning patterns found"]
      },
      "red_flags": ["array of specific red flags identified"],
      "positive_signals": ["array of positive signals identified"],
      "trust_assessment": {
        "score": 0,
        "character_type": "one of the four types specified",
        "verdict": "one line explanation"
      }
    }
  `;

  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${kimiApiKey}`
    },
    body: JSON.stringify({
      model: 'kimi-k2-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing Twitter/X behavior patterns to assess crypto project credibility. You identify the difference between genuine technical projects and marketing operations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1  // Low temperature for consistent analysis
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI analysis failed: ${error}`);
  }

  const result = await response.json();

  // Parse the AI response
  try {
    const content = result.choices[0].message.content;
    console.log('Raw AI response:', content.substring(0, 500)); // Log first 500 chars

    // Remove any markdown formatting if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Try to parse the JSON
    const parsed = JSON.parse(jsonStr);
    console.log('Successfully parsed AI response');
    return parsed;
  } catch (error) {
    console.error('Failed to parse AI response:', error.message);
    console.error('Full AI response:', result.choices[0].message.content);
    throw new Error(`Failed to parse AI analysis response: ${error.message}`);
  }
}

async function storeAnalysis(symbol: string, handle: string, analysis: any, tweets: Tweet[], timings: Record<string, number>) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Calculate additional metrics
  const avgLikes = tweets.reduce((sum, t) => sum + t.likes, 0) / tweets.length;
  const avgRetweets = tweets.reduce((sum, t) => sum + t.retweets, 0) / tweets.length;
  const maxLikes = Math.max(...tweets.map(t => t.likes));
  const maxRetweets = Math.max(...tweets.map(t => t.retweets));

  const { error } = await supabase
    .from('crypto_projects_rated')
    .update({
      x_deep_analysis: {
        analyzed_at: new Date().toISOString(),
        handle: handle,
        tweets_analyzed: tweets.length,
        behavioral_breakdown: analysis.behavioral_percentages,
        content_patterns: analysis.content_patterns,
        red_flags: analysis.red_flags,
        positive_signals: analysis.positive_signals,
        date_range: {
          oldest: tweets[tweets.length - 1]?.date || null,
          newest: tweets[0]?.date || null
        },
        raw_metrics: {
          avg_likes: Math.round(avgLikes),
          avg_retweets: Math.round(avgRetweets),
          max_likes: maxLikes,
          max_retweets: maxRetweets,
          total_tweets: tweets.length
        },
        performance_metrics: {
          fetch_tweets_ms: timings.fetch_tweets_ms || 0,
          ai_analysis_ms: timings.ai_analysis_ms || 0,
          db_storage_ms: timings.db_storage_ms || 0,
          total_ms: timings.total_ms || 0
        }
      },
      x_behavioral_percentages: analysis.behavioral_percentages,
      x_primary_behavior: Object.entries(analysis.behavioral_percentages)
        .sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'unknown',
      x_red_flags_count: analysis.red_flags.length
    })
    .eq('symbol', symbol);

  if (error) {
    console.error('Database update error:', error);
    throw new Error(`Failed to store analysis: ${error.message}`);
  }
}