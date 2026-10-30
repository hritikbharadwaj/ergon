import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Create regular client to verify the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is a super admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is super admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (adminError || !adminData || adminData.role !== 'super_admin') {
      console.error('Super admin check failed:', adminError);
      return new Response(JSON.stringify({ error: 'Only super admins can perform this action' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, ...data } = await req.json();
    console.log('Admin management action:', action, 'Data:', JSON.stringify(data));

    switch (action) {
      case 'create_admin': {
        const { email, password, name, role, avatar } = data;

        if (!email || !password || !name || !role) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if auth user already exists
        let userId: string;
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createError) {
          if (createError.message.includes('already been registered')) {
            // Find existing auth user by email
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (listError) {
              console.error('Error listing users:', listError);
              return new Response(JSON.stringify({ error: 'Failed to find existing user' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            const existingUser = users.find(u => u.email === email);
            if (!existingUser) {
              return new Response(JSON.stringify({ error: 'User exists in auth but could not be found' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            userId = existingUser.id;
            // Update password for existing user
            await supabaseAdmin.auth.admin.updateUserById(userId, { password });
            console.log('Using existing auth user:', userId);
          } else {
            console.error('Error creating auth user:', createError);
            return new Response(JSON.stringify({ error: createError.message }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } else {
          userId = newUser.user.id;
        }

        console.log('Auth user ready:', userId);

        // Check if admin profile already exists
        const { data: existingProfile } = await supabaseAdmin
          .from('admins')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (existingProfile) {
          return new Response(JSON.stringify({ error: 'An admin profile already exists for this user' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Create admin profile
        const { error: profileError } = await supabaseAdmin
          .from('admins')
          .insert({
            user_id: userId,
            name,
            email,
            role,
            avatar: avatar || null,
            is_active: true,
            status: 'active'
          });

        if (profileError) {
          console.error('Error creating admin profile:', profileError);
          return new Response(JSON.stringify({ error: profileError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('Admin profile created successfully');
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Admin created successfully',
          userId: userId 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'set_password': {
        const { userId, newPassword } = data;

        if (!userId || !newPassword) {
          return new Response(JSON.stringify({ error: 'Missing user ID or password' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (newPassword.length < 6) {
          return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update user password using admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (updateError) {
          console.error('Error updating password:', updateError);
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('Password updated for user:', userId);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Password updated successfully' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete_admin': {
        const { adminId, userId } = data;

        if (!adminId) {
          return new Response(JSON.stringify({ error: 'Missing admin ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete admin profile first
        const { error: deleteProfileError } = await supabaseAdmin
          .from('admins')
          .delete()
          .eq('id', adminId);

        if (deleteProfileError) {
          console.error('Error deleting admin profile:', deleteProfileError);
          return new Response(JSON.stringify({ error: deleteProfileError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Delete auth user if userId provided
        if (userId) {
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (deleteUserError) {
            console.error('Error deleting auth user:', deleteUserError);
            // Don't fail the request, profile is already deleted
          }
        }

        console.log('Admin deleted:', adminId);
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Admin deleted successfully' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Admin management error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
