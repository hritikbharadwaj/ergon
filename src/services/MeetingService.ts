import { supabase } from '@/integrations/supabase/client';
import {
  MeetingSettings,
  MeetingStatus,
  MeetingInfoResponse,
  JoinMeetingResponse,
  UpdateMeetingRequest,
  MeetingActivity,
  ActivityAction,
  MeetingStats,
  MeetingStatsResponse,
} from '@/types/meeting';

// Helper to query tables not in generated types
const fromTable = (table: string) => supabase.from(table as any);

class MeetingService {
  /**
   * Validates whether a provided meeting link is a valid web URL (e.g. Google Meet, Zoom, Teams)
   */
  static isValidMeetingUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Normalizes a meeting link with https:// if omitted
   */
  static normalizeMeetingUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  static calculateStatus(meeting: MeetingSettings, currentTime: Date): MeetingStatus {
    if (meeting.manual_status === 'OFFLINE') return 'OFFLINE';
    if (meeting.manual_status === 'LIVE') return 'LIVE';

    const today = currentTime.toISOString().split('T')[0];
    if (!this.doesMeetingApplyToday(meeting, today)) return 'OFFLINE';

    const [startHour, startMin, startSec] = meeting.start_time.split(':').map(Number);
    const [endHour, endMin, endSec] = meeting.end_time.split(':').map(Number);

    const startDate = new Date(currentTime);
    startDate.setHours(startHour, startMin, startSec, 0);
    const endDate = new Date(currentTime);
    endDate.setHours(endHour, endMin, endSec, 0);

    if (currentTime < startDate) return 'UPCOMING';
    if (currentTime >= startDate && currentTime < endDate) return 'LIVE';
    return 'ENDED';
  }

  static doesMeetingApplyToday(meeting: MeetingSettings, today: string): boolean {
    if (meeting.recurrence_type === 'daily') return true;
    if (meeting.recurrence_type === 'custom' && meeting.recurrence_date) return meeting.recurrence_date === today;
    return false;
  }

  static async getMeetingInfo(roomName: string): Promise<MeetingInfoResponse | null> {
    try {
      const { data: meeting, error } = await (fromTable('meeting_settings')
        .select('*').eq('room_name', roomName).single() as any);
      if (error || !meeting) return null;

      const currentTime = new Date();
      const status = this.calculateStatus(meeting as MeetingSettings, currentTime);
      const response: MeetingInfoResponse = {
        id: meeting.id, room_name: meeting.room_name, title: meeting.title,
        description: meeting.description, status, start_time: meeting.start_time,
        end_time: meeting.end_time, timezone: meeting.timezone,
        current_time: currentTime.toISOString(),
      };
      if (status === 'LIVE') response.meet_link = meeting.meet_link;
      return response;
    } catch (error) { console.error('Error getting meeting info:', error); return null; }
  }

  static async getAllMeetings(): Promise<MeetingInfoResponse[]> {
    try {
      const { data: meetings, error } = await (fromTable('meeting_settings')
        .select('*').order('created_at', { ascending: true }) as any);
      if (error || !meetings) return [];

      const currentTime = new Date();
      return meetings.map((meeting: any) => {
        const status = this.calculateStatus(meeting, currentTime);
        const response: MeetingInfoResponse = {
          id: meeting.id, room_name: meeting.room_name, title: meeting.title,
          description: meeting.description, status, start_time: meeting.start_time,
          end_time: meeting.end_time, timezone: meeting.timezone,
          current_time: currentTime.toISOString(),
        };
        if (status === 'LIVE') response.meet_link = meeting.meet_link;
        return response;
      });
    } catch (error) { console.error('Error getting all meetings:', error); return []; }
  }

