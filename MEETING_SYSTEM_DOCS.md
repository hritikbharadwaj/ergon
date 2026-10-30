# Meeting Management System Documentation

## Overview

This is a comprehensive backend system for managing a reusable fixed Google Meet link for daily or recurring meetings. It provides:

- Single pre-generated Google Meet link reused infinitely
- Smart meeting status management (UPCOMING, LIVE, ENDED, OFFLINE)
- Admin controls to manually toggle meeting status
- Automatic status calculation based on scheduled times
- Meeting activity logging and statistics
- Real-time meeting popup widget for users
- No external API dependencies (no Google OAuth, Calendar API, etc.)

## Architecture

### Database Schema

#### `meeting_settings` table
Stores configuration for each meeting room:
- `id`: UUID primary key
- `room_name`: Unique identifier (e.g., "Daily Standup")
- `meet_link`: The Google Meet link (e.g., "https://meet.google.com/kwk-asxu-rqp")
- `title`: Display title
- `description`: Optional description
- `start_time`: Scheduled start time (HH:MM:SS format)
- `end_time`: Scheduled end time (HH:MM:SS format)
- `recurrence_type`: 'daily' or 'custom'
- `recurrence_date`: For custom recurrence, specific date (YYYY-MM-DD)
- `manual_status`: 'LIVE', 'OFFLINE', or NULL (auto-calculated if NULL)
- `timezone`: Timezone for time calculations (default: UTC)
- `created_at`, `updated_at`: Timestamps
- `created_by`: Admin user ID who created the meeting

#### `meeting_activity` table
Logs all meeting interactions:
- `id`: UUID primary key
- `room_id`: FK to meeting_settings
- `user_id`: User who performed the action
- `action`: 'joined', 'left', 'admin_started', 'admin_ended'
- `joined_at`: When user joined
- `left_at`: When user left (optional)
- `created_at`: Timestamp

#### `meeting_stats` table
Aggregated statistics per day:
- `id`: UUID primary key
- `room_id`: FK to meeting_settings
- `date`: The date (YYYY-MM-DD)
- `join_count`: Number of joins
- `last_joined_at`: Last join timestamp
- `last_joined_by_user_id`: User who last joined
- `created_at`, `updated_at`: Timestamps

### Service Layer

**MeetingService** (`src/services/MeetingService.ts`)

Core business logic for meeting management:

```typescript
// Get current meeting status with smart calculations
MeetingService.getMeetingInfo(roomName: string)

// Get all meeting rooms
MeetingService.getAllMeetings()

// Join a meeting (returns link only if LIVE)
MeetingService.joinMeeting(roomName: string, userId: string)

// Update meeting settings (admin only)
MeetingService.updateMeetingSettings(roomName: string, updates: UpdateMeetingRequest)

// Toggle meeting status (admin only)
MeetingService.toggleMeeting(roomName: string, action: 'start' | 'end')

// Get statistics for a specific date
MeetingService.getMeetingStats(roomName: string, date: string)

// Create new meeting room (admin only)
MeetingService.createMeeting(...)
```

#### Status Calculation Logic

Meeting status is calculated as follows:

1. If `manual_status` is set to 'LIVE' → return 'LIVE'
2. If `manual_status` is set to 'OFFLINE' → return 'OFFLINE'
3. Check if meeting applies today:
   - For 'daily': always applies
   - For 'custom': only if recurrence_date matches today
4. If meeting doesn't apply today → return 'OFFLINE'
5. Compare current time with scheduled times:
   - If current_time < start_time → 'UPCOMING'
   - If start_time ≤ current_time < end_time → 'LIVE'
   - If current_time ≥ end_time → 'ENDED'

### React Context

**MeetingContext** (`src/contexts/MeetingContext.tsx`)

Provides real-time meeting state across the app:

```typescript
const { currentMeeting, isLive, loading, refreshMeeting, toggleMeeting, meetingLink } = useMeeting()
```

Features:
- Auto-refresh every 10 seconds to catch status changes
- Manual refresh capability
- Toggle meeting status (admin)
- Provides meeting link only when LIVE

### Components

#### MeetingPopup (`src/components/MeetingPopup.tsx`)

Floating widget displayed when meeting is LIVE:
- Shows meeting title and description
- Displays "LIVE NOW" badge with pulsing indicator
- Join button opens Google Meet in new window
- Slides in from bottom-right
- Auto-dismisses after user joins or meeting ends
- Beautiful animations and hover effects

#### MeetingControlPanel (`src/components/MeetingControlPanel.tsx`)

Admin control panel for managing meetings:
- Start/End buttons to manually toggle status
- Display current meeting status with color coding
- Show scheduled times
- Display timezone
- Show current server time
- Refresh button to sync state
- Security info and status explanations

