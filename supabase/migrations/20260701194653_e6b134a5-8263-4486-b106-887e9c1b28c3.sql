
CREATE TABLE IF NOT EXISTS public.time_management_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  changed_by_name text,
  action text NOT NULL DEFAULT 'update_settings',
  prev_snapshot jsonb,
  new_snapshot jsonb,
  diff jsonb,
  reverted boolean NOT NULL DEFAULT false,
  reverted_at timestamptz,
  reverted_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.time_management_audit TO authenticated;
GRANT ALL ON public.time_management_audit TO service_role;
ALTER TABLE public.time_management_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins read audit"
  ON public.time_management_audit FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins write audit"
  ON public.time_management_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "super admins update audit"
  ON public.time_management_audit FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_tm_audit_created ON public.time_management_audit(created_at DESC);
