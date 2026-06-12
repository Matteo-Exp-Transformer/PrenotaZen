-- ============================================================================
-- 047_restrict_anon_restaurant_settings.sql
-- ============================================================================
-- WP-B2 — restringe la lettura anonima di `restaurant_settings` a una whitelist
-- di sole 11 setting_key PUBBLICHE.
--
-- Scopo: oggi la policy `anon_select_restaurant_settings` (creata in 001) usa
-- USING (true): anon puo' leggere QUALSIASI riga di QUALSIASI tenant, inclusa
-- qualsiasi setting_key futura, anche sensibile/amministrativa. L'anon non e'
-- autenticato a un tenant, quindi NON si puo' filtrare per tenant: si filtra per
-- WHITELIST di setting_key.
--
-- Razionale della whitelist (refactor WP-B2 12-06-26):
--   Le sole letture che devono passare come ruolo `anon` sono quelle delle
--   pagine pubbliche (/prenota/:slug, /menu/:slug), che leggono via il client
--   `supabasePublic` (anon key, persistSession:false). Queste pagine usano un
--   insieme RISTRETTO di setting_key: identita'/contatti ristorante, orari,
--   aspetto pagina pubblica, configurazione form e preset/promo Prenota.
--
--   Le 8 setting_key SOLO-ADMIN — app_theme, booking_placement_areas,
--   daily_guest_limit, slot_guest_capacities, booking_time_slots_enabled,
--   walk_in_max_guests, timezone, booking_window_days — NON sono piu' lette via
--   `supabasePublic`: dopo il refactor WP-B2 i loro call-site (tutti sotto
--   /admin, utente sempre loggato) passano `{ authenticated: true }` a
--   `useRestaurantSetting`, quindi leggono dal client AUTENTICATO `supabase`
--   (ruolo authenticated, policy admin_* di 002). Non servono ad anon → restano
--   FUORI dalla whitelist e diventano invisibili al ruolo `anon`.
--
--   Le scritture admin restano sul client autenticato `supabase` (policy
--   admin_* di 002, NON toccate qui). Le letture lato server dell'Edge Function
--   create-booking usano service_role (bypassano la RLS) e NON dipendono da
--   questa whitelist.
--
-- Universo reale delle key sul DB (SELECT setting_key in sola lettura 12-06-26):
--   TEST docnnernvp (14): app_theme, booking_custom_staff_presets,
--     booking_menu_promos, booking_public_form_config, booking_time_slots_enabled,
--     business_hours, contact_address, contact_email, contact_phone,
--     daily_guest_limit, public_booking_page_background, public_booking_strip_photo,
--     restaurant_name, slot_guest_capacities.
--   Nessuna key fuori dal registry e' presente sui DB.
--
-- Idempotente: DROP ... IF EXISTS + CREATE con la nuova definizione.
-- Reversibile: per tornare allo stato attuale, ricreare la policy con USING (true).
-- ============================================================================

BEGIN;

-- restaurant_settings: anon puo' leggere SOLO le 11 setting_key PUBBLICHE in
-- whitelist (qualsiasi tenant, come prima: anon non e' legato a un tenant).
-- Qualsiasi altra key (le 8 solo-admin, o key sensibili/future) diventa
-- invisibile ad anon.
DROP POLICY IF EXISTS anon_select_restaurant_settings ON public.restaurant_settings;
CREATE POLICY anon_select_restaurant_settings
  ON public.restaurant_settings
  FOR SELECT
  TO anon
  USING (
    setting_key = ANY (ARRAY[
      -- ─ Identita' / contatti ristorante (Prenota header + footer, Menu QR footer) ─
      'restaurant_name',
      'contact_email',
      'contact_phone',
      'contact_address',
      -- ─ Orari (Prenota: slot disponibili) ─
      'business_hours',
      -- ─ Aspetto pagina pubblica Prenota ─
      'public_booking_page_background',
      'public_booking_strip_photo',
      -- ─ Configurazione form pubblico + preset/promo Prenota ─
      'booking_public_form_config',
      'booking_staff_presets_visible',
      'booking_custom_staff_presets',
      'booking_menu_promos'
    ]::text[])
  );

COMMIT;

-- ── ROLLBACK (manuale, in caso di regressione) ───────────────────────────────
-- BEGIN;
-- DROP POLICY IF EXISTS anon_select_restaurant_settings ON public.restaurant_settings;
-- CREATE POLICY anon_select_restaurant_settings
--   ON public.restaurant_settings FOR SELECT TO anon USING (true);
-- COMMIT;
