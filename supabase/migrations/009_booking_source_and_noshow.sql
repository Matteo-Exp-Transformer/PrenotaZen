-- Fonte prenotazione, no-show e walk-in per Analytics F2 e Home F2.
-- booking_type non aveva un CHECK constraint nelle migrazioni precedenti,
-- quindi aggiungiamo il constraint qui includendo 'walk_in'.

ALTER TABLE booking_requests
  ADD COLUMN source   TEXT NOT NULL DEFAULT 'public_form'
                      CHECK (source IN ('public_form', 'manual', 'walk_in', 'phone', 'google')),
  ADD COLUMN no_show  BOOLEAN NOT NULL DEFAULT false;

-- CHECK constraint su booking_type per includere walk_in (prima era TEXT libero)
ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_booking_type_check
  CHECK (booking_type IS NULL OR booking_type IN (
    'tavolo', 'rinfresco_laurea', 'menu_prezzo_fisso', 'walk_in'
  ));

-- Backfill difensivo: garantisce che i record preesistenti abbiano source valorizzato
UPDATE booking_requests SET source = 'public_form' WHERE source IS NULL;

CREATE INDEX booking_requests_source_idx ON booking_requests (source);
CREATE INDEX booking_requests_noshow_idx ON booking_requests (no_show) WHERE no_show = true;
