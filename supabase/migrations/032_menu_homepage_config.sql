-- 032: menu_homepage_config
-- Configurazione visiva homepage menu pubblico (carosello + foto categorie)
-- Un record per tenant. Letto pubblicamente, scritto solo dall'admin.

CREATE TABLE menu_homepage_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  carousel_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  category_images jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_homepage_config_tenant_unique UNIQUE (tenant_id)
);

ALTER TABLE menu_homepage_config ENABLE ROW LEVEL SECURITY;

-- Admin: full CRUD sul proprio tenant
CREATE POLICY "admin_manage_homepage_config"
  ON menu_homepage_config
  FOR ALL
  TO authenticated
  USING  (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

-- Pubblico: solo lettura
CREATE POLICY "public_read_homepage_config"
  ON menu_homepage_config
  FOR SELECT
  TO anon
  USING (true);

GRANT SELECT ON menu_homepage_config TO anon;
GRANT ALL ON menu_homepage_config TO authenticated;
