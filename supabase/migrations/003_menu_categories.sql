-- Dynamic menu categories per tenant
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 999,
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, key),
  UNIQUE (tenant_id, label)
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant_sort
  ON menu_categories(tenant_id, sort_order, label);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_menu_categories" ON menu_categories;
CREATE POLICY "admin_manage_menu_categories"
  ON menu_categories FOR ALL TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

-- Seed base categories for already existing tenants.
INSERT INTO menu_categories (tenant_id, key, label, sort_order)
SELECT
  o.id,
  defaults.key,
  defaults.label,
  defaults.sort_order
FROM organizations o
CROSS JOIN (
  VALUES
    ('bevande', 'Bevande', 10),
    ('pizza', 'Pizza', 20),
    ('antipasti', 'Antipasti', 30),
    ('fritti', 'Fritti', 40),
    ('primi', 'Primi Piatti', 50),
    ('secondi', 'Secondi Piatti', 60),
    ('dolci', 'Dolci', 70)
) AS defaults(key, label, sort_order)
ON CONFLICT (tenant_id, key) DO NOTHING;
