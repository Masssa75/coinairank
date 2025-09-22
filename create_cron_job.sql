-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Delete existing job if it exists
SELECT cron.unschedule('x-analyzer-cron-job');

-- Create new cron job that runs every minute
SELECT cron.schedule(
  'x-analyzer-cron-job',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://smxnzdwuvcoasitsxytk.supabase.co/functions/v1/x-analyzer-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'x-analyzer-cron-job';