-- 049: per-QR item ordering override
-- Aggiunge item_sort_overrides a menu_qr_codes.
-- Format: { "category_key": ["item_uuid", ...] }
-- null o chiave assente = ordine default magazzino (sort_order + name).
-- Applicare su TEST prima del deploy; su PROD a milestone M3.

ALTER TABLE public.menu_qr_codes
  ADD COLUMN IF NOT EXISTS item_sort_overrides JSONB DEFAULT NULL;
