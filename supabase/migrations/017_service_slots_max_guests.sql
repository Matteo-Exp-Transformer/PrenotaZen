-- Aggiunge max_guests per fascia: coperti massimi accettabili in quella fascia.
-- Usato da useCapacityCheck per rifiutare prenotazioni oltre limite.
ALTER TABLE service_slots
  ADD COLUMN IF NOT EXISTS max_guests INTEGER DEFAULT NULL;