  static async joinMeeting(roomName: string, userId: string): Promise<JoinMeetingResponse> {
    try {
      const meetingInfo = await this.getMeetingInfo(roomName);
      if (!meetingInfo) return { success: false, status: 'OFFLINE', message: 'Meeting not found' };

      await this.logActivity(meetingInfo.id, userId, 'joined');
      await this.updateStats(meetingInfo.id, userId);

      if (meetingInfo.status === 'LIVE') {
        return { success: true, status: 'LIVE', meet_link: meetingInfo.meet_link, message: 'Welcome to the meeting!' };
      }
      return {
        success: false, status: meetingInfo.status,
        message: `Meeting is ${meetingInfo.status.toLowerCase()}. Scheduled from ${meetingInfo.start_time} to ${meetingInfo.end_time}`,
        scheduled_start: meetingInfo.start_time, scheduled_end: meetingInfo.end_time,
      };
    } catch (error) { return { success: false, status: 'OFFLINE', message: 'Error joining meeting' }; }
  }

  static async leaveMeeting(roomName: string, userId: string): Promise<void> {
    try {
      const meetingInfo = await this.getMeetingInfo(roomName);
      if (!meetingInfo) return;
      await this.logActivity(meetingInfo.id, userId, 'left');
    } catch (error) { console.error('Error leaving meeting:', error); }
  }

