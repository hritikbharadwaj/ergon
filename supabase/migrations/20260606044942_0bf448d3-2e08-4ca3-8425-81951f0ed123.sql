
-- 1. Public read of active admins (for Home page)
DROP POLICY IF EXISTS "Public can view active admins" ON public.admins;
CREATE POLICY "Public can view active admins"
  ON public.admins
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

GRANT SELECT ON public.admins TO anon;

-- 2. Switch sender domain from admin.thrylos.in to thrylos.in
UPDATE public.admin_email_identities
SET sender_email = REPLACE(sender_email, '@admin.thrylos.in', '@thrylos.in')
WHERE sender_email LIKE '%@admin.thrylos.in';
