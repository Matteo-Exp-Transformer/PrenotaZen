-- 034: menu_qrcode_categories + theme_key su menu_homepage_config
--
-- 1. Aggiunge theme_key alla configurazione homepage
-- 2. Crea tabella menu_qrcode_categories: override separati di titolo/descrizione
--    per le card categoria nella homepage QR (indipendenti da menu_categories.label/description)

-- ── theme_key su menu_homepage_config ────────────────────────────────────────

ALTER TABLE menu_homepage_config
  ADD COLUMN theme_key TEXT NOT NULL DEFAULT 'mediterranean_teal'
  CONSTRAINT menu_homepage_config_theme_key_check
    CHECK (theme_key IN (
      'mediterranean_teal',
      'cream_sage',
      'dark_gold',
      'rustic_terracotta',
      'wine_bistrot'
    ));

-- ── menu_qrcode_categories ────────────────────────────────────────────────────
-- Un record per categoria per tenant. Titolo e descrizione da mostrare
-- nella homepage QR, indipendenti da menu_categories.

CREATE TABLE menu_qrcode_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_qrcode_categories_tenant_key_unique UNIQUE (tenant_id, category_key)
);

ALTER TABLE menu_qrcode_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_qrcode_categories"
  ON menu_qrcode_categories
  FOR ALL
  TO authenticated
  USING  (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

CREATE POLICY "public_read_qrcode_categories"
  ON menu_qrcode_categories
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON menu_qrcode_categories TO anon;
GRANT ALL ON menu_qrcode_categories TO authenticated;
