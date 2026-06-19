-- 053_marketing_consent.sql
-- Aggiunge consenso marketing email a booking_requests e customers.
-- Base giuridica: art. 6.1.a GDPR — consenso libero, specifico, informato.
-- Default false: il consenso NON è attivo salvo spunta esplicita del cliente.
-- Il mancato consenso non blocca la prenotazione.

ALTER TABLE booking_requests
  ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE customers
  ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT false;
