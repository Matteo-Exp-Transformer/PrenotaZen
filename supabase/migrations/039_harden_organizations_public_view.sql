-- Hardening produzione: organizations_public non deve girare come SECURITY DEFINER.
-- La vista resta pubblica in sola lettura, ma usa permessi/RLS del chiamante.

BEGIN;

ALTER VIEW public.organizations_public SET (security_invoker = true);

REVOKE ALL ON public.organizations_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.organizations_public TO anon, authenticated;

GRANT SELECT (id, name, slug, is_active, edition, qr_menu_enabled)
ON public.organizations TO anon;

COMMIT;
