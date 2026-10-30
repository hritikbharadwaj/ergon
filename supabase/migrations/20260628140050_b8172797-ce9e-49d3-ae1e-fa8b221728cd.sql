
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::integer[];

CREATE OR REPLACE FUNCTION public.is_attendance_working_day(_date date)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  settings_row public.attendance_settings%ROWTYPE;
  dow int;
  holiday_exists boolean;
  workdays int[];
BEGIN
  SELECT * INTO settings_row FROM public.attendance_settings ORDER BY created_at ASC LIMIT 1;
  dow := EXTRACT(DOW FROM _date)::int;
  holiday_exists := EXISTS (
    SELECT 1 FROM public.holidays h
    WHERE h.date = _date
       OR (h.is_recurring = true AND EXTRACT(MONTH FROM h.date) = EXTRACT(MONTH FROM _date) AND EXTRACT(DAY FROM h.date) = EXTRACT(DAY FROM _date))
  );
  IF holiday_exists THEN RETURN false; END IF;
  workdays := COALESCE(settings_row.working_days, ARRAY[1,2,3,4,5]::int[]);
  IF array_length(workdays, 1) IS NOT NULL THEN
    IF NOT (dow = ANY(workdays)) THEN RETURN false; END IF;
    RETURN true;
  END IF;
  IF COALESCE(settings_row.weekends_are_holidays, true) AND dow IN (0, 6) THEN RETURN false; END IF;
  RETURN true;
END;
$function$;
