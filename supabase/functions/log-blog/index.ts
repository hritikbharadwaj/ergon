import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // max 30 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Check authorization - use custom header to avoid conflict with Supabase auth
    const authHeader = req.headers.get('x-api-key');
    if (authHeader !== 'misterutsav_secret') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limited. Try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { author, blogTitle, blogId, timestamp } = body;

    // Validate required fields
    if (!author || !blogTitle || !blogId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: author, blogTitle, blogId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate field types and lengths
    if (typeof author !== 'string' || author.length > 255) {
      return new Response(JSON.stringify({ error: 'author must be a string under 255 chars' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (typeof blogTitle !== 'string' || blogTitle.length > 500) {
      return new Response(JSON.stringify({ error: 'blogTitle must be a string under 500 chars' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const action = `Published blog: ${blogTitle}`;
    const logTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    const { error } = await supabase.from('activity_logs').insert({
      user_name: author,
      action,
      blog_id: blogId,
      timestamp: logTimestamp,
    });

    if (error) {
      console.error('DB insert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to save log' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
