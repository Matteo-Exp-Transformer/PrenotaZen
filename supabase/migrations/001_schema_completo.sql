-- ============================================================
-- BOOKING SAAS — Schema completo + Multi-tenant
-- Versione: 2.0
-- Descrizione: Schema consolidato per nuovo deployment.
--              Sostituisce le migrazioni 001-041 del progetto originale.
-- ============================================================

-- ────────────────────────────────────────────
-- 1. TABELLA organizations (tenant registry)
-- ────────────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter',
  max_bookings_per_year           INTEGER NOT NULL DEFAULT 3600,
  max_booking_requests_per_year   INTEGER NOT NULL DEFAULT 5000,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_active ON organizations(is_active) WHERE is_active = TRUE;

-- ────────────────────────────────────────────
-- 2. TABELLA booking_requests
-- ────────────────────────────────────────────
CREATE TABLE booking_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Cliente
  client_name           TEXT NOT NULL,
  client_email          TEXT NOT NULL DEFAULT '',
  client_phone          TEXT,

  -- Prenotazione
  event_type            TEXT,
  booking_type          TEXT,
  desired_date          DATE NOT NULL,
  desired_time          TEXT,
  num_guests            INTEGER,
  special_requests      TEXT,
  placement             TEXT,

  -- Menu
  menu                  TEXT,
  menu_selection        JSONB,
  menu_total_per_person NUMERIC,
  menu_total_booking    NUMERIC,
  preset_menu           TEXT,

  -- Intolleranze
  dietary_restrictions  JSONB,

  -- Status
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','rejected','deleted')),
  confirmed_start       TIMESTAMPTZ,
  confirmed_end         TIMESTAMPTZ,
  rejection_reason      TEXT,
  cancellation_reason   TEXT,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID,

  -- Tracking
  booking_source        TEXT NOT NULL DEFAULT 'public'
                          CHECK (booking_source IN ('public','admin')),

  -- Multi-tenant
  tenant_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE INDEX idx_booking_requests_tenant_date   ON booking_requests(tenant_id, desired_date);
CREATE INDEX idx_booking_requests_tenant_status ON booking_requests(tenant_id, status);

-- ────────────────────────────────────────────
-- 3. TABELLA admin_users
-- ────────────────────────────────────────────
CREATE TABLE admin_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  name        TEXT,
  tenant_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(email, tenant_id)
);

CREATE INDEX idx_admin_users_tenant_email ON admin_users(tenant_id, email);

-- ────────────────────────────────────────────
-- 4. TABELLA email_logs
-- ────────────────────────────────────────────
CREATE TABLE email_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID REFERENCES booking_requests(id) ON DELETE CASCADE,
  email_type        TEXT NOT NULL,
  recipient_email   TEXT NOT NULL,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            TEXT NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('sent','failed','pending')),
  provider_response JSONB,
  error_message     TEXT,
  tenant_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_email_logs_tenant ON email_logs(tenant_id);

-- ────────────────────────────────────────────
-- 5. TABELLA restaurant_settings
-- ────────────────────────────────────────────
CREATE TABLE restaurant_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, setting_key)
);

CREATE INDEX idx_restaurant_settings_tenant_key ON restaurant_settings(tenant_id, setting_key);

-- ────────────────────────────────────────────
-- 6. TABELLA menu_items
-- ────────────────────────────────────────────
CREATE TABLE menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  tenant_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, name, category)
);

CREATE INDEX idx_menu_items_tenant_category ON menu_items(tenant_id, category, sort_order);

-- ────────────────────────────────────────────
-- 7. TABELLA invite_tokens
-- ────────────────────────────────────────────
CREATE TABLE invite_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  email           TEXT,            -- opzionale: restringe l'uso a una specifica email
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID
);

-- Indice parziale su token validi (non ancora usati)
CREATE INDEX idx_invite_tokens_valid ON invite_tokens(token) WHERE used_at IS NULL;

-- ────────────────────────────────────────────
-- 8. TABELLA tenant_usage (contatori annuali)
-- ────────────────────────────────────────────
CREATE TABLE tenant_usage (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year                      INTEGER NOT NULL,
  bookings_count            INTEGER NOT NULL DEFAULT 0,
  booking_requests_count    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(organization_id, year)
);

