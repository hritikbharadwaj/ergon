
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS final_status text CHECK (final_status IN ('present','absent')),
  ADD COLUMN IF NOT EXISTS final_marked_by uuid REFERENCES public.admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_marked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_attendance_final_status ON public.attendance(final_status);
