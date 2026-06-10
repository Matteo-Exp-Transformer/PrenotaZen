-- 027_ip_blacklist.sql (2026-05-23)
-- Tabella per blacklist automatica IP che superano il rate limit ripetutamente.
-- Usata da Edge Function create-booking: max 3 richieste/min; 2 sforamenti in
-- finestra 10 min → IP bloccato per 24h. La scadenza automatica evita di
-- bannare permanentemente IP dinamici (NAT, mobile, WiFi pubblici).
-- Solo service_role accede (Edge Function); anon/authenticated bloccati.

CREATE TABLE IF NOT EXISTS public.ip_blacklist (
  ip_address text PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  reason     text NOT NULL DEFAULT 'rate_limit_violation'
);

CREATE INDEX IF NOT EXISTS idx_ip_blacklist_expires ON public.ip_blacklist (expires_at);

ALTER TABLE public.ip_blacklist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ip_blacklist FROM anon, authenticated;
