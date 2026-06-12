-- ============================================================================
-- 046_codify_policy_drift.sql
-- ============================================================================
-- BOZZA WP-B1 — IN ATTESA DI APPROVAZIONE SENIOR + MATTEO. NON ANCORA APPLICATA.
--
-- Scopo: codificare nelle migrazioni versionate l'UNICO drift reale tra ciò che
-- le migrazioni dichiarano e le policy realmente presenti sul DB: la policy
-- `anon_select_active_organizations` su `organizations`.
--
-- Origine del drift (verificata in sola lettura su TEST docnnernvp e PROD
-- rwuxgvld il 12-06-26, i due ambienti sono IDENTICI):
--   - 026_security_hardening: revoca la SELECT pubblica sulla tabella e crea la
--     vista `organizations_public` (filtrata is_active = true) per la pagina
--     pubblica /prenota/:slug.
--   - 039_harden_organizations_public_view: imposta la vista a
--     security_invoker = true e dà ad anon il GRANT colonnare su organizations.
--     Con security_invoker la RLS della tabella viene valutata COME anon, quindi
--     serve una policy di riga per anon: ALTRIMENTI anon vede 0 righe e
--     /prenota/:slug risponde 406. La policy `anon_select_active_organizations`
--     è stata applicata fuori banda (via MCP) e MAI scritta in una migrazione.
--     Questo file la codifica, riconciliando l'intento della 039.
--
-- NOTA — restaurant_settings NON è drift: le policy reali (anon read in 001,
-- admin SELECT/INSERT/UPDATE/DELETE in 002 con current_admin_tenant_id()) sono
-- gia' pienamente ricostruibili da 001 + 002. Qui non si tocca: evitiamo una
-- seconda fonte per policy gia' versionate.
--
-- Confine con WP-B2: questo file NON restringe nulla. La lettura anonima
-- cross-tenant di restaurant_settings (anon USING true) resta intatta; il suo
-- irrigidimento e' compito di WP-B2, non di questo file.
--
-- Idempotente: DROP ... IF EXISTS + CREATE con la definizione reale.
-- ============================================================================

BEGIN;

-- organizations: policy SELECT per anon, necessaria alla vista organizations_public
-- (security_invoker dalla 039). Definizione identica a quella presente sul DB.
DROP POLICY IF EXISTS anon_select_active_organizations ON public.organizations;
CREATE POLICY anon_select_active_organizations ON public.organizations
  FOR SELECT TO anon
  USING (is_active = true);

COMMIT;
