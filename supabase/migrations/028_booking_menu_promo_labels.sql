-- Snapshot nomi promo menù al momento della prenotazione (solo admin).
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS menu_promo_labels JSONB;

COMMENT ON COLUMN booking_requests.menu_promo_labels IS
  'Array JSON di stringhe: nomi promo menù visibili al submit (booking_vol_au_vent_promos.label).';
