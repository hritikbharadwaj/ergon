
-- Activity logs table for blog publishing
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  blog_id TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert activity logs" ON public.activity_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view activity logs" ON public.activity_logs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Public can view activity logs" ON public.activity_logs FOR SELECT USING (true);

-- Fix chat_messages: allow delete and update for own messages
CREATE POLICY "Admins can delete their own chat messages"
  ON public.chat_messages FOR DELETE
  USING (sender_id = (SELECT admins.id FROM admins WHERE admins.user_id = auth.uid()));

CREATE POLICY "Admins can update their own chat messages"
  ON public.chat_messages FOR UPDATE
  USING (sender_id = (SELECT admins.id FROM admins WHERE admins.user_id = auth.uid()));
