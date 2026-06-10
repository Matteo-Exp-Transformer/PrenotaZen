-- Ogni nuova organizzazione riceve le 5 fasce orarie di servizio predefinite.
-- Stessa architettura del trigger menu_categories (migrazione 004).

CREATE OR REPLACE FUNCTION public.seed_default_service_slots_for_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.service_slots (tenant_id, name, start_time, end_time, max_turns, display_order)
  VALUES
    (NEW.id, 'Colazione', '07:00', '11:30', NULL, 0),
    (NEW.id, 'Pranzo',    '11:31', '15:30', NULL, 1),
    (NEW.id, 'Aperitivo', '16:30', '19:30', NULL, 2),
    (NEW.id, 'Cena',      '19:31', '22:30', NULL, 3),
    (NEW.id, 'Notturna',  '23:00', '04:00', NULL, 4);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_service_slots_on_organization ON public.organizations;
CREATE TRIGGER trg_seed_service_slots_on_organization
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_service_slots_for_organization();

-- Backfill tenant esistenti che non hanno ancora fasce di servizio
INSERT INTO public.service_slots (tenant_id, name, start_time, end_time, max_turns, display_order)
SELECT o.id, v.name, v.start_time::TIME, v.end_time::TIME, NULL, v.display_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('Colazione', '07:00', '11:30', 0),
    ('Pranzo',    '11:31', '15:30', 1),
    ('Aperitivo', '16:30', '19:30', 2),
    ('Cena',      '19:31', '22:30', 3),
    ('Notturna',  '23:00', '04:00', 4)
) AS v(name, start_time, end_time, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_slots ss WHERE ss.tenant_id = o.id
);
