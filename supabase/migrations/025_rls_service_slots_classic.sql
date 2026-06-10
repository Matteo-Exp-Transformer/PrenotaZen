-- Migration 025: apre RLS di service_slots a tutte le edition.
--
-- Contesto: la migration 014 aveva gated le 4 policy (SELECT/INSERT/UPDATE/DELETE) su
-- service_slots all'edition 'pro' o 'enterprise', quando le fasce erano una feature
-- Pro. Dopo Fase 2 il modello dati e' cambiato: Classic usa service_slots come fonte
-- primaria delle proprie fasce orarie (configurabili da Impostazioni). Effetto del
-- gating residuo: in Classic SELECT e DELETE diretti venivano silenziosamente bloccati
-- (INSERT/UPDATE passavano via RPC SECURITY DEFINER), causando duplicati al
-- salvataggio e sezione fasce sempre vuota.
--
-- Le nuove policy mantengono il vincolo di tenant isolation (tenant_id =
-- current_admin_tenant_id()) ma rimuovono il filtro sull'edition.
--
-- service_slot_overrides NON ha bisogno di modifiche: le sue policy originali
-- (migration 022) sono gia' aperte a tutte le edition (nessun gate edition).

DROP POLICY IF EXISTS "admin_select_service_slots" ON service_slots;
DROP POLICY IF EXISTS "admin_insert_service_slots" ON service_slots;
DROP POLICY IF EXISTS "admin_update_service_slots" ON service_slots;
DROP POLICY IF EXISTS "admin_delete_service_slots" ON service_slots;

CREATE POLICY "admin_select_service_slots" ON service_slots
  FOR SELECT
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_service_slots" ON service_slots
  FOR INSERT
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_service_slots" ON service_slots
  FOR UPDATE
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_service_slots" ON service_slots
  FOR DELETE
  USING (tenant_id = current_admin_tenant_id());
