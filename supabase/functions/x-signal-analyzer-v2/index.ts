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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const timings: Record<string, number> = {};

  try {
    const { symbol, handle, phase = 1, projectId } = await req.json();

    console.log(`🚀 X Signal Analyzer: Starting Phase ${phase} for ${symbol} - @${handle || 'Phase 2'}`);

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PHASE 2: Compare existing signals against benchmarks
    if (phase === 2) {
      if (!projectId) {
        throw new Error('projectId required for Phase 2');
      }

      console.log(`📊 Phase 2: Comparing signals for project ${projectId}`);

      // Fetch existing signals
      const { data: project, error: fetchError } = await supabase
        .from('crypto_projects_rated')
        .select('x_signals_found')
        .eq('id', projectId)
        .single();

      if (fetchError || !project) {
        throw new Error(`Failed to fetch project: ${fetchError?.message || 'Not found'}`);
      }

      // Fetch benchmarks
      const { data: benchmarks, error: benchmarksError } = await supabase
        .from('x_tier_benchmarks')
        .select('*')
        .eq('is_active', true);

      if (benchmarksError || !benchmarks) {
        throw new Error(`Failed to load benchmarks: ${benchmarksError?.message || 'No benchmarks found'}`);
      }

      console.log(`Loaded ${benchmarks.length} benchmarks and ${project.x_signals_found?.length || 0} signals`);

      // Run Phase 2 comparison using AI
      const comparison = await compareWithBenchmarks(
        project.x_signals_found || [],
        benchmarks,
        symbol
      );

      // Update database with Phase 2 results
      const { error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update({
          x_stage1_score: comparison.final_score,
          x_stage1_tier: comparison.tier_name,
          x_stage1_analysis: {
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

    // PHASE 1: Extract signals from Twitter/X
    if (!symbol || !handle) {
      throw new Error('Missing required parameters: symbol and handle');
    }

    console.log(`Starting X signal extraction for ${symbol} (@${handle})`);

    // Step 1: Fetch tweets from Twitter/X via Nitter
    const fetchStartTime = Date.now();
    const tweets = await fetchTwitterHistory(handle);
    timings.fetch_tweets_ms = Date.now() - fetchStartTime;
    console.log(`Fetched ${tweets.length} tweets for @${handle} in ${timings.fetch_tweets_ms}ms`);

    if (tweets.length === 0) {
      throw new Error(`No tweets found for @${handle}. The account may not exist or may be protected.`);
    }

    // Step 2: Extract signals from tweets using AI
    const aiStartTime = Date.now();
    const analysis = await extractSignalsWithAI(tweets, handle, symbol);
    timings.ai_analysis_ms = Date.now() - aiStartTime;
    console.log(`AI signal extraction complete for ${symbol} in ${timings.ai_analysis_ms}ms`);
    console.log(`Found ${analysis.signals_found?.length || 0} signals`);

    // Step 3: Store analysis in database
    const dbStartTime = Date.now();
    const dbResult = await storeAnalysis(symbol, handle, analysis, tweets, timings, projectId);
    timings.db_storage_ms = Date.now() - dbStartTime;
    timings.total_ms = Date.now() - startTime;
    console.log(`Analysis stored for ${symbol} in ${timings.db_storage_ms}ms (Total: ${timings.total_ms}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        phase: 1,
        symbol,
        handle,
        tweets_analyzed: tweets.length,
        signals_found: analysis.signals_found,
        signal_categories: analysis.signal_categories,
        red_flags: analysis.red_flags,
        analysis_summary: analysis.summary,
        performance: {
          fetch_tweets_ms: timings.fetch_tweets_ms,
          ai_analysis_ms: timings.ai_analysis_ms,
          db_storage_ms: timings.db_storage_ms,
          total_ms: timings.total_ms
        },
        database_storage: {
          attempted: true,
          success: !dbResult.error,
          error: dbResult.error || null,
          projectId: dbResult.projectId
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in x-signal-analyzer:', error);
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

      // Use ScraperAPI to fetch the Nitter page (same as KROMV12)
      const startTime = Date.now();
      const scraperUrl = `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(nitterUrl)}`;

      console.log(`Fetching via ScraperAPI...`);
      const response = await fetch(scraperUrl);

      const fetchDuration = Date.now() - startTime;
      console.log(`ScraperAPI fetch took ${fetchDuration}ms`);

      if (!response.ok) {
        console.error(`Failed to fetch page ${cursor}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      console.log(`HTML length: ${html.length}, First 500 chars: ${html.substring(0, 500)}`);

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
      if (tweets.length >= 20 || tweetsOnPage === 0) {
        break;
      }

    } catch (error) {
      console.error(`Error fetching page ${cursor}:`, error);
      continue;
    }
  }

  // Return up to 20 tweets
  return tweets.slice(0, 20);
}

async function extractSignalsWithAI(tweets: Tweet[], handle: string, symbol: string) {
  const kimiApiKey = Deno.env.get('KIMI_K2_API_KEY');

  if (!kimiApiKey) {
    throw new Error('KIMI_K2_API_KEY not configured');
  }

  // Add numbered IDs to tweets for AI reference
  const numberedTweets = tweets.map((tweet, index) => ({
    id: index + 1,
    ...tweet
  }));

  const prompt = `
    Analyze these ${tweets.length} tweets from @${handle} (${symbol} crypto project).
    Extract ALL concrete achievements, launches, and developments - things that ACTUALLY HAPPENED.

    TWEETS LIST (use "Tweet #N" to reference):
    ${numberedTweets.map(t => `
Tweet #${t.id} [${t.date}] (${t.likes} likes, ${t.retweets} RTs):
${t.text}`).join('\n---')}

    EXTRACT signals following this exact structure for each discovery:

    For each signal found:
    1. Reference the tweet by number (e.g., "From Tweet #3")
    2. Categorize into: technical_achievement/product_launch/partnership/institutional_adoption/ecosystem_growth/exchange_listing/investment/security/documentation/team/community/development_milestone/announcement
    3. Extract specific details (names, numbers, URLs, dates)
    4. Assess importance and success indicators
    5. Note if claim is verifiable (has link/proof) vs unverifiable

    IGNORE:
    - Future promises without specific dates/details
    - Generic hype statements without substance
    - Defensive scam warnings
    - Price/market discussions
    - Vague "coming soon" announcements

    INCLUDE:
    - Completed actions ("launched", "released", "achieved", "integrated", "partnered")
    - Specific metrics/numbers ("10,000 TPS achieved", "$50M TVL reached")
    - Named partnerships/investors (with actual entity names)
    - Product releases with details/links
    - Verifiable technical milestones

    Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
    {
      "signals_found": [
        {
          "signal": "exact discovery as found in tweet",
          "tweet_ref": "Tweet #N",
          "date": "tweet date if available",
          "category": "one of the categories above",
          "details": {
            "type": "specific type of achievement",
            "metrics": "any numbers/metrics mentioned",
            "names": "specific entities/partners named",
            "urls": "any links mentioned"
          },
          "importance": "why this signal matters for project success",
          "success_indicator": "how strongly this predicts breakout potential",
          "verifiable": true/false,
          "similar_to": "what successful project this reminds you of"
        }
      ],
      "signal_categories": {
        "technical_achievement": 0,
        "product_launch": 0,
        "partnership": 0,
        "institutional_adoption": 0,
        "ecosystem_growth": 0,
        "exchange_listing": 0,
        "investment": 0,
        "security": 0,
        "documentation": 0,
        "team": 0,
        "community": 0,
        "development_milestone": 0,
        "announcement": 0
      },
      "red_flags": ["list any concerning patterns like excessive warnings, no concrete achievements, etc"],
      "summary": "2-3 sentence summary of what this project has actually achieved based on tweets"
    }
  `;

  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${kimiApiKey}`
    },
    body: JSON.stringify({
      model: 'kimi-k2-0905-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at identifying concrete achievements and developments in crypto project communications. You distinguish between actual deliverables and empty promises.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,  // Low temperature for consistent extraction
      max_tokens: 8000  // Reasonable limit to prevent truncation while allowing thorough analysis
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI analysis failed: ${error}`);
  }

  const result = await response.json();

  // Log token usage for Phase 1
  if (result.usage) {
    console.log(`📊 Phase 1 Token Usage:`, {
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      total_tokens: result.usage.total_tokens
    });
  }

  // Parse the AI response
  try {
    const content = result.choices[0].message.content;
    console.log('Raw AI response:', content.substring(0, 500)); // Log first 500 chars

    // Remove any markdown formatting if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Try to parse the JSON
    const parsed = JSON.parse(jsonStr);

    // Ensure required fields exist
    if (!parsed.signals_found) {
      parsed.signals_found = [];
    }
    if (!parsed.signal_categories) {
      // Count categories from signals
      parsed.signal_categories = {};
      for (const signal of parsed.signals_found) {
        const cat = signal.category;
        parsed.signal_categories[cat] = (parsed.signal_categories[cat] || 0) + 1;
      }
    }

    console.log('Successfully parsed AI response');
    return parsed;
  } catch (error) {
    console.error('Failed to parse AI response:', error.message);
    console.error('Full AI response:', result.choices[0].message.content);
    throw new Error(`Failed to parse AI analysis response: ${error.message}`);
  }
}

async function compareWithBenchmarks(signals: any[], benchmarks: any[], symbol: string) {
  const COMPARISON_PROMPT = `Evaluate extracted X/Twitter signals using BOTTOM-UP tier assignment.

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
        temperature: 0.3
        // No max_tokens limit - let model use what it needs
      })
    });

    if (!response.ok) {
      throw new Error(`AI comparison failed: ${await response.text()}`);
    }

    const result = await response.json();

    // Log token usage for Phase 2
    if (result.usage) {
      console.log(`📊 Phase 2 Token Usage:`, {
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens
      });
    }

    const content = result.choices[0].message.content;

    // Parse response
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('Benchmark comparison failed:', error);
    // Return a default evaluation
    return {
      final_tier: 4,
      tier_name: 'TRASH',
      final_score: 20,
      strongest_signal: 'Unable to evaluate signals',
      signal_evaluations: [],
      explanation: 'Evaluation failed, defaulting to lowest tier'
    };
  }
}

async function storeAnalysis(symbol: string, handle: string, analysis: any, tweets: Tweet[], timings: Record<string, number>, projectId?: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Calculate additional metrics
  const avgLikes = tweets.reduce((sum, t) => sum + t.likes, 0) / tweets.length;
  const avgRetweets = tweets.reduce((sum, t) => sum + t.retweets, 0) / tweets.length;
  const maxLikes = Math.max(...tweets.map(t => t.likes));
  const maxRetweets = Math.max(...tweets.map(t => t.retweets));

  // Add numbered IDs to tweets for reference
  const numberedTweets = tweets.map((tweet, index) => ({
    id: index + 1,
    ...tweet
  }));

  const updateData = {
    x_signals_found: analysis.signals_found || [],
    x_signal_categories: analysis.signal_categories || {},
    x_analysis_summary: analysis.summary || '',
    x_red_flags: analysis.red_flags || [],
    x_raw_tweets: numberedTweets, // Store all tweets with IDs
    x_raw_metrics: {
      tweets_analyzed: tweets.length,
      avg_likes: Math.round(avgLikes),
      avg_retweets: Math.round(avgRetweets),
      max_likes: maxLikes,
      max_retweets: maxRetweets,
      date_range: {
        oldest: tweets[tweets.length - 1]?.date || null,
        newest: tweets[0]?.date || null
      }
    },
    x_performance_metrics: {
      fetch_tweets_ms: timings.fetch_tweets_ms || 0,
      ai_analysis_ms: timings.ai_analysis_ms || 0,
      db_storage_ms: timings.db_storage_ms || 0,
      total_ms: timings.total_ms || 0
    },
    x_analyzed_at: new Date().toISOString()
  };

  let error = null;
  let usedProjectId = projectId;

  if (projectId) {
    // Update existing project
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update(updateData)
      .eq('id', projectId);

    error = updateError;
  } else {
    // Try to find project by symbol
    const { data: existingProject } = await supabase
      .from('crypto_projects_rated')
      .select('id')
      .eq('symbol', symbol)
      .single();

    if (existingProject) {
      usedProjectId = existingProject.id;
      const { error: updateError } = await supabase
        .from('crypto_projects_rated')
        .update(updateData)
        .eq('id', existingProject.id);

      error = updateError;
    } else {
      // Create new project entry
      const { data: newProject, error: insertError } = await supabase
        .from('crypto_projects_rated')
        .insert({
          symbol,
          x_handle: handle,
          ...updateData
        })
        .select('id')
        .single();

      error = insertError;
      usedProjectId = newProject?.id;
    }
  }

  if (error) {
    console.error('Database update error:', error);
  }

  return { error: error?.message, projectId: usedProjectId };
}