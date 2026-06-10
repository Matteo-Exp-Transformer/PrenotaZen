-- Ripristino turni alla riapertura servizio: max_turns=0 = servizio chiuso (come prima),
-- max_turns_resume memorizza il valore precedente alla chiusura dal pulsante X.

ALTER TABLE service_slots
  ADD COLUMN IF NOT EXISTS max_turns_resume INTEGER NULL;

COMMENT ON COLUMN service_slots.max_turns_resume IS
  'Turni salvati alla chiusura servizio (max_turns impostato a 0); ripristinati alla riapertura.';

CREATE OR REPLACE FUNCTION public.update_service_slot(payload jsonb)
RETURNS SETOF service_slots
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE service_slots
  SET
    name              = COALESCE(payload->>'name', name),
    start_time        = COALESCE((payload->>'start_time')::time, start_time),
    end_time          = COALESCE((payload->>'end_time')::time, end_time),
    max_turns         = CASE WHEN payload ? 'max_turns'
                             THEN NULLIF(payload->>'max_turns', '')::integer
                             ELSE max_turns END,
    max_turns_resume  = CASE WHEN payload ? 'max_turns_resume'
                             THEN NULLIF(payload->>'max_turns_resume', '')::integer
                             ELSE max_turns_resume END,
    max_guests        = CASE WHEN payload ? 'max_guests'
                             THEN NULLIF(payload->>'max_guests', '')::integer
                             ELSE max_guests END,
    display_order     = COALESCE((payload->>'display_order')::integer, display_order),
    updated_at        = now()
  WHERE id = (payload->>'id')::uuid
    AND tenant_id = (payload->>'tenant_id')::uuid
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.update_service_slot(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
