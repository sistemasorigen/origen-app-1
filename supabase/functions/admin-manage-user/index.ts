import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Supabase inyecta estas variables automáticamente en Edge Functions
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
// SUPABASE_SERVICE_ROLE_KEY es la key estándar que Supabase provee automáticamente
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return errorResponse('Missing Authorization header', 401);
        }

        const token = authHeader.replace('Bearer ', '');

        // 1. Verificar token usando el cliente del usuario (con anon key)
        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();

        if (authError || !caller) {
            return errorResponse(`Invalid token: ${authError?.message}`, 401);
        }

        // 2. Verificar rol usando el cliente del usuario (accede a su propio registro)
        const { data: callerRecord, error: profileError } = await supabaseUser
            .from('users')
            .select('role, roles')
            .eq('id', caller.id)
            .single();

        console.log('Caller:', caller.id, caller.email);
        console.log('Record:', JSON.stringify(callerRecord));
        console.log('Profile error:', profileError?.message);

        const isSuperAdmin =
            callerRecord?.role === 'SUPER_ADMIN' ||
            (Array.isArray(callerRecord?.roles) && callerRecord.roles.includes('SUPER_ADMIN'));

        if (!isSuperAdmin) {
            return errorResponse(
                `Unauthorized. role=${callerRecord?.role}, roles=${JSON.stringify(callerRecord?.roles)}, profileErr=${profileError?.message}`,
                403
            );
        }

        // 3. Admin client para operaciones privilegiadas en auth.users
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        });

        const body = await req.json();
        const { action, userId, email, password, name } = body;
        let result;

        if (action === 'CREATE') {
            if (!email || !password) return errorResponse('Email and password required', 400);
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
                email, password,
                user_metadata: { name: name || 'Usuario' },
                email_confirm: true,
            });
            if (error) throw error;
            result = data.user;
        }
        else if (action === 'UPDATE_PASSWORD') {
            if (!userId || !password) return errorResponse('UserId and password required', 400);
            const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
            if (error) throw error;
            result = { success: true, message: 'Password updated' };
        }
        else if (action === 'DELETE') {
            if (!userId) return errorResponse('UserId required for DELETE', 400);
            const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (error) throw error;
            result = { success: true, message: 'User deleted' };
        }
        else {
            return errorResponse(`Unknown action: ${action}`, 400);
        }

        return new Response(JSON.stringify({ success: true, data: result }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('Edge function error:', err);
        return errorResponse(err.message, 500);
    }
});

function errorResponse(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}
