import { supabase } from '@/integrations/supabase/client';

/**
 * Notify all super-admins (and optionally extra admin ids) about a noteworthy event.
 * Writes into admin_notifications using `recipient_type='specific'` + recipients[].
 * Safe to call without await — failures are swallowed so they never block primary flows.
 */
export async function notifySuperAdmins(opts: {
  title: string;
  message: string;
  senderAdminId?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  extraRecipientIds?: string[];
}) {
  try {
    const { data: supers } = await supabase
      .from('admins').select('id').eq('role', 'super_admin').eq('is_active', true);
    const ids = Array.from(new Set([
      ...(supers || []).map((a: any) => a.id),
      ...(opts.extraRecipientIds || []),
    ]));
    if (ids.length === 0) return;
    await supabase.from('admin_notifications').insert([{
      title: opts.title,
      message: opts.message,
      sender_id: opts.senderAdminId || null,
      recipient_type: 'specific',
      recipients: ids,
      priority: opts.priority || 'normal',
    } as any]);
  } catch (e) {
    console.warn('notifySuperAdmins failed', e);
  }
}