### API Layer

**API Handlers** (`src/api/meetingAPI.ts`)

All API functions with detailed documentation:

```typescript
// Get meeting info
async function getMeetingInfo(roomName: string): Promise<MeetingInfoResponse>

// Get all meetings
async function getAllMeetings(): Promise<MeetingInfoResponse[]>

// Join meeting
async function joinMeeting(roomName: string, userId: string): Promise<JoinMeetingResponse>

// Update meeting (admin)
async function updateMeetingSettings(roomName: string, updates: UpdateMeetingRequest): Promise<MeetingInfoResponse>

// Toggle meeting (admin)
async function toggleMeeting(roomName: string, action: 'start' | 'end'): Promise<MeetingInfoResponse>

// Get statistics
async function getMeetingStats(roomName: string, date: string): Promise<MeetingStatsResponse>

// Create meeting (admin)
async function createMeeting(request: CreateMeetingRequest): Promise<MeetingInfoResponse>
```

## API Endpoints Reference

### 1. Get Meeting Info
```
GET /api/meetings/:roomName
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "room_name": "Daily Standup",
  "title": "Daily Team Standup",
  "description": "Daily team sync and updates",
  "meet_link": "https://meet.google.com/kwk-asxu-rqp",
  "status": "LIVE",
  "start_time": "09:00:00",
  "end_time": "09:30:00",
  "timezone": "UTC",
  "current_time": "2024-03-31T09:15:00Z"
}
```

### 2. Get All Meetings
```
GET /api/meetings
```

**Response:** Array of MeetingInfoResponse objects

### 3. Join Meeting
```
POST /api/meetings/:roomName/join
Body: { "user_id": "uuid" }
```

**Success Response (if LIVE):**
```json
{
  "success": true,
  "status": "LIVE",
  "meet_link": "https://meet.google.com/kwk-asxu-rqp",
  "message": "Welcome to the meeting!"
}
```

**Failure Response (if not LIVE):**
```json
{
  "success": false,
  "status": "UPCOMING",
  "message": "Meeting is upcoming. Scheduled from 09:00:00 to 09:30:00",
  "scheduled_start": "09:00:00",
  "scheduled_end": "09:30:00"
}
```

### 4. Update Meeting Settings (Admin)
```
PUT /api/meetings/:roomName
Body: {
  "title": "New Title",
  "description": "New description",
  "start_time": "10:00:00",
  "end_time": "10:30:00",
  "recurrence_type": "daily",
  "timezone": "America/New_York"
}
```

**Response:** Updated MeetingInfoResponse

### 5. Toggle Meeting Status (Admin)
```
POST /api/meetings/:roomName/toggle
Body: { "action": "start" | "end" }
```

**Response:** Updated MeetingInfoResponse with new status

### 6. Get Meeting Statistics
```
GET /api/meetings/:roomName/stats?date=2024-03-31
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "room_id": "550e8400-e29b-41d4-a716-446655440001",
  "date": "2024-03-31",
  "join_count": 15,
  "last_joined_at": "2024-03-31T09:25:00Z",
  "visitors": [
    {
      "user_id": "user-id-1",
      "join_count": 3,
      "last_joined": "2024-03-31T09:25:00Z"
    },
    {
      "user_id": "user-id-2",
      "join_count": 2,
      "last_joined": "2024-03-31T09:20:00Z"
    }
  ]
}
```

### 7. Create New Meeting (Admin)
```
POST /api/meetings
Body: {
  "room_name": "Technical Sync",
  "meet_link": "https://meet.google.com/xyz-abc-def",
  "title": "Technical Sync",
  "description": "Tech team sync meeting",
  "start_time": "14:00:00",
  "end_time": "14:30:00",
  "recurrence_type": "daily",
  "timezone": "UTC"
}
```

**Response:** Created MeetingInfoResponse

## Usage Examples

### For End Users

**In any React component:**

```typescript
import { useMeeting } from '@/contexts/MeetingContext';

function MyComponent() {
  const { currentMeeting, isLive, meetingLink } = useMeeting();

  return (
    <div>
      <p>Status: {currentMeeting?.status}</p>
      {isLive && (
        <a href={meetingLink} target="_blank">
          Join Meeting
        </a>
      )}
    </div>
  );
}
```

### For Admins

**Controlling meetings:**

```typescript
import { useMeeting } from '@/contexts/MeetingContext';
import MeetingControlPanel from '@/components/MeetingControlPanel';

function AdminDashboard() {
  return <MeetingControlPanel />;
}
```

### For Custom Integrations

**Using the API:**

