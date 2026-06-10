-- Rimuove chiavi promo legacy (vol-au-vent) e pulisce omaggi virtuali dal JSON menù.

DELETE FROM restaurant_settings
WHERE setting_key LIKE 'booking_vol_au_vent%';

-- Rimuove voci omaggio automatico da menu_selection.items
UPDATE booking_requests
SET menu_selection = jsonb_set(
  menu_selection,
  '{items}',
  COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(menu_selection->'items') AS elem
      WHERE elem->>'id' IS DISTINCT FROM 'virtual-vol-au-vent-promo'
        AND elem->>'name' IS DISTINCT FROM 'Mini Rustici Misti'
    ),
    '[]'::jsonb
  )
)
WHERE menu_selection IS NOT NULL
  AND jsonb_typeof(menu_selection->'items') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(menu_selection->'items') AS elem
    WHERE elem->>'id' = 'virtual-vol-au-vent-promo'
       OR elem->>'name' = 'Mini Rustici Misti'
  );

COMMENT ON COLUMN booking_requests.menu_promo_labels IS
  'Array JSON di stringhe: nomi promo menù visibili al submit (booking_menu_promos.label).';
