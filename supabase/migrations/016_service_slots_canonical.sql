-- Aggiunge is_canonical: le 3 fasce Colazione/Pranzo/Cena usate da Classic e dal calendario
ALTER TABLE service_slots
  ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN NOT NULL DEFAULT false;

-- Marca le fasce con nomi canonici già presenti
UPDATE service_slots
  SET is_canonical = true
  WHERE name IN ('Colazione', 'Pranzo', 'Cena');

-- Aggiorna trigger signup: le 3 canoniche hanno is_canonical = true
CREATE OR REPLACE FUNCTION public.seed_default_service_slots_for_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.service_slots (tenant_id, name, start_time, end_time, max_turns, display_order, is_canonical)
  VALUES
    (NEW.id, 'Colazione', '07:00', '11:30', NULL, 0, true),
    (NEW.id, 'Pranzo',    '11:31', '15:30', NULL, 1, true),
    (NEW.id, 'Aperitivo', '16:30', '19:30', NULL, 2, false),
    (NEW.id, 'Cena',      '19:31', '22:30', NULL, 3, true),
    (NEW.id, 'Notturna',  '23:00', '04:00', NULL, 4, false);

  RETURN NEW;
END;
$$;
