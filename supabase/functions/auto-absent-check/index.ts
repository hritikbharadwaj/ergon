import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use IST timezone for date calculation
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    const today = istNow.toISOString().split("T")[0];

    // Get all active admins (excluding esports and super admins)
    const { data: admins, error: adminsError } = await supabase
      .from("admins")
      .select("id, name, role")
      .eq("is_active", true)
      .not("role", "in", '("esports_admin","super_admin")');

    if (adminsError) throw adminsError;

    const results: any[] = [];

    for (const admin of admins || []) {
      // Check if attendance already exists for today
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("id, status, check_in_time")
        .eq("admin_id", admin.id)
        .eq("date", today)
        .single();

      const { data: isWorkingDay } = await supabase.rpc("is_attendance_working_day", { _date: today });
      if (isWorkingDay === false) {
        results.push({ admin: admin.name, action: "skipped", reason: "holiday_or_weekend" });
        continue;
      }

      const hasWorkLog = await checkWorkLog(supabase, admin, today);

      // Never downgrade valid face-scan attendance. Earlier logic was turning
      // everyone absent when a log lookup missed the new work_log_entries table.
      if (existingAttendance) {
        results.push({
          admin: admin.name,
          action: "kept",
          reason: hasWorkLog ? "attendance_and_work_log_exist" : "attendance_exists_no_log",
          status: existingAttendance.status,
        });
        continue;
      }

      await supabase.from("attendance").insert({
        admin_id: admin.id,
        date: today,
        status: "absent",
        marked_by: admin.id,
        marked_at: now.toISOString(),
        override_reason: hasWorkLog
          ? "Auto-absent: Work log exists but face scan check-in was not marked"
          : "Auto-absent: No face scan attendance found by day close",
      });
      results.push({
        admin: admin.name,
        action: hasWorkLog ? "marked_absent_without_face_scan" : "marked_absent",
        reason: hasWorkLog ? "work_log_without_face_scan" : "no_face_scan_no_work_log",
      });
    }

    return new Response(
      JSON.stringify({ success: true, date: today, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkWorkLog(supabase: any, admin: any, today: string): Promise<boolean> {
  const { data: unified } = await supabase.rpc("admin_has_work_log_for_date", { p_admin_id: admin.id, p_date: today });
  if (unified === true) return true;

  const todayStart = today + "T00:00:00";
  const todayEnd = today + "T23:59:59";

  if (admin.role === "tech_admin") {
    const { data } = await supabase
      .from("tech_work_logs")
      .select("id")
      .eq("admin_id", admin.id)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)
      .limit(1);
    return (data || []).length > 0;
  } else if (admin.role === "content_admin" || admin.role === "social_admin") {
    const { data } = await supabase
      .from("content_work_logs")
      .select("id")
      .eq("admin_id", admin.id)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)
      .limit(1);
    return (data || []).length > 0;
  } else if (admin.role === "hr_admin") {
    const { data: c } = await supabase
      .from("content_work_logs")
      .select("id")
      .eq("admin_id", admin.id)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)
      .limit(1);
    const { data: t } = await supabase
      .from("tech_work_logs")
      .select("id")
      .eq("admin_id", admin.id)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)
      .limit(1);
    return ((c || []).length > 0) || ((t || []).length > 0);
  }
  return false;
}

