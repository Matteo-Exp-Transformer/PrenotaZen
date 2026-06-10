-- Aggiunge campo edition alla tabella organizations.
-- Default 'pro' per retro-compatibilità: i tenant esistenti mantengono tutte le feature attive.
-- Valori ammessi: 'classic' | 'pro' | 'enterprise'

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS edition TEXT NOT NULL DEFAULT 'pro'
  CHECK (edition IN ('classic', 'pro', 'enterprise'));
