-- Attendance settings: make timing and working-day rules configurable
ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS check_in_start TIME NOT NULL DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS present_until TIME NOT NULL DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS late_until TIME NOT NULL DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS attendance_close TIME NOT NULL DEFAULT '23:59:59',
  ADD COLUMN IF NOT EXISTS checkout_start TIME NOT NULL DEFAULT '21:30',
  ADD COLUMN IF NOT EXISTS checkout_end TIME NOT NULL DEFAULT '23:59:59',
  ADD COLUMN IF NOT EXISTS worklog_start TIME NOT NULL DEFAULT '21:30',
  ADD COLUMN IF NOT EXISTS worklog_end TIME NOT NULL DEFAULT '23:59:59',
  ADD COLUMN IF NOT EXISTS weekends_are_holidays BOOLEAN NOT NULL DEFAULT true;

-- Keep attendance_settings as a singleton settings table
CREATE UNIQUE INDEX IF NOT EXISTS attendance_settings_singleton_idx ON public.attendance_settings ((true));

-- Per-admin module authority table
CREATE TABLE IF NOT EXISTS public.admin_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  module_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_module_permissions TO authenticated;
GRANT ALL ON public.admin_module_permissions TO service_role;
ALTER TABLE public.admin_module_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view own module permissions" ON public.admin_module_permissions;
CREATE POLICY "Admins can view own module permissions"
ON public.admin_module_permissions FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Super admins manage module permissions" ON public.admin_module_permissions;
CREATE POLICY "Super admins manage module permissions"
ON public.admin_module_permissions FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()))
;
DROP TRIGGER IF EXISTS admin_module_permissions_updated_at ON public.admin_module_permissions;
CREATE TRIGGER admin_module_permissions_updated_at
BEFORE UPDATE ON public.admin_module_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payroll records for salary slips
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  employee_data_id UUID,
  salary_month DATE NOT NULL,
  gross_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  working_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid')),
  payment_date DATE,
  notes TEXT,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (admin_id, salary_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_records TO authenticated;
GRANT ALL ON public.payroll_records TO service_role;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view own payroll" ON public.payroll_records;
CREATE POLICY "Admins can view own payroll"
ON public.payroll_records FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid())
);
DROP POLICY IF EXISTS "Super admins manage payroll" ON public.payroll_records;
CREATE POLICY "Super admins manage payroll"
ON public.payroll_records FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()))
;
DROP TRIGGER IF EXISTS payroll_records_updated_at ON public.payroll_records;
CREATE TRIGGER payroll_records_updated_at
BEFORE UPDATE ON public.payroll_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_payroll_records_admin_month ON public.payroll_records(admin_id, salary_month DESC);

