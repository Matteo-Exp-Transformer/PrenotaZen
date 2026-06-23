-- S2: snapshot durata congelata sulla prenotazione (D14)
-- Nullable: retrocompatibile con prenotazioni esistenti (NULL = permanenza OFF, D15 rispettato)
ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS duration_source text,
  ADD COLUMN IF NOT EXISTS duration_rule_version integer;
