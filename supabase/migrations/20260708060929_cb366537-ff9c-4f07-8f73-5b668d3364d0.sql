DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.work_log_entries; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leave_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.work_log_entries REPLICA IDENTITY FULL;
ALTER TABLE public.leave_requests REPLICA IDENTITY FULL;
ALTER TABLE public.attendance_settings REPLICA IDENTITY FULL;