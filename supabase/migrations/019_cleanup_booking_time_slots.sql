-- Rimuove la chiave deprecata booking_time_slots da restaurant_settings.
-- Le fasce orarie sono ora gestite da service_slots (is_canonical) tramite useCanonicalTimeSlots.

DELETE FROM restaurant_settings WHERE setting_key = 'booking_time_slots';
