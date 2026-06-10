-- Allinea i testi slide carosello in booking_public_form_config ai limiti editor Prenota:
-- eyebrow 19, title 18, description 38 (BOOKING_CAROUSEL_SLIDE_TEXT_LIMITS).

CREATE OR REPLACE FUNCTION public.clamp_text_jsonb_field(val jsonb, max_len integer)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN val IS NULL OR val = 'null'::jsonb THEN NULL::jsonb
    WHEN jsonb_typeof(val) <> 'string' THEN val
    WHEN length(btrim(val #>> '{}')) = 0 THEN NULL::jsonb
    WHEN length(btrim(val #>> '{}')) > max_len THEN to_jsonb(substring(btrim(val #>> '{}') FROM 1 FOR max_len))
    ELSE to_jsonb(btrim(val #>> '{}'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_booking_carousel_slide_item(item jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_strip_nulls(
    item || jsonb_build_object(
      'eyebrow', public.clamp_text_jsonb_field(item -> 'eyebrow', 19),
      'title', public.clamp_text_jsonb_field(item -> 'title', 18),
      'description', public.clamp_text_jsonb_field(item -> 'description', 38)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_booking_public_form_config_carousel(config jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  modes jsonb;
  new_modes jsonb := '[]'::jsonb;
  m jsonb;
  new_mode jsonb;
  tabs jsonb;
  new_tabs jsonb;
  t jsonb;
  new_tab jsonb;
  new_items jsonb;
BEGIN
  IF config IS NULL OR jsonb_typeof(config) <> 'object' THEN
    RETURN config;
  END IF;

  modes := config -> 'booking_modes';
  IF modes IS NULL OR jsonb_typeof(modes) <> 'array' THEN
    RETURN config;
  END IF;

  FOR m IN SELECT value FROM jsonb_array_elements(modes)
  LOOP
    new_mode := m;
    tabs := m -> 'sub_tabs';
    IF tabs IS NOT NULL AND jsonb_typeof(tabs) = 'array' THEN
      new_tabs := '[]'::jsonb;
      FOR t IN SELECT value FROM jsonb_array_elements(tabs)
      LOOP
        new_tab := t;
        IF t ->> 'display' = 'carousel'
          AND (t ? 'carousel_items')
          AND jsonb_typeof(t -> 'carousel_items') = 'array'
        THEN
          SELECT COALESCE(
            jsonb_agg(public.normalize_booking_carousel_slide_item(elem) ORDER BY ord),
            '[]'::jsonb
          )
          INTO new_items
          FROM jsonb_array_elements(t -> 'carousel_items') WITH ORDINALITY AS x(elem, ord);
          new_tab := jsonb_set(t, '{carousel_items}', new_items, true);
        END IF;
        new_tabs := new_tabs || jsonb_build_array(new_tab);
      END LOOP;
      new_mode := jsonb_set(m, '{sub_tabs}', new_tabs, true);
    END IF;
    new_modes := new_modes || jsonb_build_array(new_mode);
  END LOOP;

  RETURN jsonb_set(config, '{booking_modes}', new_modes, true);
END;
$$;

COMMENT ON FUNCTION public.normalize_booking_public_form_config_carousel(jsonb) IS
  'Clamp carousel slide eyebrow/title/description to Prenota limits (19/18/38).';

UPDATE restaurant_settings
SET
  setting_value = public.normalize_booking_public_form_config_carousel(setting_value),
  updated_at = NOW()
WHERE setting_key = 'booking_public_form_config'
  AND setting_value ? 'booking_modes';
