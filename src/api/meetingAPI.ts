/**
 * Meeting API Handlers
 * These would typically be Supabase Edge Functions or API routes
 * For this implementation, we'll create client-side handlers that call the service
 */

import MeetingService from '@/services/MeetingService';
import {
  MeetingInfoResponse,
  JoinMeetingResponse,
  UpdateMeetingRequest,
  MeetingStatsResponse,
  CreateMeetingRequest,
} from '@/types/meeting';

/**
 * GET /api/meetings/:roomName
 * Get meeting info with current status
 */
export async function getMeetingInfo(roomName: string): Promise<MeetingInfoResponse | null> {
  return MeetingService.getMeetingInfo(roomName);
}

/**
 * GET /api/meetings
 * Get all meeting rooms
 */
export async function getAllMeetings(): Promise<MeetingInfoResponse[]> {
  return MeetingService.getAllMeetings();
}

/**
 * POST /api/meetings/:roomName/join
 * Join a meeting
 * Requires: userId in body
 */
export async function joinMeeting(roomName: string, userId: string): Promise<JoinMeetingResponse> {
  return MeetingService.joinMeeting(roomName, userId);
}

/**
 * PUT /api/meetings/:roomName
 * Update meeting settings (admin only)
 * Requires: super_admin role
 */
export async function updateMeetingSettings(
  roomName: string,
  updates: UpdateMeetingRequest
): Promise<MeetingInfoResponse | null> {
  // Check admin role would be done via RLS in production
  const updated = await MeetingService.updateMeetingSettings(roomName, updates);
  if (!updated) return null;

  return MeetingService.getMeetingInfo(roomName);
}

/**
 * POST /api/meetings/:roomName/toggle
 * Toggle meeting status (admin only)
 * Requires: super_admin role
 * Body: { action: 'start' | 'end' }
 */
export async function toggleMeeting(
  roomName: string,
  action: 'start' | 'end'
): Promise<MeetingInfoResponse | null> {
  // Check admin role would be done via RLS in production
  const toggled = await MeetingService.toggleMeeting(roomName, action);
  if (!toggled) return null;

  return MeetingService.getMeetingInfo(roomName);
}

/**
 * GET /api/meetings/:roomName/stats?date=YYYY-MM-DD
 * Get meeting statistics for a specific date
 */
export async function getMeetingStats(
  roomName: string,
  date: string
): Promise<MeetingStatsResponse | null> {
  return MeetingService.getMeetingStats(roomName, date);
}

/**
 * POST /api/meetings
 * Create a new meeting room (admin only)
 * Requires: super_admin role
 */
export async function createMeeting(
  request: CreateMeetingRequest
): Promise<MeetingInfoResponse | null> {
  // Check admin role would be done via RLS in production
  const created = await MeetingService.createMeeting(
    request.room_name,
    request.meet_link,
    request.title,
    request.description,
    request.start_time,
    request.end_time,
    request.recurrence_type,
    request.recurrence_date,
    request.timezone
  );

  if (!created) return null;

  return MeetingService.getMeetingInfo(request.room_name);
}

/**
 * API Endpoints Documentation
 *
 * 1. GET /api/meetings/:roomName
 *    Description: Get meeting info with current status
 *    Response:
 *    {
 *      "id": "uuid",
 *      "room_name": "Daily Standup",
 *      "title": "Daily Team Standup",
 *      "description": "Daily team sync",
 *      "meet_link": "https://meet.google.com/..." (only if LIVE),
 *      "status": "LIVE" | "UPCOMING" | "ENDED" | "OFFLINE",
 *      "start_time": "09:00:00",
 *      "end_time": "09:30:00",
 *      "timezone": "UTC",
 *      "current_time": "2024-03-31T09:15:00Z"
 *    }
 *
 * 2. GET /api/meetings
 *    Description: Get all meeting rooms
 *    Response: Array of MeetingInfoResponse
 *
 * 3. POST /api/meetings/:roomName/join
 *    Description: Join a meeting
 *    Body: { "user_id": "uuid" }
 *    Response:
 *    {
 *      "success": true | false,
 *      "status": "LIVE" | "UPCOMING" | "ENDED" | "OFFLINE",
 *      "meet_link": "https://meet.google.com/..." (only if success),
 *      "message": "Welcome to the meeting!" | "Meeting is offline...",
 *      "scheduled_start": "09:00:00",
 *      "scheduled_end": "09:30:00"
 *    }
 *
 * 4. PUT /api/meetings/:roomName
 *    Description: Update meeting settings (admin only)
 *    Body:
 *    {
 *      "title": "New Title",
 *      "description": "New description",
 *      "start_time": "10:00:00",
 *      "end_time": "10:30:00",
 *      "recurrence_type": "daily" | "custom",
 *      "recurrence_date": "2024-04-01" (for custom),
 *      "timezone": "America/New_York"
 *    }
 *    Response: Updated MeetingInfoResponse
 *
 * 5. POST /api/meetings/:roomName/toggle
 *    Description: Toggle meeting status (admin only)
 *    Body: { "action": "start" | "end" }
 *    Response: Updated MeetingInfoResponse with status
 *
 * 6. GET /api/meetings/:roomName/stats?date=2024-03-31
 *    Description: Get meeting statistics for a specific date
 *    Response:
 *    {
 *      "id": "uuid",
 *      "room_id": "uuid",
 *      "date": "2024-03-31",
 *      "join_count": 5,
 *      "last_joined_at": "2024-03-31T09:25:00Z",
 *      "visitors": [
 *        {
 *          "user_id": "uuid",
 *          "join_count": 2,
 *          "last_joined": "2024-03-31T09:25:00Z"
 *        }
 *      ]
 *    }
 *
 * 7. POST /api/meetings
 *    Description: Create a new meeting room (admin only)
 *    Body:
 *    {
 *      "room_name": "Technical Sync",
 *      "meet_link": "https://meet.google.com/xyz",
 *      "title": "Technical Sync",
 *      "description": "Tech team sync",
 *      "start_time": "14:00:00",
 *      "end_time": "14:30:00",
 *      "recurrence_type": "daily",
 *      "timezone": "UTC"
 *    }
 *    Response: Created MeetingInfoResponse
 *
 * Error Responses (common across all endpoints):
 * {
 *   "success": false,
 *   "message": "Error description",
 *   "status": 400 | 401 | 403 | 404 | 500
 * }
 *
 * Status Codes:
 * - 200: Success
 * - 400: Bad Request (validation error)
 * - 401: Unauthorized (not logged in)
 * - 403: Forbidden (not admin)
 * - 404: Not Found
 * - 500: Server Error
 */
