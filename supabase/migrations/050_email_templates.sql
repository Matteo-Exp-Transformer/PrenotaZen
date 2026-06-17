-- ============================================================================
-- 050_email_templates.sql
-- ============================================================================
-- Tabella per-tenant degli override testuali email (accetta/rifiuta/promo).
-- RLS: solo admin autenticato del proprio tenant. FORCE RLS (coerente con 046).
-- Campi testo nullable: assenza o null → default cablato nel codice (fallback).
-- ============================================================================

BEGIN;

CREATE TABLE email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL CHECK (template_key IN ('booking_accepted', 'booking_rejected', 'promo')),
  subject      TEXT,
  intro        TEXT,
  closing      TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_templates_tenant_key_idx ON email_templates (tenant_id, template_key);
CREATE INDEX email_templates_tenant_id_idx ON email_templates (tenant_id);

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_email_templates"
  ON email_templates FOR SELECT TO authenticated
  USING (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_insert_email_templates"
  ON email_templates FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_update_email_templates"
  ON email_templates FOR UPDATE TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "admin_delete_email_templates"
  ON email_templates FOR DELETE TO authenticated
  USING (tenant_id = current_admin_tenant_id());

COMMIT;
