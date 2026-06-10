CREATE TABLE service_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_turns INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_slots_tenant ON service_slots(tenant_id);

CREATE TRIGGER trg_service_slots_updated_at
  BEFORE UPDATE ON service_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE service_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_service_slots"
  ON service_slots FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_service_slots"
  ON service_slots FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_service_slots"
  ON service_slots FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_service_slots"
  ON service_slots FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());
