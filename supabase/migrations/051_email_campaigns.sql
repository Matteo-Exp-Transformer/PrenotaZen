-- ============================================================================
-- 051_email_campaigns.sql
-- ============================================================================
-- Tabella per-tenant delle campagne email (fino a 5 per tenant).
-- Limite DURO via trigger BEFORE INSERT (pattern: solo nuovi inserimenti bloccati).
-- RLS: solo admin autenticato del proprio tenant. FORCE RLS (coerente con 046).
-- cadence_type='none' = invio solo manuale; gli altri = cadenza salvata (fase 2 scheduler).
-- ============================================================================

BEGIN;

CREATE TABLE email_campaigns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  subject          TEXT        NOT NULL,
  body             TEXT        NOT NULL,
  links            JSONB       NOT NULL DEFAULT '[]',
  recipient_emails JSONB       NOT NULL DEFAULT '[]',
  enabled          BOOLEAN     NOT NULL DEFAULT true,
  cadence_type     TEXT        NOT NULL DEFAULT 'none'
                               CHECK (cadence_type IN ('none', 'weekly', 'monthly', 'custom')),
  cadence_config   JSONB,
  last_sent_at     TIMESTAMPTZ,
  next_run_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX email_campaigns_tenant_id_idx ON email_campaigns (tenant_id);

-- Trigger updated_at
CREATE TRIGGER trg_email_campaigns_updated_at
  BEFORE UPDATE ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Limite DURO: max 5 campagne per tenant
CREATE OR REPLACE FUNCTION check_email_campaigns_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT count(*) FROM email_campaigns WHERE tenant_id = NEW.tenant_id
  ) >= 5 THEN
    RAISE EXCEPTION 'Limite di 5 campagne email per tenant raggiunto';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_campaigns_limit
  BEFORE INSERT ON email_campaigns
  FOR EACH ROW EXECUTE FUNCTION check_email_campaigns_limit();

-- RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns FORCE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_email_campaigns"
  ON email_campaigns FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_email_campaigns"
  ON email_campaigns FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_email_campaigns"
  ON email_campaigns FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_email_campaigns"
  ON email_campaigns FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());

COMMIT;
