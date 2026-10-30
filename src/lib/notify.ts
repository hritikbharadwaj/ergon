import { supabase } from '@/integrations/supabase/client';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationPayload {
  title: string;
  message: string;
  senderAdminId?: string | null;
  priority?: NotificationPriority;
  extraRecipientIds?: string[];
  metadata?: Record<string, unknown>;
}

// Memory throttle cache to avoid duplicate spam notifications within a short window
const notificationCache = new Map<string, number>();
const DEDUPE_WINDOW_MS = 4000;

function isDuplicateNotification(key: string): boolean {
  const now = Date.now();
  const lastSent = notificationCache.get(key);
  if (lastSent && now - lastSent < DEDUPE_WINDOW_MS) {
    return true;
  }
  notificationCache.set(key, now);
  // Clean up older keys
  if (notificationCache.size > 200) {
    for (const [k, time] of notificationCache.entries()) {
      if (now - time > DEDUPE_WINDOW_MS * 2) {
        notificationCache.delete(k);
      }
    }
  }
  return false;
}

/**
 * Notify all super-admins (and optionally extra admin ids) about a noteworthy event.
 * Writes into admin_notifications using `recipient_type='specific'` + recipients[].
 * Safe to call without await — failures are swallowed so they never block primary flows.
 */
export async function notifySuperAdmins(opts: NotificationPayload): Promise<void> {
  const dedupeKey = `${opts.title}:${opts.message}`;
  if (isDuplicateNotification(dedupeKey)) {
    return;
  }

  try {
    const { data: supers, error: adminQueryError } = await supabase
      .from('admins')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_active', true);

    if (adminQueryError) {
      console.warn('Failed to query super admins for notification:', adminQueryError);
      return;
    }

    const ids = Array.from(
      new Set([
        ...(supers || []).map((a: any) => a.id),
        ...(opts.extraRecipientIds || []),
      ])
    );

    if (ids.length === 0) return;

    await supabase.from('admin_notifications').insert([
      {
        title: opts.title.trim(),
        message: opts.message.trim(),
        sender_id: opts.senderAdminId || null,
        recipient_type: 'specific',
        recipients: ids,
        priority: opts.priority || 'normal',
      } as any,
    ]);
  } catch (e) {
    console.warn('notifySuperAdmins error:', e);
  }
}

/**
 * Send batch notifications safely
 */
export async function notifyAdminsBatch(notifications: NotificationPayload[]): Promise<void> {
  for (const notif of notifications) {
    await notifySuperAdmins(notif);
  }
}
