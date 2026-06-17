-- ============================================================================
-- 052_email_campaigns_heading.sql
-- ============================================================================
-- Aggiunge colonna heading opzionale alle campagne email.
-- null = usa DEFAULT_CAMPAIGN_HEADING cablato nel builder ('Un messaggio per te').
-- ============================================================================

BEGIN;

ALTER TABLE email_campaigns ADD COLUMN heading TEXT;

COMMIT;
