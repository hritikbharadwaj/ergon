# Meeting System Configuration

## Google Meet Link Configuration

```typescript
// Default Meeting Link (fixed, reusable)
const MEET_LINK = 'https://meet.google.com/kwk-asxu-rqp';

// This link is used for all meeting sessions
// It never changes and can be reused infinitely
```

## Database Schema Setup

The migrations file at `supabase/migrations/20240331000001_create_meeting_system.sql` contains:

1. **meeting_settings table** - Stores meeting configuration
2. **meeting_activity table** - Logs all user interactions
3. **meeting_stats table** - Aggregated statistics
4. **RLS Policies** - Security controls
5. **Triggers & Functions** - Auto-update timestamps

## Default Configuration

The migration inserts a default "Daily Standup" meeting:

```sql
INSERT INTO public.meeting_settings (
  room_name,
  meet_link,
  title,
  description,
  start_time,
  end_time,
  recurrence_type,
  timezone
) VALUES (
  'Daily Standup',
  'https://meet.google.com/kwk-asxu-rqp',
  'Daily Team Standup',
  'Daily team sync and updates',
  '09:00:00',
  '09:30:00',
  'daily',
  'UTC'
);
```

## How to Update Configuration

### Change Meet Link

```typescript
// In MeetingService.ts or via API
await supabase
  .from('meeting_settings')
  .update({ meet_link: 'https://meet.google.com/new-link' })
  .eq('room_name', 'Daily Standup');
```

### Change Meeting Time

```typescript
await supabase
  .from('meeting_settings')
  .update({
    start_time: '10:00:00',
    end_time: '10:30:00'
  })
  .eq('room_name', 'Daily Standup');
```

### Change Timezone

```typescript
await supabase
  .from('meeting_settings')
  .update({ timezone: 'America/New_York' })
  .eq('room_name', 'Daily Standup');
```

### Create New Meeting Room

```typescript
await MeetingService.createMeeting(
  'Technical Sync',  // room_name
  'https://meet.google.com/xyz-abc-def',  // meet_link
  'Tech Team Sync',  // title
  'Weekly technical discussion',  // description
  '14:00:00',  // start_time
  '14:30:00',  // end_time
  'daily',  // recurrence_type
  undefined,  // recurrence_date
  'UTC'  // timezone
);
```

## Status Logic Flowchart

```
┌─────────────────────────────────────────────────┐
│ Check Manual Status Override                     │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────▼─────────┐
        │ Is OFFLINE set?   │
        │ (manual_status)   │
        └────────┬──────────┘
              Yes│ return OFFLINE
                 │
        ┌────────▼──────────┐
        │ Is LIVE set?      │
        │ (manual_status)   │
        └────────┬──────────┘
              Yes│ return LIVE
                 │
        ┌────────▼──────────────────────────┐
        │ Does meeting apply today?          │
        │ Check recurrence_type & date       │
        └────────┬───────────────────────────┘
              No │ return OFFLINE
                 │
        ┌────────▼───────────────────────────┐
        │ Compare current time with          │
        │ start_time and end_time            │
        └────────┬────────────────────────────┘
                 │
        ┌────────▼────────┬────────────┬────────────┐
        │                 │            │            │
      Now<Start        Start≤Now<End  Now≥End
        │                 │            │
      UPCOMING          LIVE         ENDED
```

## Polling Interval

The system polls for status updates every 10 seconds via the MeetingContext.

If you need more frequent updates, modify:

```typescript
// In MeetingContext.tsx line ~50
useEffect(() => {
  const interval = setInterval(refreshMeeting, 10000); // Change 10000ms (10s) to desired interval
  return () => clearInterval(interval);
}, [refreshMeeting]);
```

Recommended intervals:
- **Production:** 10-30 seconds (balances responsiveness and server load)
- **High-frequency:** 5 seconds (for critical meetings)
- **WebSocket:** Real-time (future enhancement)

## Admin Control Panel Access

Add the MeetingControlPanel to any admin page:

```typescript
import MeetingControlPanel from '@/components/MeetingControlPanel';

function AdminDashboard() {
  return (
    <div className="p-6">
      <MeetingControlPanel
        onStatusChange={(status) => {
          console.log('Meeting status changed to:', status);
          // Trigger notifications, etc.
        }}
      />
    </div>
  );
}
```

## Popup Widget Configuration

The MeetingPopup is automatically shown when:
1. Meeting status is LIVE
2. User hasn't already joined (in this session)
3. It's positioned at bottom-right with slide animation

To customize position, modify `MeetingPopup.tsx`:

```typescript
// Line ~36 - Change positioning
<div className="fixed bottom-6 right-6 z-50 animate-slideInUp">
  // bottom-6 = 24px from bottom
  // right-6 = 24px from right
  // Change to: top-6, left-6 for top-left, etc.
</div>
```

