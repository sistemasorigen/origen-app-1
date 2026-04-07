import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { templates } from './emailTemplates.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://tu-dominio.com';
const adminEmailsRaw = Deno.env.get('ADMIN_NOTIFICATION_EMAILS');
if (!adminEmailsRaw) {
    console.warn('ADMIN_NOTIFICATION_EMAILS not set.');
}
const adminEmails = (adminEmailsRaw || '').split(',').map(e => e.trim()).filter(Boolean);

// Initialize Supabase Service Role client to bypass RLS and fetch user emails
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('ORIGEN_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface WebhookPayload {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    record: any;
    old_record: any;
}

serve(async (req) => {
    try {
        // Handle CORS preflight
        if (req.method === "OPTIONS") {
            return new Response("ok", {
                headers: {
                    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, x-supabase-api-key",
                },
            });
        }

        // 1. Parse incoming webhook
        const payload: WebhookPayload = await req.json();
        console.log(`Received ${payload.type} event from ${payload.table}`);

        // We only process INSERT and UPDATE
        if (payload.type !== 'INSERT' && payload.type !== 'UPDATE') {
            return new Response('Not an applicable event', { status: 200 });
        }

        const { table, type, record, old_record } = payload;

        let actionResult: any = { message: 'No action taken' };

        // 2. Route events
        if (table === 'groups' && type === 'INSERT') {
            actionResult = await handleGroupCreated(record);
        }
        else if (table === 'leader_applications' && type === 'INSERT') {
            actionResult = await handleHostApplicantCreated(record);
        }
        else if (table === 'groups' && type === 'UPDATE') {
            // Check if status changed to approved
            const oldStatus = old_record?.status;
            const newStatus = record?.status;
            if (oldStatus !== 'approved' && newStatus === 'approved') {
                actionResult = await handleGroupApproved(record);
            }
        }
        else if (table === 'users' && type === 'UPDATE') {
            // Check if roles array gained "ANFITRION"
            const oldRoles = old_record?.roles || [];
            const newRoles = record?.roles || [];
            if (!oldRoles.includes('ANFITRION') && newRoles.includes('ANFITRION')) {
                actionResult = await handleHostApproved(record);
            }
        }

        return new Response(JSON.stringify({ success: true, actionResult }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});

// --- Action Handlers ---

async function handleGroupCreated(record: any) {
    console.log(`Sending Nuevo Grupo Admin Notification for: ${record.name}`);

    const html = templates.groupCreated(
        record.name || 'Sin Nombre',
        `${record.leader_name} ${record.leader_surname}`.trim(),
        record.leader_phone || ''
    );

    return await sendEmail({
        to: adminEmails,
        subject: '🚩 Nuevo Grupo para Revisión - Origen',
        html
    });
}

async function handleHostApplicantCreated(record: any) {
    console.log(`Sending Nuevo Postulante Admin Notification for: ${record.first_name} ${record.last_name}`);

    const html = templates.hostApplicantCreated(
        `${record.first_name} ${record.last_name}`.trim(),
        record.phone || '',
        record.email || ''
    );

    return await sendEmail({
        to: adminEmails,
        subject: '📋 Nueva Postulación para Anfitrión - Origen',
        html
    });
}

async function handleGroupApproved(record: any) {
    console.log(`Sending Grupo Aprobado User Notification for: ${record.name}, host_id: ${record.host_id}`);

    // Need to find the host's email
    let creatorEmail = '';
    const leaderFullName = `${record.leader_name} ${record.leader_surname}`.trim();

    if (record.host_id) {
        const { data: hostUser, error } = await supabase
            .from('users')
            .select('email')
            .eq('id', record.host_id)
            .single();

        if (error) {
            console.warn('Could not fetch host email, fallback to a system skip:', error);
        } else if (hostUser?.email) {
            creatorEmail = hostUser.email;
        }
    }

    if (!creatorEmail) {
        console.log('No email found for host, skipping groupApproved email notification.');
        return;
    }

    const html = templates.groupApproved(record.name, leaderFullName);

    return await sendEmail({
        to: [creatorEmail],
        subject: '✅ ¡Tu Grupo ha sido Aprobado! - Origen',
        html
    });
}

async function handleHostApproved(record: any) {
    console.log(`Sending Anfitrión Aprobado User Notification for: ${record.email}`);

    if (!record.email) {
        console.log('No email found directly in the users record, skipping.');
        return;
    }

    const html = templates.hostApproved(record.name || 'Usuario');

    return await sendEmail({
        to: [record.email],
        subject: '🎉 ¡Bienvenido como Anfitrión de Origen!',
        html
    });
}

// --- Email Sender Helper ---

async function sendEmail({ to, subject, html }: { to: string | string[], subject: string, html: string }) {
    if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY is not set");
        return { error: "RESEND_API_KEY is not set" };
    }

    try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'Origen <team@app.origeniglesia.org>', // Reverting to the existing allowed domain
                to,
                subject,
                html,
            }),
        });

        const resendData = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error("Resend API error:", resendData);
            return { error: "Resend API error", details: resendData };
        } else {
            console.log("Email sent successfully:", resendData);
            return { success: true, data: resendData };
        }
    } catch (error) {
        console.error("Failed to execute fetch to Resend:", error);
        return { error: "Fetch exception", details: String(error) };
    }
}
