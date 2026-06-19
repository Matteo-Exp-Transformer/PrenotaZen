-- 054_dietary_consent.sql
-- Consenso esplicito al trattamento dei dati alimentari (allergie/intolleranze) su booking_requests.
-- Base giuridica: art. 9.2.a GDPR — consenso esplicito per categorie particolari di dati (salute).
-- Default false: il consenso NON è attivo salvo spunta esplicita del cliente.
-- L'edge create-booking rifiuta (400) una prenotazione con dati alimentari ma senza consenso.
--   dietary_data_consent        — il cliente ha acconsentito al trattamento dei dati alimentari
--   dietary_data_consent_at     — timestamp del consenso (valorizzato solo se consent = true)
--   dietary_off_platform_notice — il cliente è stato avvisato di comunicare le allergie fuori piattaforma
--
-- NB allineamento ambienti: queste colonne erano già state applicate su TEST (docnnernvp) via MCP
-- come migrazione "dietary_consent" (20260618140448). Questo file le porta nel repo per applicarle a
-- PROD (rwuxgvld) con lo stesso schema. Sono colonne su tabella esistente (RLS già attiva): nessun
-- GRANT aggiuntivo richiesto (la regola GRANT 30-05-2026 riguarda le tabelle public nuove).

ALTER TABLE booking_requests
  ADD COLUMN dietary_data_consent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE booking_requests
  ADD COLUMN dietary_data_consent_at TIMESTAMPTZ;

ALTER TABLE booking_requests
  ADD COLUMN dietary_off_platform_notice BOOLEAN NOT NULL DEFAULT false;
