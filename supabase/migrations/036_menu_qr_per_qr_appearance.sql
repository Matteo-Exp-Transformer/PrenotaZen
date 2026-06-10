-- 036: aspetto homepage per singolo menu_qr_codes (non più condiviso per tenant)
-- menu_qrcode_categories legate a menu_qr_code_id

BEGIN;

-- ── Colonne aspetto su menu_qr_codes ─────────────────────────────────────────

ALTER TABLE public.menu_qr_codes
  ADD COLUMN IF NOT EXISTS theme_key TEXT NOT NULL DEFAULT 'mediterranean_teal',
  ADD COLUMN IF NOT EXISTS carousel_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS category_images JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.menu_qr_codes
  DROP CONSTRAINT IF EXISTS menu_qr_codes_theme_key_check;

ALTER TABLE public.menu_qr_codes
  ADD CONSTRAINT menu_qr_codes_theme_key_check
    CHECK (theme_key IN (
      'mediterranean_teal',
      'cream_sage',
      'dark_gold',
      'rustic_terracotta',
      'wine_bistrot'
    ));

UPDATE public.menu_qr_codes qr
SET
  theme_key = h.theme_key,
  carousel_items = h.carousel_items,
  category_images = h.category_images
FROM public.menu_homepage_config h
WHERE qr.tenant_id = h.tenant_id;

-- ── menu_qrcode_categories → per QR ──────────────────────────────────────────

ALTER TABLE public.menu_qrcode_categories
  ADD COLUMN IF NOT EXISTS menu_qr_code_id UUID REFERENCES public.menu_qr_codes(id) ON DELETE CASCADE;

ALTER TABLE public.menu_qrcode_categories
  DROP CONSTRAINT IF EXISTS menu_qrcode_categories_tenant_key_unique;

CREATE TEMP TABLE _mqc_legacy ON COMMIT DROP AS
SELECT DISTINCT tenant_id, category_key, title, description
FROM public.menu_qrcode_categories;

DELETE FROM public.menu_qrcode_categories;

INSERT INTO public.menu_qrcode_categories (tenant_id, category_key, title, description, menu_qr_code_id)
SELECT l.tenant_id, l.category_key, l.title, l.description, qr.id
FROM _mqc_legacy l
INNER JOIN public.menu_qr_codes qr ON qr.tenant_id = l.tenant_id;

ALTER TABLE public.menu_qrcode_categories
  ALTER COLUMN menu_qr_code_id SET NOT NULL;

ALTER TABLE public.menu_qrcode_categories
  ADD CONSTRAINT menu_qrcode_categories_qr_key_unique
    UNIQUE (menu_qr_code_id, category_key);

CREATE INDEX IF NOT EXISTS idx_menu_qrcode_categories_qr
  ON public.menu_qrcode_categories (menu_qr_code_id);

DROP POLICY IF EXISTS "admin_manage_qrcode_categories" ON public.menu_qrcode_categories;
CREATE POLICY "admin_manage_qrcode_categories"
  ON public.menu_qrcode_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_qr_codes qr
      WHERE qr.id = menu_qrcode_categories.menu_qr_code_id
        AND qr.tenant_id = current_admin_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.menu_qr_codes qr
      WHERE qr.id = menu_qrcode_categories.menu_qr_code_id
        AND qr.tenant_id = current_admin_tenant_id()
    )
  );

DROP POLICY IF EXISTS "public_read_qrcode_categories" ON public.menu_qrcode_categories;
CREATE POLICY "public_read_qrcode_categories"
  ON public.menu_qrcode_categories
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_qr_codes qr
      WHERE qr.id = menu_qrcode_categories.menu_qr_code_id
        AND qr.is_active = true
    )
  );

COMMIT;
