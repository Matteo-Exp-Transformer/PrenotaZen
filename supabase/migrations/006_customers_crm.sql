-- CRM customers (manual + synced overlay). RLS aligned with booking_requests.

CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  notes      TEXT,
  source     TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'synced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_tenant_lower_email_idx ON customers (tenant_id, lower(trim(email)));

CREATE INDEX customers_tenant_id_idx ON customers (tenant_id);

CREATE OR REPLACE FUNCTION customers_normalize_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  IF NEW.email = '' THEN
    RAISE EXCEPTION 'email non può essere vuoto';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_normalize_email
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION customers_normalize_email();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION enforce_customer_tenant()
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

CREATE TRIGGER trg_enforce_customer_tenant
  BEFORE INSERT OR UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION enforce_customer_tenant();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_customers"
  ON customers FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_customers"
  ON customers FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_customers"
  ON customers FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_customers"
  ON customers FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());
