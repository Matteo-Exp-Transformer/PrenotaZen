-- Edition gate RLS: le tabelle Pro-only rifiutano query da tenant Classic.
-- Le policy admin_* esistenti vengono rimpiazzate con versioni che includono
-- il controllo organizations.edition IN ('pro','enterprise').
-- Questo garantisce che anche se un utente bypassa la UI, i dati rimangono
-- inaccessibili lato server se il tenant non ha l'edition richiesta.

-- ============================================================
-- customers (CRM — Pro/Enterprise only)
-- ============================================================

DROP POLICY IF EXISTS "admin_select_customers" ON customers;
DROP POLICY IF EXISTS "admin_insert_customers" ON customers;
DROP POLICY IF EXISTS "admin_update_customers" ON customers;
DROP POLICY IF EXISTS "admin_delete_customers" ON customers;

CREATE POLICY "admin_select_customers" ON customers
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = customers.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_insert_customers" ON customers
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = customers.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_update_customers" ON customers
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = customers.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  )
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = customers.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_delete_customers" ON customers
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = customers.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

-- ============================================================
-- service_slots (Servizio fasce orarie — Pro/Enterprise only)
-- ============================================================

DROP POLICY IF EXISTS "admin_select_service_slots" ON service_slots;
DROP POLICY IF EXISTS "admin_insert_service_slots" ON service_slots;
DROP POLICY IF EXISTS "admin_update_service_slots" ON service_slots;
DROP POLICY IF EXISTS "admin_delete_service_slots" ON service_slots;

CREATE POLICY "admin_select_service_slots" ON service_slots
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = service_slots.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_insert_service_slots" ON service_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = service_slots.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_update_service_slots" ON service_slots
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = service_slots.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  )
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = service_slots.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_delete_service_slots" ON service_slots
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = service_slots.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

-- ============================================================
-- booking_table_assignments (assegnazione tavoli — Pro/Enterprise only)
-- ============================================================

DROP POLICY IF EXISTS "admin_select_bta" ON booking_table_assignments;
DROP POLICY IF EXISTS "admin_insert_bta" ON booking_table_assignments;
DROP POLICY IF EXISTS "admin_update_bta" ON booking_table_assignments;
DROP POLICY IF EXISTS "admin_delete_bta" ON booking_table_assignments;

CREATE POLICY "admin_select_bta" ON booking_table_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = booking_table_assignments.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_insert_bta" ON booking_table_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = booking_table_assignments.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_update_bta" ON booking_table_assignments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = booking_table_assignments.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  )
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = booking_table_assignments.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_delete_bta" ON booking_table_assignments
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = booking_table_assignments.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

-- ============================================================
-- rooms (sale layout — Pro/Enterprise only)
-- ============================================================

DROP POLICY IF EXISTS "admin_select_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_insert_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_update_rooms" ON rooms;
DROP POLICY IF EXISTS "admin_delete_rooms" ON rooms;

CREATE POLICY "admin_select_rooms" ON rooms
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = rooms.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_insert_rooms" ON rooms
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = rooms.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_update_rooms" ON rooms
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = rooms.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  )
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = rooms.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_delete_rooms" ON rooms
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = rooms.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

-- ============================================================
-- tables (tavoli layout — Pro/Enterprise only)
-- ============================================================

DROP POLICY IF EXISTS "admin_select_tables" ON tables;
DROP POLICY IF EXISTS "admin_insert_tables" ON tables;
DROP POLICY IF EXISTS "admin_update_tables" ON tables;
DROP POLICY IF EXISTS "admin_delete_tables" ON tables;

CREATE POLICY "admin_select_tables" ON tables
  FOR SELECT TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = tables.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_insert_tables" ON tables
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = tables.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_update_tables" ON tables
  FOR UPDATE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = tables.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  )
  WITH CHECK (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = tables.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );

CREATE POLICY "admin_delete_tables" ON tables
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_admin_tenant_id()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = tables.tenant_id
        AND organizations.edition IN ('pro', 'enterprise')
    )
  );
