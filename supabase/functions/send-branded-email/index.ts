import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildBrandedEmail(opts: {
  heading: string;
  recipientName: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  profilePic?: string;
  fromName?: string;
}): string {
  const pic =
    opts.profilePic ||
    "https://github.com/user-attachments/assets/160c433a-e006-42ee-8923-f6360223e116";
  const cta = opts.ctaUrl
    ? `<tr><td align="center" style="padding:10px 0 24px 0;">
         <a href="${opts.ctaUrl}" style="background:#4f7cff;color:#fff;font-size:16px;font-weight:bold;padding:14px 28px;border-radius:12px;text-decoration:none;display:inline-block;">${opts.ctaLabel || "Open"}</a>
       </td></tr>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${opts.heading}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial, Helvetica, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff"><tr><td align="center" style="padding:30px 10px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid #d1d5db;border-radius:12px;overflow:hidden;">
<tr><td align="center" bgcolor="#f3f4f6" style="padding:18px;">
<img src="https://github.com/user-attachments/assets/160c433a-e006-42ee-8923-f6360223e116" alt="THRYLOS Logo" width="120" style="display:block;"></td></tr>
<tr><td align="center" style="padding-top:30px;">
<img src="${pic}" alt="Profile" width="80" style="display:block;border-radius:50%;border:3px solid #e5e7eb;"></td></tr>
<tr><td align="center" style="padding:20px 20px 6px 20px;">
<h1 style="font-size:28px;margin:0;font-weight:800;color:#1f2937;">${opts.heading}</h1></td></tr>
<tr><td align="center" style="padding:0 28px 10px 28px;color:#555;font-size:15px;">Hello ${opts.recipientName || "there"},</td></tr>
<tr><td style="padding:14px 36px;font-size:15px;color:#333;line-height:1.55;">${opts.bodyHtml}</td></tr>
${cta}
<tr><td align="center" style="padding:6px 40px 30px 40px;font-size:13px;color:#777;">
Sent from ${opts.fromName || "Thrylos Admin"} · admin@thrylos.in</td></tr>
<tr><td bgcolor="#000000" style="padding:18px;"><table width="100%"><tr>
<td style="color:#ffffff;font-size:13px;">&copy; ${new Date().getFullYear()} THRYLOS. All rights reserved.</td>
<td align="right"><img src="https://github.com/user-attachments/assets/160c433a-e006-42ee-8923-f6360223e116" width="90"></td>
</tr></table></td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    const { data: sender } = await serviceClient
      .from("admins")
      .select("id, name, role, avatar")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (!sender) {
      return new Response(JSON.stringify({ error: "Admin not found" }), { status: 403, headers: corsHeaders });
    }
    if (sender.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Only super admins can send branded emails" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      recipientEmail, recipientName, subject, heading, message,
      ctaLabel, ctaUrl, recipientAdminId, kind,
    } = body || {};

    if (!recipientEmail || !subject || !message) {
      return new Response(JSON.stringify({ error: "Missing recipientEmail, subject or message" }), { status: 400, headers: corsHeaders });
    }

    // Resolve recipient profile pic if recipientAdminId provided
    let pic: string | undefined;
    if (recipientAdminId) {
      const { data: r } = await serviceClient
        .from("admins").select("avatar, name").eq("id", recipientAdminId).single();
      pic = r?.avatar || undefined;
    }

    const html = buildBrandedEmail({
      heading: heading || subject,
      recipientName: recipientName || "there",
      bodyHtml: message,
      ctaLabel, ctaUrl,
      profilePic: pic,
      fromName: sender.name || "Thrylos Admin",
    });

    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoApiKey, "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        sender: { name: "Thrylos Admin", email: "admin@thrylos.in" },
        replyTo: { name: sender.name || "Thrylos Admin", email: "admin@thrylos.in" },
        to: [{ email: recipientEmail, name: recipientName || undefined }],
        subject, htmlContent: html,
      }),
    });

    const respData = await resp.json().catch(() => ({}));
    const status = resp.ok ? "sent" : "failed";

    await serviceClient.from("admin_email_logs").insert({
      admin_id: sender.id,
      sender_email: "admin@thrylos.in",
      recipient_email: recipientEmail,
      subject,
      content: `[${kind || "branded"}] ${message}`,
      status,
      error_message: resp.ok ? null : JSON.stringify(respData),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Failed to send", details: respData }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});