-- 042: icona categoria per singolo Menù QR (override admin, non su menu_categories globale)
ALTER TABLE public.menu_qrcode_categories
  ADD COLUMN IF NOT EXISTS icon TEXT NULL;

COMMENT ON COLUMN public.menu_qrcode_categories.icon IS
  'Chiave icona Phosphor scelta in modale QR quando manca category_images; per-QR.';
