-- Create meeting_settings table
CREATE TABLE IF NOT EXISTS public.meeting_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name TEXT NOT NULL UNIQUE,
  meet_link TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Daily Standup',
  description TEXT,
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '09:30:00',
  recurrence_type TEXT NOT NULL DEFAULT 'daily', -- 'daily' or 'custom'
  recurrence_date DATE, -- Only used for custom recurrence
  manual_status TEXT DEFAULT NULL, -- 'LIVE' or 'OFFLINE' if manually set
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_recurrence_type CHECK (recurrence_type IN ('daily', 'custom')),
  CONSTRAINT valid_manual_status CHECK (manual_status IN ('LIVE', 'OFFLINE', NULL))
);

-- Create meeting_activity table for logging
CREATE TABLE IF NOT EXISTS public.meeting_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.meeting_settings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'joined', 'left', 'admin_started', 'admin_ended'
  joined_at TIMESTAMP,
  left_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT valid_action CHECK (action IN ('joined', 'left', 'admin_started', 'admin_ended'))
);

-- Create meeting_sessions table to track when meetings were started and ended
CREATE TABLE IF NOT EXISTS public.meeting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.meeting_settings(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  started_by_user_id UUID REFERENCES auth.users(id),
  ended_by_user_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for meeting sessions
CREATE INDEX idx_meeting_sessions_room_id ON public.meeting_sessions(room_id);
CREATE INDEX idx_meeting_sessions_started_at ON public.meeting_sessions(started_at);
CREATE INDEX idx_meeting_sessions_is_active ON public.meeting_sessions(is_active);

-- Create meeting_stats table
CREATE TABLE IF NOT EXISTS public.meeting_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.meeting_settings(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  join_count INT DEFAULT 0,
  last_joined_at TIMESTAMP,
  last_joined_by_user_id UUID,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(room_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_meeting_settings_room_name ON public.meeting_settings(room_name);
CREATE INDEX IF NOT EXISTS idx_meeting_activity_room_id ON public.meeting_activity(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_activity_user_id ON public.meeting_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_activity_created_at ON public.meeting_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_meeting_stats_room_id ON public.meeting_stats(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_stats_date ON public.meeting_stats(date);

-- Enable RLS (Row Level Security)
ALTER TABLE public.meeting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow everyone to view meeting settings
CREATE POLICY "Allow public read access to meeting_settings"
  ON public.meeting_settings
  FOR SELECT
  USING (true);

-- Allow only super_admin to update meeting settings
CREATE POLICY "Allow super_admin to update meeting_settings"
  ON public.meeting_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Allow only super_admin to insert meeting settings
CREATE POLICY "Allow super_admin to insert meeting_settings"
  ON public.meeting_settings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Allow authenticated users to insert meeting activity
CREATE POLICY "Allow authenticated users to insert activity"
  ON public.meeting_activity
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to view their own activity
CREATE POLICY "Allow users to view their activity"
  ON public.meeting_activity
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Allow public read access to meeting stats
CREATE POLICY "Allow public read access to meeting_stats"
  ON public.meeting_stats
  FOR SELECT
  USING (true);

-- Allow authenticated users to update meeting stats
CREATE POLICY "Allow users to update meeting_stats"
  ON public.meeting_stats
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Allow public read access to meeting sessions
CREATE POLICY "Allow public read access to meeting_sessions"
  ON public.meeting_sessions
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert meeting sessions (for logging)
CREATE POLICY "Allow authenticated users to insert sessions"
  ON public.meeting_sessions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update meeting sessions
CREATE POLICY "Allow users to update meeting_sessions"
  ON public.meeting_sessions
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create a function to update meeting_settings updated_at timestamp
CREATE OR REPLACE FUNCTION update_meeting_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER meeting_settings_updated_at_trigger
  BEFORE UPDATE ON public.meeting_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_settings_timestamp();

-- Insert default meeting room
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
) ON CONFLICT (room_name) DO NOTHING;
