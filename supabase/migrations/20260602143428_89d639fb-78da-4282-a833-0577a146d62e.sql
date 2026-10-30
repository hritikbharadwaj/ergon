
-- 1. Click events
CREATE TABLE IF NOT EXISTS public.admin_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  event_key text NOT NULL,
  label text,
  route text,
  meta jsonb DEFAULT '{}'::jsonb,
  meeting_id uuid,
  month_key text NOT NULL DEFAULT to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_click_events_admin_month_idx ON public.admin_click_events(admin_id, month_key);
CREATE INDEX IF NOT EXISTS admin_click_events_event_idx ON public.admin_click_events(event_key, month_key);

GRANT SELECT, INSERT ON public.admin_click_events TO authenticated;
GRANT ALL ON public.admin_click_events TO service_role;
ALTER TABLE public.admin_click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins insert own clicks" ON public.admin_click_events
  FOR INSERT TO authenticated
  WITH CHECK (admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid()));
CREATE POLICY "admins view own clicks" ON public.admin_click_events
  FOR SELECT TO authenticated
  USING (admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- 2. Section time tracking (per day per route)
CREATE TABLE IF NOT EXISTS public.admin_section_time (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  route text NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  seconds integer NOT NULL DEFAULT 0,
  month_key text NOT NULL DEFAULT to_char((now() AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_id, route, day)
);
CREATE INDEX IF NOT EXISTS admin_section_time_admin_month_idx ON public.admin_section_time(admin_id, month_key);

GRANT SELECT, INSERT, UPDATE ON public.admin_section_time TO authenticated;
GRANT ALL ON public.admin_section_time TO service_role;
ALTER TABLE public.admin_section_time ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage own section time" ON public.admin_section_time
  FOR ALL TO authenticated
  USING (admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));

-- 3. PDF schedules
CREATE TABLE IF NOT EXISTS public.pdf_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_admin_id uuid NOT NULL,
  name text NOT NULL,
  report_type text NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
  theme text NOT NULL DEFAULT 'classic',
  range_mode text NOT NULL DEFAULT '1m',
  recipients text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_schedules TO authenticated;
GRANT ALL ON public.pdf_schedules TO service_role;
ALTER TABLE public.pdf_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage schedules" ON public.pdf_schedules
  FOR ALL TO authenticated
  USING (owner_admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (owner_admin_id = (SELECT id FROM public.admins WHERE user_id = auth.uid()) OR public.is_super_admin(auth.uid()));
