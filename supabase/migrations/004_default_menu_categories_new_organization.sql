-- Ogni nuova organizzazione (slug) riceve le categorie ingredienti menù di default.
-- Chiavi allineate a CATEGORY_LIMITS / selezione prenotazioni (antipasti, primi, secondi, …).

CREATE OR REPLACE FUNCTION public.seed_default_menu_categories_for_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.menu_categories (tenant_id, key, label, sort_order)
  VALUES
    (NEW.id, 'antipasti', 'Antipasti', 10),
    (NEW.id, 'primi', 'Primi piatti', 20),
    (NEW.id, 'secondi', 'Secondi piatti', 30),
    (NEW.id, 'dolci', 'Dolci', 40),
    (NEW.id, 'bevande', 'Bevande', 50)
  ON CONFLICT (tenant_id, key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_menu_categories_on_organization ON public.organizations;
CREATE TRIGGER trg_seed_menu_categories_on_organization
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_menu_categories_for_organization();

-- Tenant esistenti senza alcuna riga in menu_categories (creati tra migrazioni o solo da SQL).
INSERT INTO public.menu_categories (tenant_id, key, label, sort_order)
SELECT o.id, v.key, v.label, v.sort_order
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('antipasti', 'Antipasti', 10),
    ('primi', 'Primi piatti', 20),
    ('secondi', 'Secondi piatti', 30),
    ('dolci', 'Dolci', 40),
    ('bevande', 'Bevande', 50)
) AS v(key, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_categories mc WHERE mc.tenant_id = o.id
)
ON CONFLICT (tenant_id, key) DO NOTHING;
