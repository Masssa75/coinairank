import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';

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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse parameters based on request method
    let action, symbol, handle, projectId;

    if (req.method === 'GET') {
      // EventSource uses GET with URL parameters
      const url = new URL(req.url);
      action = url.searchParams.get('action');
      symbol = url.searchParams.get('symbol');
      handle = url.searchParams.get('handle');
      projectId = url.searchParams.get('projectId');
    } else {
      // Regular POST request with JSON body
      const body = await req.json();
      action = body.action;
      symbol = body.symbol;
      handle = body.handle;
      projectId = body.projectId;
    }

    // V3 is SSE-only - if no Accept header is specified, default to SSE
    console.log('V3 request with params:', { action, symbol, handle, projectId });

    // SSE Implementation
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Helper to send SSE messages
    const sendEvent = async (event: string, data: any) => {
      const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(message));
    };

    // Process in background
    (async () => {
      try {
        if (action === 'analyze') {
          await processPhase1WithSSE(symbol, handle, projectId, sendEvent);
        } else if (action === 'compare') {
          await processPhase2WithSSE(symbol, sendEvent);
        }

        await sendEvent('complete', { message: 'Analysis complete' });
      } catch (error) {
        await sendEvent('error', {
          message: error.message || 'An error occurred',
          details: error.toString()
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in x-signal-analyzer-v3:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processPhase1WithSSE(
  symbol: string,
  handle: string,
  projectId: string | undefined,
  sendEvent: (event: string, data: any) => Promise<void>
) {
  const startTime = Date.now();

  // Step 1: Initialize
  await sendEvent('starting', {
    message: `Initializing X analysis for @${handle}...`,
    symbol,
    handle
  });

  // Step 2: Fetch tweets
  await sendEvent('fetching_tweets', {
    message: 'Connecting to Nitter via ScraperAPI...'
  });

  const fetchStart = Date.now();
  const tweets = await fetchTwitterHistoryWithProgress(handle, sendEvent);
  const fetchDuration = Date.now() - fetchStart;

  await sendEvent('tweets_complete', {
    message: `Successfully fetched ${tweets.length} tweets`,
    count: tweets.length,
    duration_ms: fetchDuration
  });

  if (tweets.length === 0) {
    throw new Error('No tweets found');
  }

  // Step 3: Store tweets
  await sendEvent('storing_tweets', {
    message: 'Storing tweets in database...'
  });

  // Step 4: AI Analysis
  const tokenCount = JSON.stringify(tweets).length;
  await sendEvent('ai_preparing', {
    message: `Preparing AI analysis (~${Math.round(tokenCount/4)} tokens)...`
  });

  const aiStart = Date.now();
  await sendEvent('ai_analyzing', {
    message: 'AI extracting signals from tweets...'
  });

  const analysis = await analyzeWithAI(symbol, handle, tweets, sendEvent);
  const aiDuration = Date.now() - aiStart;

  await sendEvent('ai_complete', {
    message: `Found ${analysis.signals_found?.length || 0} signals in ${Math.round(aiDuration/1000)}s`,
    signals_count: analysis.signals_found?.length || 0,
    duration_ms: aiDuration
  });

  // Step 5: Store in database
  await sendEvent('db_storing', {
    message: 'Saving analysis results...'
  });

  const dbStart = Date.now();
  const dbResult = await storeAnalysis(symbol, handle, analysis, tweets, {
    fetch_tweets_ms: fetchDuration,
    ai_analysis_ms: aiDuration,
    db_storage_ms: 0,
    total_ms: Date.now() - startTime
  }, projectId);
  const dbDuration = Date.now() - dbStart;

  await sendEvent('phase1_complete', {
    message: `Phase 1 complete in ${Math.round((Date.now() - startTime)/1000)}s`,
    total_duration_ms: Date.now() - startTime,
    result: {
      success: true,
      phase: 1,
      symbol,
      handle,
      tweets_analyzed: tweets.length,
      signals_found: analysis.signals_found,
      signal_categories: analysis.signal_categories,
      red_flags: analysis.red_flags,
      analysis_summary: analysis.summary
    }
  });
}

async function processPhase2WithSSE(
  symbol: string,
  sendEvent: (event: string, data: any) => Promise<void>
) {
  const startTime = Date.now();

  await sendEvent('phase2_starting', {
    message: 'Starting benchmark comparison...',
    symbol
  });

  // Load benchmarks
  await sendEvent('benchmarks_loading', {
    message: 'Loading tier benchmarks...'
  });

  const benchmarks = await loadBenchmarks();

  // Get signals from database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: project } = await supabase
    .from('crypto_projects_rated')
    .select('x_signals_found')
    .eq('symbol', symbol)
    .single();

  const signals = project?.x_signals_found || [];

  await sendEvent('comparing_signals', {
    message: `Comparing ${signals.length} signals to benchmarks...`,
    signals_count: signals.length
  });

  // Compare with benchmarks
  const comparison = await compareWithBenchmarks(signals, benchmarks, symbol, sendEvent);

  await sendEvent('tier_calculation', {
    message: `Calculating final tier and score...`
  });

  // Store results
  await supabase
    .from('crypto_projects_rated')
    .update({
      x_stage1_score: comparison.final_score,
      x_stage1_tier: comparison.tier_name,
      x_stage1_analysis: comparison
    })
    .eq('symbol', symbol);

  await sendEvent('phase2_complete', {
    message: `Analysis complete: ${comparison.tier_name} (Score: ${comparison.final_score})`,
    total_duration_ms: Date.now() - startTime,
    result: {
      success: true,
      phase: 2,
      symbol,
      final_tier: comparison.final_tier,
      tier_name: comparison.tier_name,
      final_score: comparison.final_score,
      strongest_signal: comparison.strongest_signal,
      signal_evaluations: comparison.signal_evaluations,
      explanation: comparison.explanation
    }
  });
}

async function fetchTwitterHistoryWithProgress(
  handle: string,
  sendEvent: (event: string, data: any) => Promise<void>
): Promise<Tweet[]> {
  const tweets: Tweet[] = [];
  const scraperApiKey = Deno.env.get('SCRAPERAPI_KEY');

  if (!scraperApiKey) {
    throw new Error('SCRAPERAPI_KEY not configured');
  }

  const cursors = ['', '?cursor=20', '?cursor=40', '?cursor=60', '?cursor=80'];

  for (let i = 0; i < cursors.length; i++) {
    const cursor = cursors[i];
    try {
      const nitterUrl = `https://nitter.net/${handle}${cursor}`;
      const scraperUrl = `https://api.scraperapi.com/?api_key=${scraperApiKey}&url=${encodeURIComponent(nitterUrl)}`;

      await sendEvent('tweets_progress', {
        message: `Fetching tweets (page ${i + 1}/${cursors.length})...`,
        current_page: i + 1,
        total_pages: cursors.length,
        tweets_so_far: tweets.length
      });

      const response = await fetch(scraperUrl);

      if (!response.ok) {
        console.error(`Failed to fetch page ${cursor}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      let tweetsOnPage = 0;
      $('.timeline-item').each((index, element) => {
        const $element = $(element);

        if ($element.find('.retweet-header').length > 0) {
          return;
        }

        const tweetContent = $element.find('.tweet-content').text().trim();
        const tweetDate = $element.find('.tweet-date').text().trim();

        if (!tweetContent || tweetContent.length < 5) {
          return;
        }

        const statsContainer = $element.find('.tweet-stats');
        const likesText = statsContainer.find('.icon-heart').parent().text().trim();
        const retweetsText = statsContainer.find('.icon-retweet').parent().text().trim();

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

      await sendEvent('tweets_progress', {
        message: `Found ${tweets.length} tweets so far...`,
        tweets_count: tweets.length,
        page_tweets: tweetsOnPage
      });

      if (tweets.length >= 20 || tweetsOnPage === 0) {
        break;
      }

    } catch (error) {
      console.error(`Error fetching page ${cursor}:`, error);
      if (tweets.length > 0) {
        break;
      }
    }
  }

  return tweets;
}

async function analyzeWithAI(
  symbol: string,
  handle: string,
  tweets: Tweet[],
  sendEvent: (event: string, data: any) => Promise<void>
): Promise<any> {
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
      "red_flags": ["list of concerning patterns or issues"],
      "summary": "2-3 sentence summary of project status based on tweets"
    }`;

  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${kimiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'kimi-k2-0905-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const result = await response.json();

  if (result.usage) {
    await sendEvent('ai_tokens', {
      message: 'Token usage',
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      total_tokens: result.usage.total_tokens
    });
  }

  const content = result.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse AI response:', content);
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
}

async function compareWithBenchmarks(
  signals: any[],
  benchmarks: any[],
  symbol: string,
  sendEvent: (event: string, data: any) => Promise<void>
): Promise<any> {
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
    })
  });

  if (!response.ok) {
    throw new Error(`Comparison API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse comparison:', content);
    throw new Error('Failed to parse comparison result');
  }
}

async function storeAnalysis(
  symbol: string,
  handle: string,
  analysis: any,
  tweets: Tweet[],
  timings: Record<string, number>,
  projectId?: string
): Promise<any> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Calculate metrics
  const avgLikes = tweets.reduce((sum, t) => sum + t.likes, 0) / tweets.length;
  const avgRetweets = tweets.reduce((sum, t) => sum + t.retweets, 0) / tweets.length;
  const maxLikes = Math.max(...tweets.map(t => t.likes));
  const maxRetweets = Math.max(...tweets.map(t => t.retweets));

  // Add numbered IDs to tweets for storage
  const numberedTweets = tweets.map((tweet, index) => ({
    id: index + 1,
    ...tweet
  }));

  const updateData = {
    x_signals_found: analysis.signals_found || [],
    x_signal_categories: analysis.signal_categories || {},
    x_analysis_summary: analysis.summary || '',
    x_red_flags: analysis.red_flags || [],
    x_raw_tweets: numberedTweets,
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
    const { error: updateError } = await supabase
      .from('crypto_projects_rated')
      .update(updateData)
      .eq('id', projectId);
    error = updateError;
  } else {
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
    }
  }

  return { error, projectId: usedProjectId };
}

async function loadBenchmarks(): Promise<any[]> {
  // Hardcoded benchmarks for now
  return [
    {
      tier: 1,
      name: "ALPHA",
      score_range: "90-100",
      benchmarks: [
        "Major exchange listing announcement (Binance/Coinbase)",
        "Lead investor is tier-1 VC (a16z, Paradigm, Sequoia)",
        "$100M+ funding round completed",
        "Verifiable 10,000+ TPS on mainnet"
      ]
    },
    {
      tier: 2,
      name: "SOLID",
      score_range: "70-89",
      benchmarks: [
        "Mid-tier exchange listing (Kraken, KuCoin)",
        "Multiple named partnerships with known companies",
        "$10M+ funding with named investors",
        "Mainnet live with working product"
      ]
    },
    {
      tier: 3,
      name: "BASIC",
      score_range: "40-69",
      benchmarks: [
        "Small exchange listing or DEX only",
        "Testnet launched with public access",
        "Team has shipped previous projects",
        "Active GitHub with regular commits"
      ]
    },
    {
      tier: 4,
      name: "TRASH",
      score_range: "0-39",
      benchmarks: [
        "No concrete achievements, only promises",
        "Anonymous team with no track record",
        "Copy-paste whitepaper or no documentation",
        "Inactive development for 3+ months"
      ]
    }
  ];
}

// Backward compatibility - regular JSON responses
async function handleRegularRequest(
  action: string,
  symbol: string,
  handle: string,
  projectId?: string
): Promise<Response> {
  // Implementation similar to V2 but without SSE
  // This ensures existing UI continues to work
  return new Response(
    JSON.stringify({
      message: 'Please use SSE by setting Accept: text/event-stream header'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}