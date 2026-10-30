import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Get admin profile
    const { data: admin } = await supabase
      .from("admins")
      .select("id, name, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!admin) {
      return new Response(JSON.stringify({ error: "Admin not found" }), { status: 403, headers: corsHeaders });
    }

    // Get email identity
    const { data: identity } = await supabase
      .from("admin_email_identities")
      .select("*")
      .eq("admin_id", admin.id)
      .eq("is_active", true)
      .single();

    if (!identity) {
      return new Response(JSON.stringify({ error: "No email identity assigned" }), { status: 403, headers: corsHeaders });
    }

    // Check daily limit - use service role for updating
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const today = new Date().toISOString().split("T")[0];
    let emailsSentToday = identity.emails_sent_today;
    
    // Reset count if date changed
    if (identity.last_sent_date !== today) {
      emailsSentToday = 0;
      await serviceClient
        .from("admin_email_identities")
        .update({ emails_sent_today: 0, last_sent_date: today })
        .eq("id", identity.id);
    }

    if (emailsSentToday >= identity.daily_limit) {
      return new Response(
        JSON.stringify({ error: "Daily email limit reached", limit: identity.daily_limit, sent: emailsSentToday }),
        { status: 429, headers: corsHeaders }
      );
    }

    const { recipientEmail, subject, content } = await req.json();

    if (!recipientEmail || !subject || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
    }

    // Send via Brevo
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: identity.sender_name, email: identity.sender_email },
        to: [{ email: recipientEmail }],
        subject: subject,
        htmlContent: content,
      }),
    });

    const brevoData = await brevoResponse.json();
    const status = brevoResponse.ok ? "sent" : "failed";
    const errorMsg = brevoResponse.ok ? null : JSON.stringify(brevoData);

    // Log the email
    await serviceClient.from("admin_email_logs").insert({
      admin_id: admin.id,
      sender_email: identity.sender_email,
      recipient_email: recipientEmail,
      subject,
      content,
      status,
      error_message: errorMsg,
    });

    // Increment daily count
    if (status === "sent") {
      await serviceClient
        .from("admin_email_identities")
        .update({ emails_sent_today: emailsSentToday + 1, last_sent_date: today })
        .eq("id", identity.id);
    }

    if (!brevoResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to send email", details: brevoData }), { status: 500, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({ success: true, remaining: identity.daily_limit - emailsSentToday - 1 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