-- Helper: an admin's explicit module override. Super admin always allowed.
CREATE OR REPLACE FUNCTION public.admin_has_module_permission(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
  OR EXISTS (
    SELECT 1
    FROM public.admin_module_permissions amp
    JOIN public.admins a ON a.id = amp.admin_id
    WHERE a.user_id = _user_id
      AND amp.module_key = _module_key
      AND amp.is_enabled = true
      AND a.is_active = true
  )
$$;

-- Helper: working days honor weekend toggle and special holidays.
CREATE OR REPLACE FUNCTION public.is_attendance_working_day(_date date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.attendance_settings%ROWTYPE;
  dow int;
  holiday_exists boolean;
BEGIN
  SELECT * INTO settings_row FROM public.attendance_settings ORDER BY created_at ASC LIMIT 1;
  dow := EXTRACT(DOW FROM _date)::int;
  holiday_exists := EXISTS (
    SELECT 1 FROM public.holidays h
    WHERE h.date = _date
       OR (h.is_recurring = true AND EXTRACT(MONTH FROM h.date) = EXTRACT(MONTH FROM _date) AND EXTRACT(DAY FROM h.date) = EXTRACT(DAY FROM _date))
  );
  IF holiday_exists THEN RETURN false; END IF;
  IF COALESCE(settings_row.weekends_are_holidays, true) AND dow IN (0, 6) THEN RETURN false; END IF;
  RETURN true;
END;
$$;

-- Helper: status from configurable attendance windows.
CREATE OR REPLACE FUNCTION public.attendance_status_for_time(_at timestamptz)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.attendance_settings%ROWTYPE;
  t time;
BEGIN
  SELECT * INTO settings_row FROM public.attendance_settings ORDER BY created_at ASC LIMIT 1;
  t := (_at AT TIME ZONE 'Asia/Kolkata')::time;
  IF t >= COALESCE(settings_row.check_in_start, '06:00'::time) AND t < COALESCE(settings_row.present_until, '11:00'::time) THEN
    RETURN 'present';
  ELSIF t >= COALESCE(settings_row.present_until, '11:00'::time) AND t < COALESCE(settings_row.late_until, '17:00'::time) THEN
    RETURN 'late';
  ELSE
    RETURN 'absent';
  END IF;
END;
$$;

-- General time-window helper, supports same-day windows used here.
CREATE OR REPLACE FUNCTION public.is_time_in_window(_at timestamptz, _start time, _end time)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t time := (_at AT TIME ZONE 'Asia/Kolkata')::time;
BEGIN
  IF _start <= _end THEN
    RETURN t >= _start AND t <= _end;
  END IF;
  RETURN t >= _start OR t <= _end;
END;
$$;

-- Work-log submission window now uses Super Admin settings.
CREATE OR REPLACE FUNCTION public.enforce_worklog_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.attendance_settings%ROWTYPE;
BEGIN
  IF NEW.is_draft IS TRUE THEN RETURN NEW; END IF;
  IF public.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  SELECT * INTO settings_row FROM public.attendance_settings ORDER BY created_at ASC LIMIT 1;
  IF NOT public.is_time_in_window(now(), COALESCE(settings_row.worklog_start, '21:30'::time), COALESCE(settings_row.worklog_end, '23:59:59'::time)) THEN
    RAISE EXCEPTION 'Work log can only be submitted during the configured IST work-log window.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_worklog_window ON public.work_log_entries;
CREATE TRIGGER trg_enforce_worklog_window
BEFORE INSERT OR UPDATE ON public.work_log_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_worklog_window();

-- Attendance check-in window now uses Super Admin settings and holidays.
CREATE OR REPLACE FUNCTION public.enforce_attendance_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.attendance_settings%ROWTYPE;
  check_at timestamptz;
BEGIN
  IF public.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.date IS NOT NULL AND NOT public.is_attendance_working_day(NEW.date) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO settings_row FROM public.attendance_settings ORDER BY created_at ASC LIMIT 1;
  check_at := COALESCE(NEW.check_in_time, NEW.marked_at, now());
  IF NEW.check_in_time IS NOT NULL AND NOT public.is_time_in_window(check_at, COALESCE(settings_row.check_in_start, '06:00'::time), COALESCE(settings_row.attendance_close, '23:59:59'::time)) THEN
    RAISE EXCEPTION 'Attendance can only be marked during the configured IST attendance window.';
  END IF;
  IF NEW.check_out_time IS NOT NULL AND NOT public.is_time_in_window(COALESCE(NEW.check_out_time, now()), COALESCE(settings_row.checkout_start, '21:30'::time), COALESCE(settings_row.checkout_end, '23:59:59'::time)) THEN
    RAISE EXCEPTION 'Checkout can only be marked during the configured IST checkout window.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_attendance_window ON public.attendance;
CREATE TRIGGER trg_enforce_attendance_window
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_window();

-- Work-log helper now includes the unified work_log_entries table and checks by IST log date.
CREATE OR REPLACE FUNCTION public.admin_has_work_log_for_date(p_admin_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.work_log_entries
    WHERE admin_id = p_admin_id
      AND is_draft = false
      AND (log_date = p_date OR (created_at AT TIME ZONE 'Asia/Kolkata')::date = p_date)
  )
  OR EXISTS (
    SELECT 1
    FROM public.tech_work_logs
    WHERE admin_id = p_admin_id
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = p_date
  )
  OR EXISTS (
    SELECT 1
    FROM public.content_work_logs
    WHERE admin_id = p_admin_id
      AND (created_at AT TIME ZONE 'Asia/Kolkata')::date = p_date
  );
$$;