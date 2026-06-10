-- Estende check_admin_email per includere slug, org_name, edition.
-- Elimina la seconda SELECT su organizations nel TenantContext (2 query → 1).
-- Backward compat: tenant_id e name restano al primo posto nel risultato.
-- DROP necessario perché PostgreSQL non permette OR REPLACE con cambio return type.

DROP FUNCTION IF EXISTS public.check_admin_email(text);

CREATE FUNCTION public.check_admin_email(check_email text)
RETURNS TABLE(
  name      text,
  tenant_id uuid,
  slug      text,
  org_name  text,
  edition   text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    au.name::TEXT,
    au.tenant_id,
    o.slug,
    o.name AS org_name,
    o.edition
  FROM admin_users au
  JOIN organizations o ON o.id = au.tenant_id
  WHERE au.email = check_email
  LIMIT 1;
$$;
