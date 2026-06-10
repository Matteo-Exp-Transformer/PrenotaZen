-- ============================================================================
-- 031_tenant_features_system.sql
-- ============================================================================
-- Sistema feature flag scalabile per add-on commerciali per tenant.
-- Sostituisce il meccanismo ad-hoc qr_menu_enabled con una tabella generica.
--
-- Modello ibrido:
--   edition = bundle base (Classic/Pro/Enterprise)
--   tenant_features = override per singolo tenant (attiva o disattiva feature)
--   Risultato finale = bundle(edition) UNION overrides(tenant_features)
--
-- Cambiamenti:
--   1. Tabella tenant_features (override per tenant)
--   2. RPC get_tenant_features(p_tenant_id) — restituisce feature_key attive
--   3. Estende check_admin_email → aggiunge feature_overrides TEXT[]
--   4. Estende organizations_public → aggiunge feature_overrides TEXT[]
--   5. Migrazione dati: qr_menu_enabled=true → riga in tenant_features
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabella tenant_features
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_features (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key  TEXT        NOT NULL,
  enabled      BOOLEAN     NOT NULL,
  source       TEXT        NOT NULL DEFAULT 'manual'
               CHECK (source IN ('manual', 'promo', 'trial', 'enterprise_addon', 'legacy_migration')),
  notes        TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,          -- NULL = senza scadenza
  created_by   TEXT,                 -- email admin che ha attivato (futuro backoffice)
  UNIQUE (tenant_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_features_tenant
  ON public.tenant_features (tenant_id);

ALTER TABLE public.tenant_features ENABLE ROW LEVEL SECURITY;

-- Admin del proprio tenant: full CRUD
DROP POLICY IF EXISTS "admin_manage_tenant_features" ON public.tenant_features;
CREATE POLICY "admin_manage_tenant_features"
  ON public.tenant_features FOR ALL TO authenticated
  USING  (tenant_id = current_admin_tenant_id())
  WITH CHECK (tenant_id = current_admin_tenant_id());

-- Anon: nessun accesso diretto alla tabella (legge via organizations_public)
-- Nessuna policy SELECT per anon → accesso bloccato da RLS.

REVOKE ALL ON public.tenant_features FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_features TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC get_tenant_features(p_tenant_id UUID)
--    Ritorna le feature_key attive (non scadute, enabled=true) per un tenant.
--    SECURITY DEFINER per poter essere chiamata anche da anon via organizations_public.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_tenant_features(p_tenant_id UUID)
RETURNS TEXT[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    ARRAY_AGG(feature_key ORDER BY feature_key),
    ARRAY[]::TEXT[]
  )
  FROM public.tenant_features
  WHERE tenant_id = p_tenant_id
    AND enabled = true
    AND (expires_at IS NULL OR expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.get_tenant_features(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_features(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Estende check_admin_email → aggiunge feature_overrides TEXT[]
--    DROP necessario perché PostgreSQL non ammette OR REPLACE con return type diverso.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.check_admin_email(text);

CREATE FUNCTION public.check_admin_email(check_email text)
RETURNS TABLE(
  name              text,
  tenant_id         uuid,
  slug              text,
  org_name          text,
  edition           text,
  feature_overrides text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    au.name::TEXT,
    au.tenant_id,
    o.slug,
    o.name AS org_name,
    o.edition,
    public.get_tenant_features(au.tenant_id) AS feature_overrides
  FROM admin_users au
  JOIN organizations o ON o.id = au.tenant_id
  WHERE au.email = check_email
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.check_admin_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_admin_email(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Estende organizations_public → aggiunge feature_overrides TEXT[]
--    DROP ... CASCADE per evitare errori su policy che referenziano la vista.
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.organizations_public CASCADE;

CREATE VIEW public.organizations_public AS
SELECT
  id,
  name,
  slug,
  is_active,
  edition,
  qr_menu_enabled,                                  -- DEPRECATED, mantenuto per backward-compat
  public.get_tenant_features(id) AS feature_overrides
FROM public.organizations
WHERE is_active = true;

REVOKE ALL ON public.organizations_public FROM PUBLIC;
GRANT SELECT ON public.organizations_public TO anon, authenticated;

-- Ri-crea le policy RLS su menu_items / menu_categories che dipendevano dalla vista
-- (erano state droppate dalla CASCADE).
DROP POLICY IF EXISTS "public_read_menu_items" ON public.menu_items;
CREATE POLICY "public_read_menu_items"
  ON public.menu_items FOR SELECT TO anon
  USING (
    tenant_id IN (
      SELECT id FROM public.organizations_public WHERE is_active = true
    )
  );

DROP POLICY IF EXISTS "public_read_menu_categories" ON public.menu_categories;
CREATE POLICY "public_read_menu_categories"
  ON public.menu_categories FOR SELECT TO anon
  USING (
    tenant_id IN (
      SELECT id FROM public.organizations_public WHERE is_active = true
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Migrazione dati: qr_menu_enabled=true → riga in tenant_features
--    La colonna qr_menu_enabled resta (DEPRECATED) per backward-compat.
--    Sarà droppata in una migrazione futura quando il codice non la legge più.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.tenant_features (tenant_id, feature_key, enabled, source, notes)
SELECT
  id,
  'qrMenu',
  true,
  'legacy_migration',
  'Migrato da organizations.qr_menu_enabled (migrazione 031)'
FROM public.organizations
WHERE qr_menu_enabled = true
ON CONFLICT (tenant_id, feature_key) DO NOTHING;


COMMIT;
