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

  static async updateMeetingSettings(roomName: string, updates: UpdateMeetingRequest): Promise<MeetingSettings | null> {
    try {
      const { data: updated, error } = await (fromTable('meeting_settings')
        .update(updates).eq('room_name', roomName).select().single() as any);
      if (error) return null;
      return updated as MeetingSettings;
    } catch (error) { return null; }
  }

  static async toggleMeeting(roomName: string, action: 'start' | 'end'): Promise<MeetingSettings | null> {
    try {
      const manualStatus = action === 'start' ? 'LIVE' : 'OFFLINE';
      const { data: meeting, error: fetchError } = await (fromTable('meeting_settings')
        .select('id').eq('room_name', roomName).single() as any);
      if (fetchError || !meeting) return null;

      const actionType = action === 'start' ? 'admin_started' : 'admin_ended';
      const { data: user } = await supabase.auth.getUser();
      if (user.user) {
        await this.logActivity(meeting.id, user.user.id, actionType as ActivityAction);
        if (action === 'start') {
          await (fromTable('meeting_sessions').insert({
            room_id: meeting.id, started_at: new Date().toISOString(), started_by_user_id: user.user.id,
          }) as any);
        } else if (action === 'end') {
          const { data: lastSession } = await (fromTable('meeting_sessions')
            .select('id').eq('room_id', meeting.id).is('ended_at', null)
            .order('started_at', { ascending: false }).limit(1).single() as any);
          if (lastSession) {
            await (fromTable('meeting_sessions').update({ ended_at: new Date().toISOString() }).eq('id', lastSession.id) as any);
          }
        }
      }

      const { data: updated, error: updateError } = await (fromTable('meeting_settings')
        .update({ manual_status: manualStatus }).eq('room_name', roomName).select().single() as any);
      if (updateError) return null;
      return updated as MeetingSettings;
    } catch (error) { return null; }
  }

  private static async logActivity(roomId: string, userId: string, action: ActivityAction): Promise<void> {
    try {
      await (fromTable('meeting_activity').insert({
        room_id: roomId, user_id: userId, action,
        joined_at: action === 'joined' ? new Date().toISOString() : undefined,
      }) as any);
    } catch (error) { console.error('Error logging activity:', error); }
  }

  private static async updateStats(roomId: string, userId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existingStats } = await (fromTable('meeting_stats')
        .select('*').eq('room_id', roomId).eq('date', today).single() as any);

      if (existingStats) {
        await (fromTable('meeting_stats').update({
          join_count: (existingStats.join_count || 0) + 1,
          last_joined_at: new Date().toISOString(), last_joined_by_user_id: userId,
        }).eq('id', existingStats.id) as any);
      } else {
        await (fromTable('meeting_stats').insert({
          room_id: roomId, date: today, join_count: 1,
          last_joined_at: new Date().toISOString(), last_joined_by_user_id: userId,
        }) as any);
      }
    } catch (error) { console.error('Error updating stats:', error); }
  }

  static async getMeetingStats(roomName: string, date: string): Promise<MeetingStatsResponse | null> {
    try {
      const { data: meeting } = await (fromTable('meeting_settings')
        .select('id').eq('room_name', roomName).single() as any);
      if (!meeting) return null;

      const { data: stats } = await (fromTable('meeting_stats')
        .select('*').eq('room_id', meeting.id).eq('date', date).single() as any);
      if (!stats) return null;

      const { data: activities } = await (fromTable('meeting_activity')
        .select('user_id, created_at').eq('room_id', meeting.id).eq('action', 'joined')
        .gte('created_at', `${date}T00:00:00`).lt('created_at', `${date}T23:59:59`) as any);

      const visitorMap = new Map<string, { user_id: string; join_count: number; last_joined: string }>();
      (activities || []).forEach((a: any) => {
        if (!visitorMap.has(a.user_id)) visitorMap.set(a.user_id, { user_id: a.user_id, join_count: 0, last_joined: a.created_at });
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
      const { data: newMeeting, error } = await (fromTable('meeting_settings').insert({
        room_name: roomName, meet_link: meetLink, title, description,
        start_time: startTime, end_time: endTime, recurrence_type: recurrenceType,
        recurrence_date: recurrenceDate, timezone, created_by: user.user?.id,
      }).select().single() as any);
      if (error) return null;
      return newMeeting as MeetingSettings;
    } catch (error) { return null; }
  }
}

export default MeetingService;
