-- RPC per aggiornare una fascia oraria bypassando la schema cache PostgREST.
-- Necessaria finché PostgREST non riconosce le colonne aggiunte dinamicamente (016/017).
-- Tutti i parametri opzionali: NULL = mantieni valore esistente (PATCH semantics).
-- p_clear_max_guests = TRUE forza max_guests a NULL esplicitamente.
CREATE OR REPLACE FUNCTION public.update_service_slot(
  p_id               UUID,
  p_tenant_id        UUID,
  p_name             TEXT    DEFAULT NULL,
  p_start_time       TEXT    DEFAULT NULL,
  p_end_time         TEXT    DEFAULT NULL,
  p_max_turns        INTEGER DEFAULT NULL,
  p_max_guests       INTEGER DEFAULT NULL,
  p_display_order    INTEGER DEFAULT NULL,
  p_clear_max_guests BOOLEAN DEFAULT FALSE
)
RETURNS SETOF service_slots
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE service_slots
  SET
    name          = COALESCE(p_name,             name),
    start_time    = COALESCE(p_start_time::time,  start_time),
    end_time      = COALESCE(p_end_time::time,    end_time),
    max_turns     = CASE WHEN p_max_turns     IS NOT NULL THEN p_max_turns     ELSE max_turns     END,
    max_guests    = CASE WHEN p_clear_max_guests THEN NULL
                         WHEN p_max_guests IS NOT NULL THEN p_max_guests
                         ELSE max_guests END,
    display_order = COALESCE(p_display_order,     display_order),
    updated_at    = now()
  WHERE id = p_id
    AND tenant_id = p_tenant_id
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.update_service_slot TO authenticated;

-- RPC per insert, stesso motivo
CREATE OR REPLACE FUNCTION public.insert_service_slot(
  p_tenant_id     UUID,
  p_name          TEXT,
  p_start_time    TEXT,
  p_end_time      TEXT,
  p_max_turns     INTEGER,
  p_max_guests    INTEGER,
  p_display_order INTEGER
)
RETURNS SETOF service_slots
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO service_slots (tenant_id, name, start_time, end_time, max_turns, max_guests, display_order)
  VALUES (p_tenant_id, p_name, p_start_time::time, p_end_time::time, p_max_turns, p_max_guests, p_display_order)
  RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.insert_service_slot TO authenticated;
