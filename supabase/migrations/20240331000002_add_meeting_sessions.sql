-- Add meeting_sessions table for tracking when meetings start and end
CREATE TABLE IF NOT EXISTS public.meeting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.meeting_settings(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  started_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for meeting_sessions
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_room_id ON public.meeting_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_sessions_started_at ON public.meeting_sessions(started_at);

-- Enable RLS on meeting_sessions
ALTER TABLE public.meeting_sessions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to meeting_sessions
CREATE POLICY IF NOT EXISTS "Allow public read access to meeting_sessions"
  ON public.meeting_sessions
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert meeting_sessions
CREATE POLICY IF NOT EXISTS "Allow users to insert meeting_sessions"
  ON public.meeting_sessions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow authenticated users to update meeting_sessions
CREATE POLICY IF NOT EXISTS "Allow users to update meeting_sessions"
  ON public.meeting_sessions
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create a function to update meeting_sessions updated_at timestamp
CREATE OR REPLACE FUNCTION update_meeting_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS meeting_sessions_updated_at_trigger ON public.meeting_sessions;
CREATE TRIGGER meeting_sessions_updated_at_trigger
  BEFORE UPDATE ON public.meeting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_sessions_timestamp();