-- ────────────────────────────────────────────
-- 9. TABELLA rate_limits
-- ────────────────────────────────────────────
CREATE TABLE rate_limits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address   TEXT NOT NULL,
  endpoint     TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint, requested_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_rate_limits" ON rate_limits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_rate_limits" ON rate_limits FOR SELECT TO anon USING (true);

-- ────────────────────────────────────────────
-- 10. TRIGGER: updated_at automatico
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_requests_updated_at
  BEFORE UPDATE ON booking_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin_users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────
-- 11. TRIGGER: contatori usage
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_booking_request_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenant_usage (organization_id, year, booking_requests_count)
  VALUES (NEW.tenant_id, EXTRACT(YEAR FROM NOW())::INTEGER, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET booking_requests_count = tenant_usage.booking_requests_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_booking_request_count
  AFTER INSERT ON booking_requests FOR EACH ROW EXECUTE FUNCTION increment_booking_request_count();

CREATE OR REPLACE FUNCTION increment_booking_count_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    INSERT INTO tenant_usage (organization_id, year, bookings_count)
    VALUES (NEW.tenant_id, EXTRACT(YEAR FROM NOW())::INTEGER, 1)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET bookings_count = tenant_usage.bookings_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_booking_count_on_accept
  AFTER UPDATE ON booking_requests FOR EACH ROW EXECUTE FUNCTION increment_booking_count_on_accept();

-- ────────────────────────────────────────────
-- 12. FUNZIONI RPC (usate dal frontend)
-- ────────────────────────────────────────────

-- Verifica email admin senza esporre la tabella admin_users ad anon
CREATE OR REPLACE FUNCTION check_admin_email(check_email TEXT)
RETURNS TABLE(name TEXT, tenant_id UUID) AS $$
  SELECT au.name::TEXT, au.tenant_id
  FROM admin_users au
  WHERE au.email = check_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Imposta il tenant corrente nella sessione (per policy RLS)
CREATE OR REPLACE FUNCTION set_tenant(tid UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tid::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup rate limits (da eseguire periodicamente)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
  DELETE FROM rate_limits WHERE requested_at < NOW() - INTERVAL '1 hour';
$$ LANGUAGE sql SECURITY DEFINER;

-- ────────────────────────────────────────────
-- 13. ROW LEVEL SECURITY
-- ────────────────────────────────────────────

-- organizations: leggibile da tutti (risoluzione slug pubblica)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_select_organizations" ON organizations FOR SELECT USING (true);

-- booking_requests
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_bookings"   ON booking_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "tenant_select_bookings" ON booking_requests FOR SELECT TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_update_bookings" ON booking_requests FOR UPDATE TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_delete_bookings" ON booking_requests FOR DELETE TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_insert_bookings" ON booking_requests FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- admin_users: solo autenticati, solo proprio tenant
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_admin_users" ON admin_users FOR SELECT TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_email_logs"   ON email_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "tenant_select_email_logs" ON email_logs FOR SELECT TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_insert_email_logs" ON email_logs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- restaurant_settings: anon può leggere (orari, nome ristorante)
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_restaurant_settings"    ON restaurant_settings FOR SELECT TO anon USING (true);
CREATE POLICY "tenant_select_restaurant_settings"  ON restaurant_settings FOR SELECT TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_update_restaurant_settings"  ON restaurant_settings FOR UPDATE TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "tenant_insert_restaurant_settings"  ON restaurant_settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- menu_items: anon legge (per il form pubblico)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_menu_items"   ON menu_items FOR SELECT TO anon USING (true);
CREATE POLICY "tenant_manage_menu_items" ON menu_items FOR ALL TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- invite_tokens: anon può leggere e aggiornare (per il flusso di registrazione)
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_invite_tokens" ON invite_tokens FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_invite_tokens" ON invite_tokens FOR UPDATE TO anon USING (true);

-- tenant_usage: anon legge (per verifica limiti in Edge Function)
ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_tenant_usage"  ON tenant_usage FOR SELECT TO anon USING (true);
CREATE POLICY "tenant_select_usage"       ON tenant_usage FOR SELECT TO authenticated
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- ────────────────────────────────────────────
-- 14. DATI INIZIALI DI ESEMPIO
-- (commentare se si vuole un DB pulito)
-- ────────────────────────────────────────────
-- INSERT INTO organizations (name, slug, plan) VALUES ('Il Mio Ristorante', 'mio-ristorante', 'starter');
