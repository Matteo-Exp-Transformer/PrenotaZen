-- 045 — M3 Fase 2: disponibilità magazzino (categoria + ingrediente)
-- Spento nel magazzino = nascosto in Pagina Prenota e Menu QR.
-- Default true: righe esistenti restano visibili (retroattivo).

ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN menu_categories.is_available IS
  'false = categoria nascosta in Prenota e Menu QR (magazzino). Snapshot prenotazioni intatto.';

COMMENT ON COLUMN menu_items.is_available IS
  'false = ingrediente nascosto in Prenota e Menu QR. Categoria parent off nasconde tutti gli item.';