```typescript
import { getMeetingInfo, joinMeeting, toggleMeeting } from '@/api/meetingAPI';

// Check meeting status
const meeting = await getMeetingInfo('Daily Standup');

// Join meeting
const result = await joinMeeting('Daily Standup', userId);
if (result.success) {
  window.open(result.meet_link);
}

// Start meeting (admin only)
await toggleMeeting('Daily Standup', 'start');
```

## Security Features

1. **Row-Level Security (RLS)**
   - Public can view meeting settings
   - Only super_admin can update settings
   - Users can only view their own activity
   - Super admin can view all activity

2. **Admin-Only Actions**
   - Updating meeting configuration
   - Toggling meeting status
   - Creating new meeting rooms
   - Viewing comprehensive statistics

3. **Input Validation**
   - Times in HH:MM:SS format
   - Dates in YYYY-MM-DD format
   - Recurrence type validation
   - Timezone validation

## Features

✓ Single reusable Google Meet link  
✓ Infinite reuse across all meetings  
✓ Smart automatic status calculation  
✓ Manual admin status override  
✓ Scheduled time-based activation  
✓ Daily recurring meetings  
✓ Custom date-specific meetings  
✓ Meeting activity logging  
✓ Join statistics and tracking  
✓ Per-user join count tracking  
✓ Real-time status updates (10s polling)  
✓ Beautiful popup notification widget  
✓ Admin control panel  
✓ Timezone support  
✓ No external API dependencies  
✓ Row-level security  
✓ Comprehensive activity logging  

## Pro Features Implemented

✓ Join Count tracking  
✓ Last Joined timestamp  
✓ Per-user join count  
✓ Activity logging (joined, left, admin_started, admin_ended)  
✓ Multiple meeting rooms support  
✓ Each room has its own fixed Meet link  

## Implementation Checklist

- [x] Database migration with RLS policies
- [x] TypeScript types and interfaces
- [x] MeetingService with all business logic
- [x] React Context for state management
- [x] MeetingPopup widget component
- [x] MeetingControlPanel admin component
- [x] API handlers with documentation
- [x] Real-time updates via polling
- [x] Activity logging
- [x] Statistics tracking
- [x] Multiple room support

## Environment Variables

No special environment variables required. The system uses:
- `VITE_SUPABASE_URL` (existing)
- `VITE_SUPABASE_ANON_KEY` (existing)

## Performance Considerations

- Status recalculated every 10 seconds via polling
- Indexes on frequently queried columns
- Connection pooling via Supabase
- Efficient activity aggregation in stats endpoint
- Real-time updates use context + polling (can be upgraded to WebSocket subscriptions)

## Future Enhancements

1. WebSocket subscriptions for real-time updates (replace polling)
2. Meeting recording links integration
3. Meeting chat/notes integration
4. Email notifications for meeting start
5. Calendar integration
6. Multiple timezone support in UI
7. Meeting history/archives
8. Export statistics to CSV
9. Meeting templates
10. Advanced scheduling with recurring patterns (every N days, weekly on specific days, etc.)

## Testing the System

1. **Start a meeting:**
   ```typescript
   const { toggleMeeting } = useMeeting();
   await toggleMeeting('Daily Standup', 'start');
   ```

2. **Check status:**
   ```typescript
   const meeting = await getMeetingInfo('Daily Standup');
   console.log(meeting.status); // Should be 'LIVE'
   ```

3. **Join meeting:**
   ```typescript
   const result = await joinMeeting('Daily Standup', userId);
   if (result.success) {
     console.log(result.meet_link); // Google Meet link
   }
   ```

4. **End meeting:**
   ```typescript
   await toggleMeeting('Daily Standup', 'end');
   ```

5. **Check statistics:**
   ```typescript
   const stats = await getMeetingStats('Daily Standup', '2024-03-31');
   console.log(stats.join_count); // Number of joins today
   ```

## Troubleshooting

**Popup not showing?**
- Ensure MeetingProvider wraps your entire app
- Check that the meeting is actually LIVE
- Verify browser console for errors

**Status not updating?**
- The system polls every 10 seconds
- Manual refresh available via `refreshMeeting()`
- Check server time vs local time

**Can't join meeting?**
- Meeting must be in LIVE status
- Check scheduled times and timezone
- Verify super_admin can manually start meeting

**RLS policy errors?**
- Ensure you're authenticated
- Check that your user role is 'super_admin' for admin actions
- Review RLS policies in migration

---

**Default Meeting:** Daily Standup  
**Default Meet Link:** https://meet.google.com/kwk-asxu-rqp  
**Default Time:** 09:00 - 09:30 UTC  
**Recurrence:** Daily
