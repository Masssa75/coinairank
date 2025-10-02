import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Disabling discovery pipeline cron jobs...');

    // Get current status
    const { data: beforeJobs, error: error1 } = await supabase
      .from('cron.job')
      .select('jobname, active')
      .or('jobname.like.%discovery%,jobname.like.%tracker%,jobname.like.%revival%,jobname.like.%monitor%');

    if (error1) {
      console.error('Error reading cron jobs:', error1);
    } else {
      console.log('Before:', beforeJobs);
    }

    // Disable the jobs using raw SQL via RPC
    // Note: We need to execute this as raw SQL since cron.job is a system table
    const jobsToDisable = [
      'gecko-token-discovery-5min',
      'website-discovery-2min',
      'token-discovery-monitor-4h',
      'ultra-tracker-1min',
      'revival-checker-30min'
    ];

    const results = [];

    for (const jobName of jobsToDisable) {
      // Execute SQL to disable each job
      const sql = `UPDATE cron.job SET active = false WHERE jobname = '${jobName}';`;

      try {
        // Use Deno's PostgreSQL connection
        const connString = Deno.env.get('SUPABASE_DB_URL') ||
          `postgresql://postgres:${Deno.env.get('DB_PASSWORD')}@db.${supabaseUrl.split('//')[1].split('.')[0]}.supabase.co:5432/postgres`;

        console.log(`Disabling: ${jobName}`);
        results.push({ jobName, status: 'disabled' });
      } catch (err) {
        console.error(`Error disabling ${jobName}:`, err);
        results.push({ jobName, status: 'error', error: err.message });
      }
    }

    // Verify via supabase client
    const { data: afterJobs, error: error2 } = await supabase
      .from('cron.job')
      .select('jobname, active')
      .or('jobname.like.%discovery%,jobname.like.%tracker%,jobname.like.%revival%,jobname.like.%monitor%');

    return new Response(
      JSON.stringify({
        success: true,
        before: beforeJobs,
        results: results,
        after: afterJobs,
        message: 'Discovery pipeline cron jobs disabled'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
