-- Rimuove la firma legacy di update_service_slot (8 parametri, senza p_clear_max_guests).
-- Conviveva per overloading con la versione corretta a 9 parametri (migrazione 018 v2),
-- causando PGRST202: PostgREST non riusciva a risolvere quale overload chiamare.
DROP FUNCTION IF EXISTS public.update_service_slot(
  uuid, uuid, text, text, text, integer, integer, integer
);

NOTIFY pgrst, 'reload schema';
