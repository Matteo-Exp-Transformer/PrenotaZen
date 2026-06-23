-- S3: step di arrivo per-fascia (D18) — default 30 minuti
-- Nessun GRANT aggiuntivo: eredita da RLS migration 025.
ALTER TABLE public.service_slots
  ADD COLUMN IF NOT EXISTS arrival_step_minutes integer
    NOT NULL DEFAULT 30;

ALTER TABLE public.service_slots
  DROP CONSTRAINT IF EXISTS service_slots_arrival_step_minutes_check;

ALTER TABLE public.service_slots
  ADD CONSTRAINT service_slots_arrival_step_minutes_check
  CHECK (arrival_step_minutes BETWEEN 5 AND 120);
