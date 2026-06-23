-- S3: API pubblica ristretta per nascondere le fasce senza capienza residua.
-- Non espone prenotazioni o impostazioni private; pending non consuma capacità (D36).

DROP FUNCTION IF EXISTS public.get_available_arrival_times(text, date, integer);

CREATE FUNCTION public.get_available_arrival_times(
  p_slug text,
  p_date date,
  p_card_duration integer DEFAULT 0,
  p_num_guests integer DEFAULT 1
)
RETURNS TABLE(slot_id uuid, slot_name text, available_times text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_slots_enabled boolean := false;
  v_limit_enabled boolean := false;
  v_slot record;
  v_cap integer;
  v_occupied integer;
  v_override_cap integer;
  v_legacy_cap integer;
  v_times text[];
  v_start integer;
  v_end integer;
  v_current integer;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{0,62}$'
     OR p_date IS NULL OR p_num_guests NOT BETWEEN 1 AND 500
     OR p_card_duration NOT BETWEEN 0 AND 1440 THEN
    RETURN;
  END IF;

  SELECT o.id INTO v_tenant_id
  FROM public.organizations o
  WHERE o.slug = p_slug AND o.is_active = true
  LIMIT 1;
  IF v_tenant_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE((rs.setting_value #>> '{}')::boolean, false)
  INTO v_slots_enabled
  FROM public.restaurant_settings rs
  WHERE rs.tenant_id = v_tenant_id
    AND rs.setting_key = 'booking_time_slots_enabled';

  SELECT COALESCE((rs.setting_value #>> '{}')::boolean, false)
  INTO v_limit_enabled
  FROM public.restaurant_settings rs
  WHERE rs.tenant_id = v_tenant_id
    AND rs.setting_key = 'slot_limit_enabled';

  IF NOT COALESCE(v_slots_enabled, false) OR NOT COALESCE(v_limit_enabled, false) THEN
    RETURN;
  END IF;

  FOR v_slot IN
    SELECT ss.id, ss.name, ss.start_time, ss.end_time,
           ss.max_guests, ss.arrival_step_minutes, ss.display_order
    FROM public.service_slots ss
    WHERE ss.tenant_id = v_tenant_id
    ORDER BY ss.display_order, ss.id
  LOOP
    SELECT (rs.setting_value ->> v_slot.id::text)::integer
    INTO v_legacy_cap
    FROM public.restaurant_settings rs
    WHERE rs.tenant_id = v_tenant_id
      AND rs.setting_key = 'slot_guest_capacities';

    SELECT sso.max_guests
    INTO v_override_cap
    FROM public.service_slot_overrides sso
    WHERE sso.tenant_id = v_tenant_id
      AND sso.service_slot_id = v_slot.id
      AND sso.date_from <= p_date
      AND sso.date_to >= p_date
    ORDER BY (sso.date_to - sso.date_from) ASC, sso.created_at DESC
    LIMIT 1;

    v_cap := COALESCE(v_override_cap, v_slot.max_guests, v_legacy_cap);

    SELECT COALESCE(sum(br.num_guests), 0)::integer
    INTO v_occupied
    FROM public.booking_requests br
    WHERE br.tenant_id = v_tenant_id
      AND br.status = 'accepted'
      AND br.no_show IS NOT TRUE
      AND br.confirmed_start IS NOT NULL
      AND (br.confirmed_start AT TIME ZONE 'Europe/Rome')::date = p_date
      AND (
        CASE WHEN v_slot.end_time < v_slot.start_time
          THEN (br.confirmed_start AT TIME ZONE 'Europe/Rome')::time >= v_slot.start_time
            OR (br.confirmed_start AT TIME ZONE 'Europe/Rome')::time < v_slot.end_time
          ELSE (br.confirmed_start AT TIME ZONE 'Europe/Rome')::time >= v_slot.start_time
            AND (br.confirmed_start AT TIME ZONE 'Europe/Rome')::time < v_slot.end_time
        END
      );

    v_times := ARRAY[]::text[];
    IF v_cap IS NULL OR v_occupied + p_num_guests <= v_cap THEN
      v_start := extract(hour from v_slot.start_time)::integer * 60
        + extract(minute from v_slot.start_time)::integer;
      v_end := extract(hour from v_slot.end_time)::integer * 60
        + extract(minute from v_slot.end_time)::integer;
      IF v_end <= v_start THEN v_end := v_end + 1440; END IF;
      v_current := v_start;
      WHILE v_current < v_end LOOP
        v_times := array_append(v_times,
          lpad(((v_current % 1440) / 60)::text, 2, '0') || ':' ||
          lpad((v_current % 60)::text, 2, '0'));
        v_current := v_current + v_slot.arrival_step_minutes;
      END LOOP;
    END IF;

    slot_id := v_slot.id;
    slot_name := v_slot.name;
    available_times := v_times;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_arrival_times(text, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_available_arrival_times(text, date, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_arrival_times(text, date, integer, integer) TO anon;
