// Meeting status types
export type MeetingStatus = 'UPCOMING' | 'LIVE' | 'ENDED' | 'OFFLINE';
export type RecurrenceType = 'daily' | 'custom';
export type ActivityAction = 'joined' | 'left' | 'admin_started' | 'admin_ended';

// Database models
export interface MeetingSettings {
  id: string;
  room_name: string;
  meet_link: string;
  title: string;
  description?: string;
  start_time: string; // HH:MM:SS format
  end_time: string; // HH:MM:SS format
  recurrence_type: RecurrenceType;
  recurrence_date?: string; // YYYY-MM-DD format
  manual_status?: 'LIVE' | 'OFFLINE' | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface MeetingActivity {
  id: string;
  room_id: string;
  user_id: string;
  action: ActivityAction;
  joined_at?: string;
  left_at?: string;
  created_at: string;
}

export interface MeetingStats {
  id: string;
  room_id: string;
  date: string; // YYYY-MM-DD
  join_count: number;
  last_joined_at?: string;
  last_joined_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface MeetingInfoResponse {
  id: string;
  room_name: string;
  title: string;
  description?: string;
  meet_link?: string; // Only included if status is LIVE
  status: MeetingStatus;
  start_time: string;
  end_time: string;
  timezone: string;
  current_time: string;
  next_meeting_date?: string;
}

export interface JoinMeetingResponse {
  success: boolean;
  status: MeetingStatus;
  meet_link?: string;
  message: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface UpdateMeetingRequest {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  recurrence_type?: RecurrenceType;
  recurrence_date?: string;
  timezone?: string;
}

export interface ToggleMeetingRequest {
  action: 'start' | 'end';
}

export interface MeetingStatsResponse {
  id: string;
  room_id: string;
  date: string;
  join_count: number;
  last_joined_at?: string;
  visitors: Array<{
    user_id: string;
    join_count: number;
    last_joined: string;
  }>;
}

export interface CreateMeetingRequest {
  room_name: string;
  meet_link: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  recurrence_type: RecurrenceType;
  recurrence_date?: string;
  timezone?: string;
}
