import { supabase } from '@/integrations/supabase/client';

let cachedAdminId: string | null = null;

export const setTrackingAdminId = (id: string | null) => {
  cachedAdminId = id;
};

export const getTrackingAdminId = () => cachedAdminId;

export interface TrackClickArgs {
  key: string;
  label?: string;
  route?: string;
  meetingId?: string;
  meta?: Record<string, unknown>;
}

/** Fire-and-forget click tracker. Safe to call without awaiting. */
export const trackClick = async ({ key, label, route, meetingId, meta }: TrackClickArgs) => {
  if (!cachedAdminId) return;
  try {
    // Attach lightweight device context so activity summary can show device/UA info.
    const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);
    const ua: string = nav.userAgent || '';
    const device =
      /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' :
      /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';
    const enrichedMeta = {
      ...(meta ?? {}),
      device,
      user_agent: ua.slice(0, 240),
      language: nav.language,
      screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      tz: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone,
    };
    await supabase.from('admin_click_events').insert([{
      admin_id: cachedAdminId,
      event_key: key,
      label: label ?? null,
      route: route ?? window.location.pathname,
      meeting_id: meetingId ?? null,
      meta: enrichedMeta as never,
    }]);
  } catch (err) {
    // swallow — tracking must never break UX
    console.debug('trackClick failed', err);
  }
};

/** Push accumulated seconds for the current route. Upserts per admin+route+day. */
export const pushSectionTime = async (route: string, seconds: number) => {
  if (!cachedAdminId || seconds <= 0) return;
  try {
    const today = new Date();
    const day = today.toISOString().slice(0, 10);
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    // Try update first; if 0 rows then insert.
    const { data, error } = await supabase
      .from('admin_section_time')
      .select('id, seconds')
      .eq('admin_id', cachedAdminId)
      .eq('route', route)
      .eq('day', day)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      await supabase
        .from('admin_section_time')
        .update({ seconds: (data.seconds ?? 0) + seconds, updated_at: new Date().toISOString() })
        .eq('id', data.id);
    } else {
      await supabase.from('admin_section_time').insert([{
        admin_id: cachedAdminId,
        route,
        day,
        seconds,
        month_key: monthKey,
      }]);
    }
  } catch (err) {
    console.debug('pushSectionTime failed', err);
  }
};