-- WP-B5: cleanup automatico per rate limit e blacklist IP scaduta.
-- pg_cron crea lo schema cron; i job vanno gestiti tramite cron.schedule/unschedule.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.rate_limits
  WHERE requested_at < now() - INTERVAL '1 hour';

  DELETE FROM public.ip_blacklist
  WHERE expires_at < now() - INTERVAL '1 day';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM anon, authenticated, public;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'cleanup-rate-limits-hourly'
  ) THEN
    PERFORM cron.unschedule('cleanup-rate-limits-hourly');
  END IF;

  PERFORM cron.schedule(
    'cleanup-rate-limits-hourly',
    '17 * * * *',
    $job$SELECT public.cleanup_rate_limits();$job$
  );
END
$$;
