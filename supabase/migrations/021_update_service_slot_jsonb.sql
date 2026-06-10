-- Riscrive update_service_slot con un SINGOLO parametro jsonb.
-- Motivo: con 9 parametri opzionali PostgREST deve risolvere la firma a ogni chiamata;
-- ogni ambiguità o schema cache stale produce PGRST202 ("function not found").
-- Con un solo parametro jsonb la firma è univoca: il problema sparisce alla radice.
-- Semantica PATCH invariata: chiave assente nel JSON = mantieni valore esistente (COALESCE).
-- "max_guests": null nel JSON = azzera esplicitamente il limite coperti.

-- Elimina la firma a 9 parametri (versione 018 v2) per evitare di nuovo overloading.
DROP FUNCTION IF EXISTS public.update_service_slot(
  uuid, uuid, text, text, text, integer, integer, integer, boolean
);

CREATE OR REPLACE FUNCTION public.update_service_slot(payload jsonb)
RETURNS SETOF service_slots
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE service_slots
  SET
    name          = COALESCE(payload->>'name', name),
    start_time    = COALESCE((payload->>'start_time')::time, start_time),
    end_time      = COALESCE((payload->>'end_time')::time, end_time),
    max_turns     = CASE WHEN payload ? 'max_turns'
                         THEN NULLIF(payload->>'max_turns', '')::integer
                         ELSE max_turns END,
    max_guests    = CASE WHEN payload ? 'max_guests'
                         THEN NULLIF(payload->>'max_guests', '')::integer
                         ELSE max_guests END,
    display_order = COALESCE((payload->>'display_order')::integer, display_order),
    updated_at    = now()
  WHERE id = (payload->>'id')::uuid
    AND tenant_id = (payload->>'tenant_id')::uuid
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.update_service_slot(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
