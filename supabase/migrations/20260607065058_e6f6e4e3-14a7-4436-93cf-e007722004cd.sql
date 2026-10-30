CREATE OR REPLACE FUNCTION public.enforce_worklog_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ist_hour int;
  ist_min  int;
BEGIN
  IF NEW.is_draft IS TRUE THEN RETURN NEW; END IF;
  IF public.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  ist_hour := EXTRACT(HOUR   FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int;
  ist_min  := EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int;
  IF NOT (
    (ist_hour > 21 AND ist_hour <= 23)
    OR (ist_hour = 21 AND ist_min >= 30)
  ) THEN
    RAISE EXCEPTION 'Work log can only be submitted between 9:30 PM and 12:00 AM IST.';
  END IF;
  RETURN NEW;
END $$;