import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Configuration
    const PROJECTS_PER_RUN = 3;  // Process 3 projects per cron run

    // Get the next unanalyzed UTILITY projects (token_type = 'utility')
    const { data: nextProjects, error: fetchError } = await supabase
      .from('crypto_projects_rated')
      .select('id, symbol, twitter_url')
      .not('twitter_url', 'is', null)        // Must have Twitter handle
      .is('x_analyzed_at', null)             // Never analyzed
      .eq('token_type', 'utility')           // ONLY utility tokens
      .order('created_at', { ascending: true })  // Oldest projects first
      .limit(PROJECTS_PER_RUN);

    if (fetchError || !nextProjects || nextProjects.length === 0) {
      console.log('No unanalyzed projects found or error:', fetchError);
      const stats = await getAnalysisStats(supabase);
      return new Response(
        JSON.stringify({
          message: 'No projects to analyze',
          stats
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${nextProjects.length} projects to process`);

    // Get stats for immediate response
    const stats = await getAnalysisStats(supabase);

    // Process projects asynchronously (fire and forget)
    // This runs in the background and won't block the response
    processProjectsAsync(nextProjects, supabase).catch(error => {
      console.error('Background processing error:', error);
    });

    // Return immediately with success status
    return new Response(
      JSON.stringify({
        message: `Started processing ${nextProjects.length} projects`,
        queued: nextProjects.map(p => ({ symbol: p.symbol, twitter_url: p.twitter_url })),
        stats,
        note: 'Processing in background, check x_analyzed_at for completion'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cron job error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Async function to process projects in the background
async function processProjectsAsync(projects: any[], supabase: any) {
  console.log(`Background: Starting processing of ${projects.length} projects`);

  const results = [];
  for (const project of projects) {
    const twitterHandle = extractTwitterHandle(project.twitter_url);

    if (!twitterHandle) {
      console.error(`Invalid Twitter URL for ${project.symbol}: ${project.twitter_url}`);

      // Mark as attempted to skip next time
      await supabase
        .from('crypto_projects_rated')
        .update({ x_analysis_attempted: new Date().toISOString() })
        .eq('id', project.id);

      results.push({
        symbol: project.symbol,
        status: 'skipped',
        reason: 'Invalid Twitter handle'
      });
      continue;
    }

    console.log(`Background: Starting X analysis for ${project.symbol} (@${twitterHandle})`);

    try {
      // Call the V3 X analyzer function
      const analyzerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/x-signal-analyzer-v3`;

      const analyzerResponse = await fetch(analyzerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'analyze',
          symbol: project.symbol,
          handle: twitterHandle,
          projectId: project.id
        }),
      });

      if (!analyzerResponse.ok) {
        throw new Error(`Analyzer returned ${analyzerResponse.status}`);
      }

      // Process the SSE stream
      const reader = analyzerResponse.body?.getReader();
      const decoder = new TextDecoder();
      let result = {
        symbol: project.symbol,
        handle: twitterHandle,
        status: 'processing'
      };

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value);
            // Check for completion events in the SSE stream
            if (chunk.includes('phase1_complete')) {
              result.status = 'phase1_complete';
            }
            if (chunk.includes('phase2_complete') || chunk.includes('complete')) {
              result.status = 'completed';
              break;
            }
            if (chunk.includes('error')) {
              result.status = 'error';
              break;
            }
          }
        }
      }

      results.push(result);
      console.log(`Background: Completed ${project.symbol}: ${result.status}`);

      // Small delay between projects to avoid overload
      if (projects.indexOf(project) < projects.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      }

    } catch (error) {
      console.error(`Background: Error processing ${project.symbol}:`, error);
      results.push({
        symbol: project.symbol,
        status: 'error',
        error: error.message
      });
    }
  }

  console.log(`Background: Completed all ${results.length} projects`);
  return results;
}

// Helper function to extract Twitter handle from URL
function extractTwitterHandle(twitterUrl: string): string | null {
  if (!twitterUrl) return null;

  // Handle various Twitter URL formats
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

// Get analysis statistics (filtered for utility tokens only)
async function getAnalysisStats(supabase: any): Promise<any> {
  // Total utility tokens with Twitter
  const { count: totalUtilityCount } = await supabase
    .from('crypto_projects_rated')
    .select('*', { count: 'exact', head: true })
    .eq('token_type', 'utility')
    .not('twitter_url', 'is', null);

  // Analyzed utility tokens
  const { count: analyzedUtilityCount } = await supabase
    .from('crypto_projects_rated')
    .select('*', { count: 'exact', head: true })
    .eq('token_type', 'utility')
    .not('x_analyzed_at', 'is', null);

  // Utility tokens with score
  const { count: withScoreUtilityCount } = await supabase
    .from('crypto_projects_rated')
    .select('*', { count: 'exact', head: true })
    .eq('token_type', 'utility')
    .not('x_score', 'is', null);

  return {
    total_utility_with_twitter: totalUtilityCount || 0,
    analyzed_utility: analyzedUtilityCount || 0,
    utility_with_score: withScoreUtilityCount || 0,
    remaining_utility: (totalUtilityCount || 0) - (analyzedUtilityCount || 0),
    note: 'Statistics for utility tokens only'
  };
}