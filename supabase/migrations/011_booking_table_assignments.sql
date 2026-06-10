CREATE TABLE booking_table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  service_slot_id UUID NOT NULL REFERENCES service_slots(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL DEFAULT 1,
  checked_out_at TIMESTAMPTZ,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(table_id, service_slot_id, date, turn_number)
);

CREATE INDEX idx_bta_tenant_date ON booking_table_assignments(tenant_id, date);
CREATE INDEX idx_bta_booking ON booking_table_assignments(booking_id);
CREATE INDEX idx_bta_table ON booking_table_assignments(table_id);

ALTER TABLE booking_table_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_bta"
  ON booking_table_assignments FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_bta"
  ON booking_table_assignments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_bta"
  ON booking_table_assignments FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_bta"
  ON booking_table_assignments FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());
