-- ============================================================================
-- 026_security_hardening.sql  (2026-05-23)
-- ============================================================================
-- Audit di sicurezza DB produzione (rwuxgvld):
-- chiude 5 falle critiche + 4 hardening prima di accettare dati sensibili reali.
--
-- Riepilogo cambiamenti:
--   1. organizations: revoca SELECT pubblica tabella, sostituita con vista
--      organizations_public (espone solo campi necessari alla pagina /prenota).
--   2. invite_tokens: revoca SELECT/UPDATE da anon (le Edge Functions usano
--      service_role, non passano da RLS). Era leggibile/modificabile a chiunque.
--   3. check_admin_email: REVOKE EXECUTE da anon → chiude enumerazione email
--      per phishing. Frontend aggiornato per chiamarla via client autenticato.
--   4. insert_service_slot / update_service_slot / insert_service_slot_override:
--      REVOKE EXECUTE da anon + check interno tenant_id == current_admin_tenant_id()
--      → blocca anche admin che provano a scrivere su altri tenant.
--   5. Altre RPC SECURITY DEFINER: revoca EXECUTE da anon dove non serve.
--   6. FORCE ROW LEVEL SECURITY su tabelle con dati sensibili / PII.
--   7. search_path fisso su funzioni vulnerabili (privilege escalation guard).
--   8. Revoca GRANT pericolosi tabelle (TRUNCATE/TRIGGER/REFERENCES) da
--      anon/authenticated → seconda barriera oltre RLS.
--   9. Indici mancanti su FK (performance).
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. organizations: revoca SELECT pubblica, esponi vista ristretta
-- ─────────────────────────────────────────────────────────────────────────────
-- La pagina pubblica /prenota/:slug legge organizations per risolvere il
-- tenant dallo slug. Non deve vedere plan, max_bookings_*, edition completa.
-- Edge Function create-booking usa service_role → bypassa RLS, continua a vedere tutto.

DROP POLICY IF EXISTS anyone_select_organizations ON public.organizations;

-- Solo admin loggati possono leggere le proprie organizations dalla tabella.
CREATE POLICY admin_select_own_organization ON public.organizations
  FOR SELECT TO authenticated
  USING (id = current_admin_tenant_id());

-- Vista per uso pubblico (form prenotazione /prenota/:slug): solo campi safe.
-- Senza security_invoker: la vista gira col proprietario (postgres) e bypassa
-- la policy admin_select_own_organization. Espone solo i 5 campi non sensibili
-- ed è filtrata su is_active = true.
DROP VIEW IF EXISTS public.organizations_public;
CREATE VIEW public.organizations_public AS
SELECT id, name, slug, is_active, edition
FROM public.organizations
WHERE is_active = true;

REVOKE ALL ON public.organizations_public FROM PUBLIC;
GRANT SELECT ON public.organizations_public TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. invite_tokens: revoca SELECT/UPDATE da anon (Edge Function usa service_role)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anon_select_invite_tokens ON public.invite_tokens;
DROP POLICY IF EXISTS anon_update_invite_tokens ON public.invite_tokens;

