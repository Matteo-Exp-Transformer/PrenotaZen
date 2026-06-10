-- booking_types su menu_items non è più usato dalla UI (rimosso pannello tipologie ingrediente).
-- Manteniamo il campo per compatibilità schema, ma senza valori associati agli ingredienti.
ALTER TABLE menu_items ALTER COLUMN booking_types SET DEFAULT '{}'::text[];

COMMENT ON COLUMN menu_items.booking_types IS 'Campo legacy non usato dalla UI: mantenere array vuoto per gli ingredienti.';

-- Azzeriamo il campo per tutti i tenant portandolo ad array vuoto.
UPDATE menu_items SET booking_types = '{}'::text[] WHERE booking_types IS NOT NULL AND array_length(booking_types, 1) > 0;
