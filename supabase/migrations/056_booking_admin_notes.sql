-- 056_booking_admin_notes
-- Appunti interni admin associati alla singola prenotazione (solo dal modal dettaglio).
-- Colonna additive-only: nullable, nessun constraint, nessun default.
-- Nessun GRANT nuovo necessario (colonna su tabella esistente, eredita i grant di booking_requests).
-- Nessun RLS aggiuntivo: coperta dalle policy esistenti su booking_requests.
-- Applicata su TEST docnnernvp il 2026-06-21 (version 20260621015549). PROD rwuxgvld: vedi FU-056-PROD.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS admin_notes text;
