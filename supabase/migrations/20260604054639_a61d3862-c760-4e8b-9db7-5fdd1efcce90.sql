
-- 1. Extra fields on work_log_entries
ALTER TABLE public.work_log_entries
  ADD COLUMN IF NOT EXISTS blockers text,
  ADD COLUMN IF NOT EXISTS next_steps text,
  ADD COLUMN IF NOT EXISTS collaborators text,
  ADD COLUMN IF NOT EXISTS completion_pct integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS mood integer,
  ADD COLUMN IF NOT EXISTS attachments_url text[] DEFAULT '{}';

-- super admin can see all work logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_log_entries'
      AND policyname='Super admins can view all work logs'
  ) THEN
    EXECUTE $p$CREATE POLICY "Super admins can view all work logs" ON public.work_log_entries
      FOR SELECT USING (public.is_super_admin(auth.uid()))$p$;
  END IF;
END $$;

-- 2. Clients (CRM) table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text NOT NULL,
  status text NOT NULL DEFAULT 'reached' CHECK (status IN ('reached','rejected','approved','followed_up')),
  source text NOT NULL DEFAULT 'email' CHECK (source IN ('instagram','email','call')),
  notes text,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='Admins manage own clients') THEN
    EXECUTE $p$CREATE POLICY "Admins manage own clients" ON public.clients FOR ALL
      USING (
        assigned_to = (SELECT id FROM public.admins WHERE user_id = auth.uid())
        OR created_by = (SELECT id FROM public.admins WHERE user_id = auth.uid())
        OR public.is_super_admin(auth.uid())
      )
      WITH CHECK (
        assigned_to = (SELECT id FROM public.admins WHERE user_id = auth.uid())
        OR created_by = (SELECT id FROM public.admins WHERE user_id = auth.uid())
        OR public.is_super_admin(auth.uid())
      )$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='Admins view all clients') THEN
    EXECUTE $p$CREATE POLICY "Admins view all clients" ON public.clients FOR SELECT
      USING (public.is_admin(auth.uid()))$p$;
  END IF;
END $$;

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Time-window guard for work_log_entries (IST 22:00–23:59)
CREATE OR REPLACE FUNCTION public.enforce_worklog_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  ist_hour int;
BEGIN
  IF NEW.is_draft IS TRUE THEN RETURN NEW; END IF;
  IF public.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  ist_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::int;
  IF ist_hour < 22 OR ist_hour > 23 THEN
    RAISE EXCEPTION 'Work log can only be submitted between 10:00 PM and 12:00 AM IST.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_worklog_window ON public.work_log_entries;
CREATE TRIGGER trg_enforce_worklog_window
  BEFORE INSERT ON public.work_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_worklog_window();

-- 4. Time-window guard for attendance (IST 06:00–23:59 for check-in)
CREATE OR REPLACE FUNCTION public.enforce_attendance_window()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  ist_hour int;
BEGIN
  IF public.is_super_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.check_in_time IS NULL THEN RETURN NEW; END IF;
  ist_hour := EXTRACT(HOUR FROM (NEW.check_in_time AT TIME ZONE 'Asia/Kolkata'))::int;
  IF ist_hour < 6 OR ist_hour > 23 THEN
    RAISE EXCEPTION 'Attendance can only be marked between 6:00 AM and 12:00 AM IST.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_attendance_window ON public.attendance;
CREATE TRIGGER trg_enforce_attendance_window
  BEFORE INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_window();
