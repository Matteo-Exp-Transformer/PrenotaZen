-- Fix RLS: replace GUC app.current_tenant_id with JWT + admin_users (pooler-safe).

CREATE OR REPLACE FUNCTION current_admin_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.tenant_id
  FROM admin_users au
  WHERE lower(au.email) = lower(auth.jwt() ->> 'email')
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION current_admin_tenant_id() TO authenticated;

-- booking_requests
DROP POLICY IF EXISTS "anon_insert_bookings"   ON booking_requests;
DROP POLICY IF EXISTS "tenant_select_bookings" ON booking_requests;
DROP POLICY IF EXISTS "tenant_update_bookings" ON booking_requests;
DROP POLICY IF EXISTS "tenant_delete_bookings" ON booking_requests;
DROP POLICY IF EXISTS "tenant_insert_bookings" ON booking_requests;

-- admin_users
DROP POLICY IF EXISTS "tenant_select_admin_users" ON admin_users;

-- email_logs
DROP POLICY IF EXISTS "anon_insert_email_logs"   ON email_logs;
DROP POLICY IF EXISTS "tenant_select_email_logs" ON email_logs;
DROP POLICY IF EXISTS "tenant_insert_email_logs" ON email_logs;

-- restaurant_settings
DROP POLICY IF EXISTS "tenant_select_restaurant_settings"  ON restaurant_settings;
DROP POLICY IF EXISTS "tenant_update_restaurant_settings"  ON restaurant_settings;
DROP POLICY IF EXISTS "tenant_insert_restaurant_settings"  ON restaurant_settings;

-- menu_items
DROP POLICY IF EXISTS "tenant_manage_menu_items" ON menu_items;

-- tenant_usage
DROP POLICY IF EXISTS "tenant_select_usage" ON tenant_usage;
DROP POLICY IF EXISTS "anon_select_tenant_usage" ON tenant_usage;

DROP FUNCTION IF EXISTS set_tenant(uuid);

CREATE POLICY "admin_select_bookings"
  ON booking_requests FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_bookings"
  ON booking_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_bookings"
  ON booking_requests FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_bookings"
  ON booking_requests FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_select_admin_users"
  ON admin_users FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_select_email_logs"
  ON email_logs FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_email_logs"
  ON email_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_select_restaurant_settings"
  ON restaurant_settings FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_restaurant_settings"
  ON restaurant_settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_restaurant_settings"
  ON restaurant_settings FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_restaurant_settings"
  ON restaurant_settings FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_manage_menu_items"
  ON menu_items FOR ALL TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_select_tenant_usage"
  ON tenant_usage FOR SELECT TO authenticated
  USING (organization_id = current_admin_tenant_id());

CREATE OR REPLACE FUNCTION enforce_booking_tenant()
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

DROP TRIGGER IF EXISTS trg_enforce_booking_tenant ON booking_requests;
CREATE TRIGGER trg_enforce_booking_tenant
  BEFORE INSERT OR UPDATE ON booking_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_booking_tenant();
