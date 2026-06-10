-- Sale (rooms) come entità separate + coordinate tavoli per la mappa drag-and-drop.
-- La colonna `placement` rimane in `tables` per retrocompatibilità con F1;
-- sarà rimossa nella migrazione 010.

-- ----------------------------------------------------------------
-- Tabella rooms
-- ----------------------------------------------------------------
CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  width         INTEGER NOT NULL DEFAULT 800,
  height        INTEGER NOT NULL DEFAULT 600,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rooms_tenant_id_idx ON rooms (tenant_id);

CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger che impedisce a un admin di inserire/aggiornare rooms di altri tenant
CREATE OR REPLACE FUNCTION enforce_room_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE caller_tenant uuid;
BEGIN
  IF auth.role() = 'authenticated' THEN
    caller_tenant := current_admin_tenant_id();
    IF caller_tenant IS NULL THEN
      RAISE EXCEPTION 'admin non riconosciuto (email JWT non in admin_users)';
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM caller_tenant THEN
      RAISE EXCEPTION 'tenant_id (%) diverso dal tenant dell''admin (%)',
        NEW.tenant_id, caller_tenant;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_room_tenant
  BEFORE INSERT OR UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION enforce_room_tenant();

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_rooms"
  ON rooms FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_rooms"
  ON rooms FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_rooms"
  ON rooms FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_rooms"
  ON rooms FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());

-- ----------------------------------------------------------------
-- Estensione tabella tables: coordinate e forma per la mappa
-- ----------------------------------------------------------------
ALTER TABLE tables
  ADD COLUMN room_id    UUID REFERENCES rooms(id) ON DELETE SET NULL,
  ADD COLUMN position_x INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN position_y INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN shape      TEXT NOT NULL DEFAULT 'round'
                        CHECK (shape IN ('round', 'square', 'rect')),
  ADD COLUMN rotation   INTEGER NOT NULL DEFAULT 0;

CREATE INDEX tables_room_id_idx ON tables (room_id);

-- ----------------------------------------------------------------
-- Data migration: crea una room per ogni valore distinto di placement
-- e assegna room_id ai tavoli corrispondenti
-- ----------------------------------------------------------------
INSERT INTO rooms (tenant_id, name)
SELECT DISTINCT tenant_id, COALESCE(NULLIF(placement, ''), 'Sala principale')
FROM tables
WHERE active = true;

UPDATE tables t
SET room_id = r.id
FROM rooms r
WHERE r.tenant_id = t.tenant_id
  AND r.name = COALESCE(NULLIF(t.placement, ''), 'Sala principale');