  static async updateMeetingSettings(roomName: string, updates: UpdateMeetingRequest): Promise<boolean> {
    try {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (updates.meet_link !== undefined) {
        updateData.meet_link = this.normalizeMeetingUrl(updates.meet_link);
      }
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.start_time !== undefined) updateData.start_time = updates.start_time;
      if (updates.end_time !== undefined) updateData.end_time = updates.end_time;
      if (updates.recurrence_type !== undefined) updateData.recurrence_type = updates.recurrence_type;
      if (updates.recurrence_date !== undefined) updateData.recurrence_date = updates.recurrence_date;
      if (updates.manual_status !== undefined) updateData.manual_status = updates.manual_status;
      if (updates.timezone !== undefined) updateData.timezone = updates.timezone;

      const { error } = await (fromTable('meeting_settings')
        .update(updateData).eq('room_name', roomName) as any);
      return !error;
    } catch (error) { console.error('Error updating meeting settings:', error); return false; }
  }

  static async setManualStatus(roomName: string, status: 'LIVE' | 'OFFLINE' | null, adminUserId: string): Promise<boolean> {
    try {
      const meetingInfo = await this.getMeetingInfo(roomName);
      if (!meetingInfo) return false;

      const success = await this.updateMeetingSettings(roomName, { manual_status: status });
      if (!success) return false;

      if (status === 'LIVE') {
        await this.logActivity(meetingInfo.id, adminUserId, 'admin_started');
        await this.startMeetingSession(meetingInfo.id, adminUserId);
      } else if (status === 'OFFLINE') {
        await this.logActivity(meetingInfo.id, adminUserId, 'admin_ended');
        await this.endMeetingSession(meetingInfo.id);
      }
      return true;
    } catch (error) { console.error('Error setting manual status:', error); return false; }
  }

  private static async startMeetingSession(roomId: string, adminUserId: string): Promise<void> {
    try {
      await (fromTable('meeting_sessions').insert({
        room_id: roomId, started_by: adminUserId, started_at: new Date().toISOString(),
      }) as any);
    } catch (error) { console.error('Error starting meeting session:', error); }
  }

  private static async endMeetingSession(roomId: string): Promise<void> {
    try {
      const { data: session } = await (fromTable('meeting_sessions')
        .select('*').eq('room_id', roomId).is('ended_at', null)
        .order('started_at', { ascending: false }).limit(1).single() as any);
      if (!session) return;
      await (fromTable('meeting_sessions').update({ ended_at: new Date().toISOString() }).eq('id', session.id) as any);
    } catch (error) { console.error('Error ending meeting session:', error); }
  }

  private static async logActivity(roomId: string, userId: string, action: ActivityAction): Promise<void> {
    try {
      const activityData: any = { room_id: roomId, user_id: userId, action };
      if (action === 'joined') activityData.joined_at = new Date().toISOString();
      if (action === 'left') activityData.left_at = new Date().toISOString();
      await (fromTable('meeting_activities').insert(activityData) as any);
    } catch (error) { console.error('Error logging meeting activity:', error); }
  }

  private static async updateStats(roomId: string, userId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const { data: existing } = await (fromTable('meeting_stats')
        .select('*').eq('room_id', roomId).eq('date', today).single() as any);

      if (existing) {
        await (fromTable('meeting_stats').update({
          join_count: existing.join_count + 1, last_joined_at: now,
          last_joined_by_user_id: userId, updated_at: now,
        }).eq('id', existing.id) as any);
      } else {
        await (fromTable('meeting_stats').insert({
          room_id: roomId, date: today, join_count: 1, last_joined_at: now,
          last_joined_by_user_id: userId, created_at: now, updated_at: now,
        }) as any);
      }
    } catch (error) { console.error('Error updating meeting stats:', error); }
  }

  static async getMeetingStats(roomName: string, date?: string): Promise<MeetingStatsResponse | null> {
    try {
      const queryDate = date || new Date().toISOString().split('T')[0];
      const { data: meeting } = await (fromTable('meeting_settings')
        .select('id').eq('room_name', roomName).single() as any);
      if (!meeting) return null;

      const { data: stats } = await (fromTable('meeting_stats')
        .select('*').eq('room_id', meeting.id).eq('date', queryDate).single() as any);
      if (!stats) return null;

      const { data: activities } = await (fromTable('meeting_activities')
        .select('user_id, action, created_at').eq('room_id', meeting.id)
        .gte('created_at', `${queryDate}T00:00:00`).lte('created_at', `${queryDate}T23:59:59`) as any);

      const visitorMap = new Map<string, { user_id: string; join_count: number; last_joined: string }>();
      (activities || []).filter((a: any) => a.action === 'joined').forEach((a: any) => {
        if (!visitorMap.has(a.user_id)) {
          visitorMap.set(a.user_id, { user_id: a.user_id, join_count: 0, last_joined: a.created_at });
        }
        const v = visitorMap.get(a.user_id)!;
        v.join_count += 1; v.last_joined = a.created_at;
      });

      return {
        id: stats.id, room_id: stats.room_id, date: stats.date,
        join_count: stats.join_count, last_joined_at: stats.last_joined_at,
        visitors: Array.from(visitorMap.values()),
      };
    } catch (error) { return null; }
  }

  static async getMeetingSessions(roomName: string, date: string): Promise<any[]> {
    try {
      const { data: meeting } = await (fromTable('meeting_settings')
        .select('id').eq('room_name', roomName).single() as any);
      if (!meeting) return [];

      const { data: sessions } = await (fromTable('meeting_sessions')
        .select('*').eq('room_id', meeting.id)
        .gte('started_at', `${date}T00:00:00`).lte('started_at', `${date}T23:59:59`)
        .order('started_at', { ascending: false }) as any);
      return sessions || [];
    } catch (error) { return []; }
  }

  static async createMeeting(
    roomName: string, meetLink: string, title: string, description: string = '',
    startTime: string = '09:00:00', endTime: string = '09:30:00',
    recurrenceType: 'daily' | 'custom' = 'daily', recurrenceDate?: string, timezone: string = 'UTC'
  ): Promise<MeetingSettings | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      const normalizedLink = this.normalizeMeetingUrl(meetLink);
      const { data: newMeeting, error } = await (fromTable('meeting_settings').insert({
        room_name: roomName, meet_link: normalizedLink, title, description,
        start_time: startTime, end_time: endTime, recurrence_type: recurrenceType,
        recurrence_date: recurrenceDate, timezone, created_by: user.user?.id,
      }).select().single() as any);
      if (error) return null;
      return newMeeting as MeetingSettings;
    } catch (error) { return null; }
  }
}

export default MeetingService;
