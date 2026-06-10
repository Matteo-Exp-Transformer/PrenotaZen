-- Migration 024: aggiunte slot_color a service_slots + deprecazione funzionale is_canonical
-- is_canonical resta in DB per il trigger di signup (seed 3 fasce default nuovi tenant).
-- Non governa piu alcuna logica applicativa dalla Fase 2 in poi.

ALTER TABLE service_slots
  ADD COLUMN IF NOT EXISTS slot_color TEXT NULL;

COMMENT ON COLUMN service_slots.is_canonical IS
  'DEPRECATO funzionalmente da Fase 2: non governa piu alcuna logica app. '
  'Usato solo dal trigger seed_default_service_slots_for_organization per pre-popolare '
  '3 fasce di default a ogni nuovo tenant. Non filtrare su questo campo nelle query.';
