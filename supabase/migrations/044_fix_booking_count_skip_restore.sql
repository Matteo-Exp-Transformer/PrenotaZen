-- 044 — Fix D3: il reinserimento dall'archivio non deve gonfiare il contatore annuale
-- di prenotazioni accettate (tenant_usage.bookings_count, usato per i limiti di piano).
--
-- Problema: increment_booking_count_on_accept conta +1 ad OGNI transizione verso
-- 'accepted' con OLD.status != 'accepted'. Il ciclo accetta -> elimina (soft-delete,
-- status='deleted') -> reinserisci (deleted -> accepted) contava la stessa prenotazione
-- due volte, perché l'eliminazione non decrementa.
--
-- Soluzione (opzione "accettazioni nette"): NON contare quando la transizione verso
-- 'accepted' proviene da 'deleted' (cioè un reinserimento di una prenotazione già gestita).
-- Si continua a contare il primo passaggio pending/rejected/insert -> accepted.

CREATE OR REPLACE FUNCTION increment_booking_count_on_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted'
     AND (OLD.status IS NULL OR OLD.status NOT IN ('accepted', 'deleted')) THEN
    INSERT INTO tenant_usage (organization_id, year, bookings_count)
    VALUES (NEW.tenant_id, EXTRACT(YEAR FROM NOW())::INTEGER, 1)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET bookings_count = tenant_usage.bookings_count + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
