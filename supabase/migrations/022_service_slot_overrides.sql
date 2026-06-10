-- Override temporanei per fascia oraria: modifica max_turns/max_guests valida
-- solo in un intervallo di date, poi la fascia torna ai valori base di service_slots.
-- Caso d'uso: "metti 40 coperti su Colazione fino a fine mese, poi torna a 30".
--
-- Risoluzione "vince il più specifico" (decisione utente): a parità di giorno
-- coperto da più override sulla stessa fascia, vince quello con l'intervallo
-- (date_to - date_from) più corto. La logica di risoluzione vive lato app
-- (resolveSlotOverride) e nel capacity check; questa tabella è solo storage.

CREATE TABLE service_slot_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_slot_id UUID NOT NULL REFERENCES service_slots(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  -- Stessa semantica di service_slots: NULL = nessun limite (turni: illimitato;
  -- coperti: nessun limite). 0 su max_turns = fascia chiusa.
  max_turns INTEGER,
  max_guests INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_override_date_order CHECK (date_to >= date_from)
);

CREATE INDEX idx_slot_overrides_tenant ON service_slot_overrides(tenant_id);
CREATE INDEX idx_slot_overrides_slot ON service_slot_overrides(service_slot_id);
-- Lookup tipico: override attivi di un tenant in una data.
CREATE INDEX idx_slot_overrides_range ON service_slot_overrides(tenant_id, date_to);

ALTER TABLE service_slot_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_slot_overrides"
  ON service_slot_overrides FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_slot_overrides"
  ON service_slot_overrides FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_slot_overrides"
  ON service_slot_overrides FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_slot_overrides"
  ON service_slot_overrides FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());

-- RPC di inserimento: firma a parametro jsonb singolo, stessa scelta di
-- update_service_slot (migration 021) — firma univoca, immune a PGRST202.
-- max_turns / max_guests: chiave assente o '' → NULL (nessun limite).
CREATE OR REPLACE FUNCTION public.insert_service_slot_override(payload jsonb)
RETURNS SETOF service_slot_overrides
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO service_slot_overrides (
    tenant_id, service_slot_id, date_from, date_to, max_turns, max_guests
  )
  VALUES (
    (payload->>'tenant_id')::uuid,
    (payload->>'service_slot_id')::uuid,
    (payload->>'date_from')::date,
    (payload->>'date_to')::date,
    CASE WHEN payload ? 'max_turns'
         THEN NULLIF(payload->>'max_turns', '')::integer END,
    CASE WHEN payload ? 'max_guests'
         THEN NULLIF(payload->>'max_guests', '')::integer END
  )
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.insert_service_slot_override(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
