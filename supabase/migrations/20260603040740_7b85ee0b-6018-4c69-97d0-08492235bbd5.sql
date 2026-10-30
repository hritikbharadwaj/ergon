-- Work assignments table for "Work Given" feature
CREATE TABLE public.work_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assigned_to_admin_id UUID NOT NULL,
  assigned_by_admin_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending',
  pdf_url TEXT,
  week_key TEXT NOT NULL DEFAULT to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'IYYY-IW'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_assignments TO authenticated;
GRANT ALL ON public.work_assignments TO service_role;

ALTER TABLE public.work_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Assignees can view their work"
ON public.work_assignments FOR SELECT
TO authenticated
USING (
  assigned_to_admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR is_super_admin(auth.uid())
  OR has_admin_role(auth.uid(), 'hr_admin'::admin_role)
);

CREATE POLICY "Assignees can update status"
ON public.work_assignments FOR UPDATE
TO authenticated
USING (
  assigned_to_admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR is_super_admin(auth.uid())
  OR has_admin_role(auth.uid(), 'hr_admin'::admin_role)
);

CREATE POLICY "Super admins and HR can create"
ON public.work_assignments FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR has_admin_role(auth.uid(), 'hr_admin'::admin_role)
);

CREATE POLICY "Super admins and HR can delete"
ON public.work_assignments FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR has_admin_role(auth.uid(), 'hr_admin'::admin_role)
);

CREATE TRIGGER work_assignments_updated_at
BEFORE UPDATE ON public.work_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_work_assignments_assignee ON public.work_assignments(assigned_to_admin_id);
CREATE INDEX idx_work_assignments_week ON public.work_assignments(week_key);
CREATE INDEX idx_work_assignments_created ON public.work_assignments(created_at DESC);

-- Work logs table (general work log entries from the new entry form)
CREATE TABLE public.work_log_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  work_type TEXT NOT NULL,
  project_module TEXT,
  priority TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  hours_spent NUMERIC NOT NULL DEFAULT 0,
  log_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
  time_started TIME,
  time_ended TIME,
  tags TEXT[] DEFAULT '{}'::text[],
  work_impact TEXT,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_billable BOOLEAN NOT NULL DEFAULT false,
  is_draft BOOLEAN NOT NULL DEFAULT false,
  linked_attendance_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_log_entries TO authenticated;
GRANT ALL ON public.work_log_entries TO service_role;

ALTER TABLE public.work_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own work log entries"
ON public.work_log_entries FOR ALL
TO authenticated
USING (
  admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR is_super_admin(auth.uid())
)
WITH CHECK (
  admin_id = (SELECT id FROM admins WHERE user_id = auth.uid())
  OR is_super_admin(auth.uid())
);

CREATE POLICY "All admins can view work log entries"
ON public.work_log_entries FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE TRIGGER work_log_entries_updated_at
BEFORE UPDATE ON public.work_log_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_work_log_entries_admin_date ON public.work_log_entries(admin_id, log_date DESC);