## Activity Logging

The system logs these actions:
- `joined` - User joined meeting
- `left` - User left meeting (if implemented in UI)
- `admin_started` - Admin manually started meeting
- `admin_ended` - Admin manually ended meeting

Access logs via:

```typescript
const { data: logs } = await supabase
  .from('meeting_activity')
  .select('*')
  .eq('room_id', roomId)
  .order('created_at', { ascending: false });
```

## Statistics

Daily statistics are automatically aggregated and tracked in `meeting_stats` table:
- `join_count` - Total joins on that day
- `last_joined_at` - Timestamp of last join
- `last_joined_by_user_id` - User ID of last joiner

Query stats:

```typescript
const stats = await MeetingService.getMeetingStats('Daily Standup', '2024-03-31');
console.log(stats.join_count); // How many times meeting was joined
console.log(stats.visitors); // Breakdown by user
```

## Meeting Link Best Practices

✓ Use a single, permanent Google Meet link  
✓ Never change the link (system handles all logic around it)  
✓ The link works infinitely for recurring meetings  
✓ Add the link to Slack/Teams pinned messages  
✓ Include link in meeting invitations (auto-populate if LIVE)  
✓ No authentication needed on the link itself  

## Timezone Considerations

Default: UTC

When comparing times:
1. Current time is in server timezone (UTC)
2. Scheduled times are stored in HH:MM:SS format
3. Timezone field is for UI display purposes
4. All comparisons use server UTC time

To support user timezones:
1. Store user timezone preference
2. Convert scheduled times to user timezone for display
3. Keep all comparisons in UTC (server time)

## Testing the System

### Using the Service Directly

```typescript
import MeetingService from '@/services/MeetingService';

// Get meeting info
const meeting = await MeetingService.getMeetingInfo('Daily Standup');
console.log(meeting);

// Toggle meeting
const started = await MeetingService.toggleMeeting('Daily Standup', 'start');
console.log(started.manual_status); // Should be 'LIVE'

// Join meeting
const result = await MeetingService.joinMeeting('Daily Standup', userId);
if (result.status === 'LIVE') {
  window.open(result.meet_link, '_blank');
}
```

### Using the API Functions

```typescript
import * as meetingAPI from '@/api/meetingAPI';

// Get all meetings
const meetings = await meetingAPI.getAllMeetings();

// Toggle meeting
const started = await meetingAPI.toggleMeeting('Daily Standup', 'start');

// Join meeting
const joined = await meetingAPI.joinMeeting('Daily Standup', userId);
```

### Using the React Hook

```typescript
function MyComponent() {
  const { currentMeeting, isLive, meetingLink, toggleMeeting, refreshMeeting } = useMeeting();

  return (
    <div>
      <p>{currentMeeting?.title}</p>
      <p>Status: {currentMeeting?.status}</p>
      {isLive && <a href={meetingLink}>Join Now</a>}
      <button onClick={() => toggleMeeting('start')}>Start</button>
      <button onClick={() => toggleMeeting('end')}>End</button>
      <button onClick={refreshMeeting}>Refresh</button>
    </div>
  );
}
```

## Common Issues & Solutions

### Issue: Popup not showing
**Solution:** 
- Verify MeetingProvider wraps App in App.tsx
- Check browser console for errors
- Ensure meeting is actually LIVE
- Clear browser cache

### Issue: Status not updating automatically
**Solution:**
- System polls every 10s, wait up to 10 seconds
- Use `refreshMeeting()` for manual refresh
- Check that service worker isn't caching responses

### Issue: Can't toggle meeting
**Solution:**
- Verify you're super_admin
- Check RLS policies are applied
- Ensure database migration ran successfully
- Check Supabase logs for errors

### Issue: Users can access link even when OFFLINE
**Solution:**
- Google Meet link itself has no restrictions (by design)
- System only controls JOIN endpoint
- If direct link access is concern, use a landing page that checks status first

## Deployment Checklist

- [ ] Run database migration in Supabase
- [ ] Verify RLS policies are enabled
- [ ] Set correct Google Meet link in database
- [ ] Test MeetingProvider in App.tsx
- [ ] Test MeetingPopup appears when LIVE
- [ ] Test admin toggle controls
- [ ] Verify activity logging works
- [ ] Check statistics are aggregated
- [ ] Test on mobile (popup positioning)
- [ ] Verify timezone settings are correct
- [ ] Monitor initial polling interval performance
- [ ] Set up monitoring for failed API calls

---

**System Status:** ✅ Ready for Production  
**Last Updated:** 2024-03-31  
**Version:** 1.0.0