-- Nessuna policy = nessun accesso via PostgREST per anon/authenticated.
-- validate-invite Edge Function usa service_role e continua a funzionare.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. check_admin_email: solo per authenticated (chiude phishing enumeration)
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.check_admin_email(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.check_admin_email(text) TO authenticated;

-- Aggiungiamo search_path fisso per chiudere il warning function_search_path_mutable.
ALTER FUNCTION public.check_admin_email(text) SET search_path = public, pg_temp;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC service_slot: blocca anon + valida tenant_id == current_admin_tenant_id()
-- ─────────────────────────────────────────────────────────────────────────────
-- Anche se la firma accetta p_tenant_id, ora la funzione verifica che
-- coincida col tenant dell'admin loggato. Admin di tenant A non possono
-- più scrivere fasce nel tenant B nemmeno conoscendone l'UUID.

REVOKE EXECUTE ON FUNCTION public.insert_service_slot(uuid, text, text, text, integer, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_service_slot(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.insert_service_slot_override(jsonb) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.insert_service_slot(uuid, text, text, text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_service_slot(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_service_slot_override(jsonb) TO authenticated;

-- Riscrittura insert_service_slot in plpgsql per aggiungere il check tenant.
CREATE OR REPLACE FUNCTION public.insert_service_slot(
  p_tenant_id uuid,
  p_name text,
  p_start_time text,
  p_end_time text,
  p_max_turns integer,
  p_max_guests integer,
  p_display_order integer
)
RETURNS SETOF service_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF p_tenant_id IS DISTINCT FROM current_admin_tenant_id() THEN
    RAISE EXCEPTION 'tenant mismatch: cannot write across tenants'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  RETURN QUERY
  INSERT INTO service_slots (tenant_id, name, start_time, end_time, max_turns, max_guests, display_order)
  VALUES (p_tenant_id, p_name, p_start_time::time, p_end_time::time, p_max_turns, p_max_guests, p_display_order)
  RETURNING *;
END;
$function$;

-- update_service_slot: verifica tenant coerente PRIMA dell'update.
-- Rispetta esattamente lo schema esistente (max_turns_resume, payload->>'tenant_id').
CREATE OR REPLACE FUNCTION public.update_service_slot(payload jsonb)
RETURNS SETOF service_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_payload_tenant uuid := (payload->>'tenant_id')::uuid;
BEGIN
  IF v_payload_tenant IS DISTINCT FROM current_admin_tenant_id() THEN
    RAISE EXCEPTION 'tenant mismatch: cannot update slot of another tenant'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  UPDATE service_slots SET
    name              = COALESCE(payload->>'name', name),
    start_time        = COALESCE((payload->>'start_time')::time, start_time),
    end_time          = COALESCE((payload->>'end_time')::time, end_time),
    max_turns         = CASE WHEN payload ? 'max_turns'
                             THEN NULLIF(payload->>'max_turns','')::integer
                             ELSE max_turns END,
    max_turns_resume  = CASE WHEN payload ? 'max_turns_resume'
                             THEN NULLIF(payload->>'max_turns_resume','')::integer
                             ELSE max_turns_resume END,
    max_guests        = CASE WHEN payload ? 'max_guests'
                             THEN NULLIF(payload->>'max_guests','')::integer
                             ELSE max_guests END,
    display_order     = COALESCE((payload->>'display_order')::integer, display_order),
    updated_at        = now()
  WHERE id = (payload->>'id')::uuid
    AND tenant_id = v_payload_tenant
  RETURNING *;
END;
$function$;

-- insert_service_slot_override: rispetta schema esistente (date_from/date_to).
CREATE OR REPLACE FUNCTION public.insert_service_slot_override(payload jsonb)
RETURNS SETOF service_slot_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tenant uuid := (payload->>'tenant_id')::uuid;
BEGIN
  IF v_tenant IS DISTINCT FROM current_admin_tenant_id() THEN
    RAISE EXCEPTION 'tenant mismatch: cannot write override for another tenant'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  INSERT INTO service_slot_overrides (
    tenant_id, service_slot_id, date_from, date_to, max_turns, max_guests
  )
  VALUES (
    v_tenant,
    (payload->>'service_slot_id')::uuid,
    (payload->>'date_from')::date,
    (payload->>'date_to')::date,
    CASE WHEN payload ? 'max_turns'
         THEN NULLIF(payload->>'max_turns','')::integer END,
    CASE WHEN payload ? 'max_guests'
         THEN NULLIF(payload->>'max_guests','')::integer END
  )
  RETURNING *;
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Altre RPC SECURITY DEFINER: lockdown EXECUTE
-- ─────────────────────────────────────────────────────────────────────────────
-- current_admin_tenant_id: chiamata implicitamente dalle RLS policy.
-- Lasciamo EXECUTE ad authenticated (serve nelle policy quando admin logga).
-- Revoca da anon (non ha senso che la chiami).
REVOKE EXECUTE ON FUNCTION public.current_admin_tenant_id() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.current_admin_tenant_id() TO authenticated;

-- cleanup_rate_limits: dovrebbe essere chiamata da cron/service_role, non da utenti.
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits() FROM anon, authenticated, public;
ALTER FUNCTION public.cleanup_rate_limits() SET search_path = public, pg_temp;

-- Trigger functions: non vengono chiamate via REST ma la EXECUTE su pg_proc
-- è comunque grant-ata di default a public. Revoca per pulizia.
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_customer_tenant() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_table_tenant() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_booking_tenant() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_room_tenant() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.customers_normalize_email() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_booking_count_on_accept() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.increment_booking_request_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.seed_default_menu_categories_for_organization() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.seed_default_service_slots_for_organization() FROM anon, authenticated, public;

-- search_path fisso su tutte le funzioni segnalate dall'advisor.
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_customer_tenant() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_table_tenant() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_booking_tenant() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_room_tenant() SET search_path = public, pg_temp;
ALTER FUNCTION public.customers_normalize_email() SET search_path = public, pg_temp;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FORCE ROW LEVEL SECURITY su tabelle con PII / dati sensibili
-- ─────────────────────────────────────────────────────────────────────────────
-- Con FORCE RLS, anche il proprietario della tabella (non solo i non-owner)
-- deve passare per le policy. service_role continua a bypassare RLS per design
-- in Supabase (è grant-ato BYPASSRLS), quindi le Edge Functions non si rompono.
-- Questo è una rete di sicurezza contro bug futuri.

ALTER TABLE public.customers          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invite_tokens      FORCE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Revoca GRANT pericolosi su tabelle (seconda barriera oltre RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- Oggi anon ha GRANT TRUNCATE/TRIGGER/REFERENCES su tutto. Pericoloso se un
-- domani disabilitiamo per sbaglio RLS su una tabella. Rimuoviamo tutto il
-- superfluo e ri-grantiamo solo ciò che serve davvero.

-- admin_users: solo authenticated può leggere (via policy). anon non tocca nulla.
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT  SELECT ON public.admin_users TO authenticated;

-- invite_tokens: anon/authenticated non passano da PostgREST (solo Edge Function).
REVOKE ALL ON public.invite_tokens FROM anon, authenticated;

-- booking_requests: admin loggato R/W tramite policy. anon NON inserisce qui
-- direttamente (passa per Edge Function create-booking con service_role).
REVOKE ALL ON public.booking_requests FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.booking_requests TO authenticated;

-- customers: solo admin loggato (Pro/Enterprise) via policy.
REVOKE ALL ON public.customers FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;

-- email_logs: solo admin loggato via policy.
REVOKE ALL ON public.email_logs FROM anon, authenticated;
GRANT  SELECT, INSERT ON public.email_logs TO authenticated;

-- menu_categories / menu_items: admin R/W; anon legge menu_items (policy esistente).
REVOKE ALL ON public.menu_categories FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;

REVOKE ALL ON public.menu_items FROM anon, authenticated;
GRANT  SELECT ON public.menu_items TO anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;

-- restaurant_settings: anon legge (form pubblico), admin R/W.
REVOKE ALL ON public.restaurant_settings FROM anon, authenticated;
GRANT  SELECT ON public.restaurant_settings TO anon;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.restaurant_settings TO authenticated;

-- service_slots: anon non legge direttamente, admin R/W via RPC.
-- (la policy esistente è su ruolo 'public' ma serve current_admin_tenant_id → ok).
REVOKE ALL ON public.service_slots FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.service_slots TO authenticated;

-- service_slot_overrides: come service_slots.
REVOKE ALL ON public.service_slot_overrides FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.service_slot_overrides TO authenticated;

-- rooms / tables / booking_table_assignments: admin Pro/Enterprise via policy.
REVOKE ALL ON public.rooms FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;

REVOKE ALL ON public.tables FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.tables TO authenticated;

REVOKE ALL ON public.booking_table_assignments FROM anon, authenticated;
GRANT  SELECT, INSERT, UPDATE, DELETE ON public.booking_table_assignments TO authenticated;

-- organizations: leggere/scrivere via tabella solo authenticated (policy filtra
-- per current_admin_tenant_id). anon usa la vista organizations_public.
REVOKE ALL ON public.organizations FROM anon, authenticated;
GRANT  SELECT ON public.organizations TO authenticated;

-- tenant_usage: solo admin loggato legge il proprio usage.
REVOKE ALL ON public.tenant_usage FROM anon, authenticated;
GRANT  SELECT ON public.tenant_usage TO authenticated;

-- rate_limits: scritta da Edge Function (service_role) + anon insert proprio.
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT  INSERT ON public.rate_limits TO anon;
GRANT  SELECT, INSERT ON public.rate_limits TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Indici mancanti su FK (advisor performance)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bta_service_slot
  ON public.booking_table_assignments (service_slot_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_booking
  ON public.email_logs (booking_id);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_org
  ON public.invite_tokens (organization_id);


COMMIT;
