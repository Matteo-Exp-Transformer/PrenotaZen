-- Trigger counters touch tenant_usage under RLS; run as definer so INSERT/UPDATE succeed.
CREATE OR REPLACE FUNCTION public.increment_booking_request_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_usage (organization_id, year, booking_requests_count)
  VALUES (NEW.tenant_id, EXTRACT(YEAR FROM NOW())::INTEGER, 1)
  ON CONFLICT (organization_id, year)
  DO UPDATE SET booking_requests_count = public.tenant_usage.booking_requests_count + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_booking_count_on_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    INSERT INTO public.tenant_usage (organization_id, year, bookings_count)
    VALUES (NEW.tenant_id, EXTRACT(YEAR FROM NOW())::INTEGER, 1)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET bookings_count = public.tenant_usage.bookings_count + 1;
  END IF;
  RETURN NEW;
END;
$$;
