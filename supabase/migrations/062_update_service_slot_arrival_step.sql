-- S3: estende la RPC PATCH esistente senza cambiarne la firma pubblica.
CREATE OR REPLACE FUNCTION public.update_service_slot(payload jsonb)
RETURNS SETOF public.service_slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_payload_tenant uuid := (payload->>'tenant_id')::uuid;
BEGIN
  IF v_payload_tenant IS DISTINCT FROM public.current_admin_tenant_id() THEN
    RAISE EXCEPTION 'tenant mismatch: cannot update slot of another tenant' USING ERRCODE = '42501';
  END IF;
  IF payload ? 'arrival_step_minutes'
     AND NULLIF(payload->>'arrival_step_minutes', '')::integer NOT BETWEEN 5 AND 120 THEN
    RAISE EXCEPTION 'arrival_step_minutes must be between 5 and 120' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  UPDATE public.service_slots SET
    name = COALESCE(payload->>'name', name),
    start_time = COALESCE((payload->>'start_time')::time, start_time),
    end_time = COALESCE((payload->>'end_time')::time, end_time),
    max_turns = CASE WHEN payload ? 'max_turns' THEN NULLIF(payload->>'max_turns','')::integer ELSE max_turns END,
    max_turns_resume = CASE WHEN payload ? 'max_turns_resume' THEN NULLIF(payload->>'max_turns_resume','')::integer ELSE max_turns_resume END,
    max_guests = CASE WHEN payload ? 'max_guests' THEN NULLIF(payload->>'max_guests','')::integer ELSE max_guests END,
    display_order = COALESCE((payload->>'display_order')::integer, display_order),
    arrival_step_minutes = CASE WHEN payload ? 'arrival_step_minutes'
      THEN (payload->>'arrival_step_minutes')::integer ELSE arrival_step_minutes END,
    updated_at = now()
  WHERE id = (payload->>'id')::uuid AND tenant_id = v_payload_tenant
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.update_service_slot(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_service_slot(jsonb) TO authenticated, service_role;
