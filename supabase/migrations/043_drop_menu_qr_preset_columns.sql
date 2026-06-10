-- 043 — Rimozione codice morto preset dal Menu QR
--
-- Le colonne menu_qr_codes.content_type e preset_ids (introdotte in 030) attivavano i
-- "menù-evento (preset)" dentro il QR. Ma il modale MenuQrModal non ha mai esposto un
-- controllo per impostarle: ogni QR viene salvato come 'a_la_carte' con preset_ids vuoto.
-- Tutta la logica preset nel pubblico (PublicMenuPresetPage, rami showPresets) era quindi
-- IRRAGGIUNGIBILE dall'interfaccia. Il caso "evento" è coperto da carosello + nome QR.
--
-- Decisione di Matteo (06-06-26). Verificato su PROD (rwuxgvld) e TEST (docnnernvp) prima
-- del drop: 0 righe con content_type != 'a_la_carte' e 0 righe con preset_ids non vuoto.
-- Il codice applicativo che leggeva/scriveva queste colonne è stato rimosso nella stessa
-- sessione di blindatura.

ALTER TABLE public.menu_qr_codes
  DROP CONSTRAINT IF EXISTS menu_qr_codes_content_type_check;

ALTER TABLE public.menu_qr_codes
  DROP COLUMN IF EXISTS content_type,
  DROP COLUMN IF EXISTS preset_ids;
