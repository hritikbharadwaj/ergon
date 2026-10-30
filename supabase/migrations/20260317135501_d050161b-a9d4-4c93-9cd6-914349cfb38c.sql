
-- Email identity assignments (Super Admin assigns sender emails to admins)
CREATE TABLE public.admin_email_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  daily_limit INTEGER NOT NULL DEFAULT 15,
  emails_sent_today INTEGER NOT NULL DEFAULT 0,
  last_sent_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(admin_id),
  UNIQUE(sender_email)
);

ALTER TABLE public.admin_email_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage email identities" ON public.admin_email_identities FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "Admins can view own email identity" ON public.admin_email_identities FOR SELECT USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

-- Email send logs
CREATE TABLE public.admin_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id),
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all email logs" ON public.admin_email_logs FOR SELECT USING (is_super_admin(auth.uid()));
CREATE POLICY "Admins can view own email logs" ON public.admin_email_logs FOR SELECT USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));
CREATE POLICY "Admins can insert own email logs" ON public.admin_email_logs FOR INSERT WITH CHECK (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

-- Quick Notes table (sticky notes for all admins)
CREATE TABLE public.quick_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own notes" ON public.quick_notes FOR ALL USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));

-- Company links/bookmarks
CREATE TABLE public.company_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  icon TEXT,
  created_by UUID REFERENCES public.admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view company links" ON public.company_links FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Super admins can manage company links" ON public.company_links FOR ALL USING (is_super_admin(auth.uid()));

-- Meeting notes
CREATE TABLE public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attendees UUID[] DEFAULT '{}',
  created_by UUID REFERENCES public.admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view meeting notes" ON public.meeting_notes FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can create meeting notes" ON public.meeting_notes FOR INSERT WITH CHECK (created_by = (SELECT id FROM admins WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can manage meeting notes" ON public.meeting_notes FOR ALL USING (is_super_admin(auth.uid()));

-- Expense claims
CREATE TABLE public.expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id),
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.admins(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own expenses" ON public.expense_claims FOR ALL USING (admin_id = (SELECT id FROM admins WHERE user_id = auth.uid()));
CREATE POLICY "Super admins can manage all expenses" ON public.expense_claims FOR ALL USING (is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_admin_email_identities_updated_at BEFORE UPDATE ON public.admin_email_identities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quick_notes_updated_at BEFORE UPDATE ON public.quick_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meeting_notes_updated_at BEFORE UPDATE ON public.meeting_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_expense_claims_updated_at BEFORE UPDATE ON public.expense_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
