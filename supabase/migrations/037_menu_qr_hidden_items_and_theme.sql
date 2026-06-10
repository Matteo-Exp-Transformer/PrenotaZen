-- 037: ingredienti nascosti per QR + rimozione tema wine_bistrot

BEGIN;

ALTER TABLE public.menu_qr_codes
  ADD COLUMN IF NOT EXISTS hidden_menu_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.menu_qr_codes
SET theme_key = 'mediterranean_teal'
WHERE theme_key = 'wine_bistrot';

ALTER TABLE public.menu_qr_codes
  DROP CONSTRAINT IF EXISTS menu_qr_codes_theme_key_check;

ALTER TABLE public.menu_qr_codes
  ADD CONSTRAINT menu_qr_codes_theme_key_check
    CHECK (theme_key IN (
      'mediterranean_teal',
      'cream_sage',
      'dark_gold',
      'rustic_terracotta'
    ));

COMMIT;
