-- Tipologie di prenotazione in cui ogni ingrediente è selezionabile nel form pubblico (menu).
ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS booking_types text[]
NOT NULL DEFAULT ARRAY['tavolo', 'rinfresco_laurea', 'menu_prezzo_fisso']::text[];

COMMENT ON COLUMN menu_items.booking_types IS 'Tipologie prenotazione per cui l''ingrediente compare nella selezione menu pubblica.';
