-- ============================================================================
-- 030_menu_qr_and_photos.sql
-- ============================================================================
-- Aggiunge:
--   1. image_url a menu_items (foto piatto, opzionale)
--   2. Bucket Storage "menu-photos" (pubblico in lettura, admin scrive)
--   3. Tabella menu_qr_codes (QR multipli per tenant)
--   4. Policy RLS lettura pubblica per menu_items e menu_categories
--   5. Colonna qr_menu_enabled in organizations (override Classic)
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. image_url su menu_items
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Bucket Storage "menu-photos"
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-photos',
  'menu-photos',
  true,
  512000,                -- 500 KB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Lettura pubblica: chiunque può leggere le foto (già garantita da public=true,
-- ma policy esplicita per chiarezza).
DROP POLICY IF EXISTS "menu_photos_public_read" ON storage.objects;
CREATE POLICY "menu_photos_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'menu-photos');

-- Solo admin autenticato può caricare/sovrascrivere/eliminare foto del proprio tenant.
-- Path convenzione: {tenant_id}/{qualsiasi}.
DROP POLICY IF EXISTS "menu_photos_admin_write" ON storage.objects;
CREATE POLICY "menu_photos_admin_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-photos'
    AND (storage.foldername(name))[1] = current_admin_tenant_id()::text
  );

DROP POLICY IF EXISTS "menu_photos_admin_update" ON storage.objects;
CREATE POLICY "menu_photos_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-photos'
    AND (storage.foldername(name))[1] = current_admin_tenant_id()::text
  );

DROP POLICY IF EXISTS "menu_photos_admin_delete" ON storage.objects;
CREATE POLICY "menu_photos_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-photos'
    AND (storage.foldername(name))[1] = current_admin_tenant_id()::text
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabella menu_qr_codes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_qr_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  short_code      TEXT NOT NULL,
  name            TEXT NOT NULL,
  -- 'a_la_carte' | 'preset_menus' | 'mixed'
  content_type    TEXT NOT NULL DEFAULT 'a_la_carte'
                  CHECK (content_type IN ('a_la_carte', 'preset_menus', 'mixed')),
  -- filtri opzionali: NULL = mostra tutto
  category_filter TEXT[],
  preset_ids      UUID[],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, short_code)
);

CREATE INDEX IF NOT EXISTS idx_menu_qr_codes_tenant
  ON public.menu_qr_codes (tenant_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_menu_qr_codes_short_code
  ON public.menu_qr_codes (short_code);

ALTER TABLE public.menu_qr_codes ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER menu_qr_codes_updated_at
  BEFORE UPDATE ON public.menu_qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Admin del tenant: full CRUD.
DROP POLICY IF EXISTS "admin_manage_menu_qr_codes" ON public.menu_qr_codes;
CREATE POLICY "admin_manage_menu_qr_codes"
  ON public.menu_qr_codes FOR ALL TO authenticated
  USING (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

-- Anon: può leggere solo i QR attivi (serve alla pagina pubblica per risolvere short_code).
DROP POLICY IF EXISTS "public_read_menu_qr_codes" ON public.menu_qr_codes;
CREATE POLICY "public_read_menu_qr_codes"
  ON public.menu_qr_codes FOR SELECT TO anon
  USING (is_active = true);

-- GRANT
REVOKE ALL ON public.menu_qr_codes FROM anon, authenticated;
GRANT SELECT ON public.menu_qr_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_qr_codes TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Override qr_menu su organizations (per Classic con upgrade acquistato)
-- ─────────────────────────────────────────────────────────────────────────────
-- Pro/Enterprise: flag sempre derivato dall'edition lato client.
-- Classic: può avere qr_menu_enabled = true se il ristoratore ha pagato.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS qr_menu_enabled BOOLEAN NOT NULL DEFAULT false;

-- CASCADE necessario: le policy RLS su menu_items/menu_categories referenziano
-- la vista e verrebbero invalidate da un DROP senza CASCADE.
DROP VIEW IF EXISTS public.organizations_public CASCADE;
CREATE VIEW public.organizations_public AS
SELECT id, name, slug, is_active, edition, qr_menu_enabled
FROM public.organizations
WHERE is_active = true;

REVOKE ALL ON public.organizations_public FROM PUBLIC;
GRANT SELECT ON public.organizations_public TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS lettura pubblica menu_items e menu_categories (dopo ricreazione vista)
-- ─────────────────────────────────────────────────────────────────────────────
-- menu_items: anon può leggere i piatti di tenant attivi.
DROP POLICY IF EXISTS "public_read_menu_items" ON public.menu_items;
CREATE POLICY "public_read_menu_items"
  ON public.menu_items FOR SELECT TO anon
  USING (
    tenant_id IN (
      SELECT id FROM public.organizations_public WHERE is_active = true
    )
  );

-- menu_categories: anon può leggere le categorie di tenant attivi.
DROP POLICY IF EXISTS "public_read_menu_categories" ON public.menu_categories;
CREATE POLICY "public_read_menu_categories"
  ON public.menu_categories FOR SELECT TO anon
  USING (
    tenant_id IN (
      SELECT id FROM public.organizations_public WHERE is_active = true
    )
  );

-- Aggiunge GRANT SELECT su menu_categories anche per anon (era solo authenticated).
GRANT SELECT ON public.menu_categories TO anon;


COMMIT;
