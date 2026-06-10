-- 041: tema green_wellness per menu QR (preview asset test)

BEGIN;

ALTER TABLE public.menu_qr_codes
  DROP CONSTRAINT IF EXISTS menu_qr_codes_theme_key_check;

ALTER TABLE public.menu_qr_codes
  ADD CONSTRAINT menu_qr_codes_theme_key_check
    CHECK (theme_key IN (
      'mediterranean_teal',
      'cream_sage',
      'dark_gold',
      'rustic_terracotta',
      'green_wellness'
    ));

ALTER TABLE public.menu_homepage_config
  DROP CONSTRAINT IF EXISTS menu_homepage_config_theme_key_check;

ALTER TABLE public.menu_homepage_config
  ADD CONSTRAINT menu_homepage_config_theme_key_check
    CHECK (theme_key IN (
      'mediterranean_teal',
      'cream_sage',
      'dark_gold',
      'rustic_terracotta',
      'green_wellness'
    ));

COMMIT;
