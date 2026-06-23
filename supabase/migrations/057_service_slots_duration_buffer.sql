-- S2: aggiunge min_duration (pavimento fascia) e turnover_buffer_minutes (buffer turnover D37)
ALTER TABLE public.service_slots
  ADD COLUMN IF NOT EXISTS min_duration integer
    CHECK (min_duration IS NULL OR min_duration >= 0);

ALTER TABLE public.service_slots
  ADD COLUMN IF NOT EXISTS turnover_buffer_minutes integer NOT NULL DEFAULT 0
    CHECK (turnover_buffer_minutes >= 0);
