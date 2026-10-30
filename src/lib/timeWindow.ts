import { supabase } from '@/integrations/supabase/client';

/** IST time-window helpers for the checkout / work-log flow. Defaults are used until Super Admin settings load. */

let checkInStart = '06:00';
let presentUntil = '11:00';
let lateUntil = '17:00';
let attendanceClose = '23:59';
let checkoutStart = '21:30';
let checkoutEnd = '23:59';
let worklogStart = '21:30';
let worklogEnd = '23:59';

const norm = (v?: string | null, fallback = '00:00') => (v ? String(v).slice(0, 5) : fallback);

export const loadTimeWindowSettings = async () => {
  const { data } = await supabase
    .from('attendance_settings' as any)
    .select('check_in_start, present_until, late_until, attendance_close, checkout_start, checkout_end, worklog_start, worklog_end')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data) {
    const d = data as any;
    checkInStart = norm(d.check_in_start, checkInStart);
    presentUntil = norm(d.present_until, presentUntil);
    lateUntil = norm(d.late_until, lateUntil);
    attendanceClose = norm(d.attendance_close, attendanceClose);
    checkoutStart = norm(d.checkout_start, checkoutStart);
    checkoutEnd = norm(d.checkout_end, checkoutEnd);
    worklogStart = norm(d.worklog_start, worklogStart);
    worklogEnd = norm(d.worklog_end, worklogEnd);
    version += 1;
    try { window.dispatchEvent(new CustomEvent('time-windows-updated', { detail: { version } })); } catch {}
  }
};

/** Monotonic counter bumped every time Super Admin settings reload. Components can key off this to re-render. */
export let version = 0;
export const getTimeWindowVersion = () => version;

/** Subscribe once — updates propagate live when Super Admin edits Time Management. */
let subscribed = false;
export const subscribeTimeWindowSettings = () => {
  if (subscribed) return;
  subscribed = true;
  supabase.channel('attendance_settings_watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_settings' }, () => {
      loadTimeWindowSettings();
    })
    .subscribe();
};

const fmt12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${suffix}`;
};

export const getWorkLogWindow = () => ({ start: worklogStart, end: worklogEnd });
export const getCheckoutWindow = () => ({ start: checkoutStart, end: checkoutEnd });
export const getCheckInWindow = () => ({ start: checkInStart, end: attendanceClose });
export const getPresentUntil = () => presentUntil;
export const getLateUntil = () => lateUntil;

export const workLogWindowLabel = () => `${fmt12(worklogStart)} – ${fmt12(worklogEnd)} IST`;
export const checkoutWindowLabel = () => `${fmt12(checkoutStart)} – ${fmt12(checkoutEnd)} IST`;
export const checkInWindowLabel = () => `${fmt12(checkInStart)} – ${fmt12(presentUntil)} IST`;

export const getIndiaNow = (): Date =>
  new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

const toMinutes = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Checkout/work-log window from Super Admin settings. */
export const isCheckoutWindow = (now: Date = getIndiaNow()): boolean => {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(worklogStart);
  const end = toMinutes(worklogEnd);
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
};

export const minutesUntilCheckout = (now: Date = getIndiaNow()): number => {
  if (isCheckoutWindow(now)) return 0;
  const target = new Date(now);
  const [h, m] = worklogStart.split(':').map(Number);
  target.setHours(h || 21, m || 30, 0, 0);
  if (target.getTime() < now.getTime()) target.setDate(target.getDate() + 1);
  return Math.round((target.getTime() - now.getTime()) / 60000);
};

export const formatIST = (d: Date = getIndiaNow()): string =>
  d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });