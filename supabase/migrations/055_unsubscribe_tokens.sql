-- 055_unsubscribe_tokens.sql
-- Disiscrizione marketing via link email (FU-EMAIL-12).
-- Token opaco per-destinatario generato dalla edge `send-email` (service_role) e usato dalla edge
-- pubblica `unsubscribe` per impostare customers.marketing_consent = false.
--
-- SICUREZZA: la tabella NON deve mai essere accessibile dal client. Solo la edge (service_role)
-- la legge/scrive. RLS attiva + nessuna policy (default-deny) + REVOKE esplicito ad anon/authenticated
-- (le default privileges dello schema public li concederebbero, vedi regola Data API 30-05-2026).

CREATE TABLE IF NOT EXISTS public.unsubscribe_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT        UNIQUE NOT NULL,
  tenant_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS unsubscribe_tokens_token_idx ON public.unsubscribe_tokens (token);

ALTER TABLE public.unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

-- Nessuna policy: RLS default-deny. Solo service_role (che bypassa RLS) accede.
REVOKE ALL ON public.unsubscribe_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.unsubscribe_tokens TO service_role;
