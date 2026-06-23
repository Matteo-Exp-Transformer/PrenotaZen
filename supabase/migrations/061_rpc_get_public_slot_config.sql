-- S3: API pubblica ristretta per configurazione slot e sole soglie operative necessarie.

DROP FUNCTION IF EXISTS public.get_public_slot_config(text);

CREATE FUNCTION public.get_public_slot_config(p_slug text)
RETURNS TABLE(
  slot_id uuid,
  slot_name text,
  start_time text,
  end_time text,
  arrival_step_minutes integer,
  min_duration integer,
  slot_limit_enabled boolean,
  cutoff_minutes integer,
  late_arrival_allowed boolean,
  min_order_time_minutes integer,
  timezone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_slots_enabled boolean := false;
  v_limit_enabled boolean := false;
  v_cutoff integer := 60;
  v_late boolean := false;
  v_min_order integer := 45;
  v_timezone text := 'Europe/Rome';
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{0,62}$' THEN RETURN; END IF;

  SELECT o.id INTO v_tenant_id
  FROM public.organizations o
  WHERE o.slug = p_slug AND o.is_active = true
  LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(bool_or((setting_value #>> '{}')::boolean) FILTER (WHERE setting_key = 'booking_time_slots_enabled'), false),
    COALESCE(bool_or((setting_value #>> '{}')::boolean) FILTER (WHERE setting_key = 'slot_limit_enabled'), false),
    COALESCE(max((setting_value #>> '{}')::integer) FILTER (WHERE setting_key = 'cutoff_minutes'), 60),
    COALESCE(bool_or((setting_value #>> '{}')::boolean) FILTER (WHERE setting_key = 'late_arrival_allowed'), false),
    COALESCE(max((setting_value #>> '{}')::integer) FILTER (WHERE setting_key = 'min_order_time_minutes'), 45),
    COALESCE(max(setting_value #>> '{}') FILTER (WHERE setting_key = 'timezone'), 'Europe/Rome')
  INTO v_slots_enabled, v_limit_enabled, v_cutoff, v_late, v_min_order, v_timezone
  FROM public.restaurant_settings
  WHERE tenant_id = v_tenant_id
    AND setting_key IN ('booking_time_slots_enabled', 'slot_limit_enabled', 'cutoff_minutes',
      'late_arrival_allowed', 'min_order_time_minutes', 'timezone');

  IF NOT v_slots_enabled THEN RETURN; END IF;

  RETURN QUERY
  SELECT ss.id, ss.name::text, to_char(ss.start_time, 'HH24:MI'),
    to_char(ss.end_time, 'HH24:MI'), ss.arrival_step_minutes, ss.min_duration,
    v_limit_enabled, greatest(0, least(v_cutoff, 1440)), v_late,
    greatest(1, least(v_min_order, 1440)), v_timezone
  FROM public.service_slots ss
  WHERE ss.tenant_id = v_tenant_id
  ORDER BY ss.display_order, ss.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_slot_config(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_slot_config(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_slot_config(text) TO anon;
