-- Restaurant tables per sala (CRUD gestione tavoli admin).
-- Nessuna relazione con booking_requests: i tavoli sono entità standalone.

CREATE TABLE tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  placement   TEXT NOT NULL DEFAULT '',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tables_tenant_id_idx ON tables (tenant_id);

CREATE TRIGGER trg_tables_updated_at
  BEFORE UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION enforce_table_tenant()
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

CREATE TRIGGER trg_enforce_table_tenant
  BEFORE INSERT OR UPDATE ON tables
  FOR EACH ROW EXECUTE FUNCTION enforce_table_tenant();

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_tables"
  ON tables FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_tables"
  ON tables FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_tables"
  ON tables FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_tables"
  ON tables FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());
