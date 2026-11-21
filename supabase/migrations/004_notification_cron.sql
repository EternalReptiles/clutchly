-- Runs the daily-digest Edge Function every hour. The function itself decides who is due a notification
-- (users whose chosen hour has just started in their timezone), so one hourly job covers every timezone.

-- The Edge Function uses the service role (server-side only). Newer projects don't grant it new tables automatically.
grant select, update on notification_settings to service_role;
grant select, delete on device_tokens to service_role;
grant select on animals, events, pairings, season_settings, animal_status to service_role;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-time setup, NOT stored in this file because it contains the secret. Use the same value as the function's
-- CRON_SECRET secret (Edge Functions > daily-digest > Secrets):
--   select vault.create_secret('<the secret>', 'clutchly_cron_secret');

-- Unschedule first so this file can be re-run safely.
select cron.unschedule(jobid) from cron.job where jobname = 'clutchly-daily-digest';
-- At 1 minute past every hour. Change the project URL if you use a different Supabase project.
select cron.schedule('clutchly-daily-digest', '1 * * * *', $$
  select net.http_post(
    url := 'https://xtjoypcgzfotjzskmggw.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'clutchly_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)
$$);
