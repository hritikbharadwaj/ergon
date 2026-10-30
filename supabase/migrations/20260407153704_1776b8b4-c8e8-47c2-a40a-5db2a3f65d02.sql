
CREATE TABLE public.face_descriptors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  descriptor JSONB NOT NULL,
  face_photo_url TEXT,
  registered_by UUID REFERENCES public.admins(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_id)
);

ALTER TABLE public.face_descriptors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage face descriptors"
ON public.face_descriptors FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view own face descriptor"
ON public.face_descriptors FOR SELECT
USING (admin_id = (SELECT admins.id FROM admins WHERE admins.user_id = auth.uid()));

CREATE POLICY "Admins can view all face descriptors for matching"
ON public.face_descriptors FOR SELECT
USING (is_admin(auth.uid()));

CREATE TRIGGER update_face_descriptors_updated_at
BEFORE UPDATE ON public.face_descriptors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_face_descriptors_admin_id ON public.face_descriptors(admin_id);
