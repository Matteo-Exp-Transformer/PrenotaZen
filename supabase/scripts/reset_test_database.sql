-- =============================================================================
-- RESET DB TEST — dati applicativi + auth, schema invariato
-- =============================================================================
--
-- Progetto ammesso: TEST docnnernvpyrbwuzzach (ref URL contiene "docnnernvp")
-- VIETATO su PROD rwuxgvld — verificare con MCP get_project_url prima di eseguire.
--
-- Effetto: zero organizations / tenant / admin_users / prenotazioni / menu /
-- clienti CRM / QR / impostazioni. Anche auth.users vuoto.
-- NON tocca: migrazioni, funzioni, trigger, policy RLS, viste.
--
-- Dopo il reset: ricreare i tenant E2E se servono → tests/README.md §3
-- Storage bucket "menu-photos": file orfani possono restare (pulizia separata).
--
-- Procedura: supabase/scripts/README_RESET_TEST_DATABASE.md
-- Esecuzione: Supabase Studio (SQL) sul progetto TEST, oppure MCP execute_sql
-- sul server user-supabase-test (mai user-supabase-prod).
-- =============================================================================

BEGIN;

-- 1) Prenotazioni e legami (booking_requests → organizations è ON DELETE RESTRICT)
DELETE FROM public.booking_table_assignments;
DELETE FROM public.email_logs;
DELETE FROM public.booking_requests;

-- 2) Contatori / anti-abuso globali (non legati a tenant)
DELETE FROM public.rate_limits;
DELETE FROM public.ip_blacklist;

-- 3) Registry tenant — CASCADE su tabelle public con tenant_id / organization_id
DELETE FROM public.organizations;

-- 4) Supabase Auth (ordine dipendenze)
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;
DELETE FROM auth.mfa_challenges;
DELETE FROM auth.mfa_factors;
DELETE FROM auth.one_time_tokens;
DELETE FROM auth.identities;
DELETE FROM auth.users;

COMMIT;

-- Verifica post-reset (atteso: 0 righe / 0 utenti)
SELECT 'organizations' AS tabella, count(*)::int AS righe FROM public.organizations
UNION ALL SELECT 'admin_users', count(*)::int FROM public.admin_users
UNION ALL SELECT 'booking_requests', count(*)::int FROM public.booking_requests
UNION ALL SELECT 'customers', count(*)::int FROM public.customers
UNION ALL SELECT 'auth.users', count(*)::int FROM auth.users;
