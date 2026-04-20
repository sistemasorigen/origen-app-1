// Edge Function: welcome-reminder
// Llamada cada lunes a las 10am UTC por pg_cron.
// Busca ingresantes que no completaron /form y
// envía hasta 3 recordatorios semanales.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { templates } from '../email-notifier/emailTemplates.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('ORIGEN_SERVICE_ROLE_KEY')!;
const BIENVENIDA_EMAIL = 'bienvenida@origeniglesia.org';
const FROM_EMAIL = 'Origen <team@app.origeniglesia.org>';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

serve(async (req) => {
    // Solo aceptar POST (desde pg_cron o llamada manual)
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const now = new Date();

        // Buscar visitantes que:
        // 1. No completaron el form (stage = 'NEW')
        // 2. Se crearon hace 7+ días
        // 3. Recibieron menos de 3 recordatorios
        // 4. El último recordatorio fue hace 7+ días
        //    (o nunca recibieron ninguno)
        const sevenDaysAgo = new Date(
            now.getTime() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: pending, error } = await supabase
            .from('welcome_visitors')
            .select(
                'id, first_name, last_name, phone, ' +
                'age, created_at, form_reminder_count, ' +
                'form_reminder_sent_at'
            )
            .eq('stage', 'NEW')
            .lt('created_at', sevenDaysAgo)
            .lt('form_reminder_count', 3)
            .or(
                'form_reminder_sent_at.is.null,' +
                `form_reminder_sent_at.lt.${sevenDaysAgo}`
            );

        if (error) {
            console.error('[Reminder] Query error:', error);
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500 }
            );
        }

        if (!pending || pending.length === 0) {
            console.log('[Reminder] No pending visitors.');
            return new Response(
                JSON.stringify({ success: true, processed: 0 }),
                { status: 200 }
            );
        }

        console.log(`[Reminder] Processing ${pending.length} visitors.`);

        let successCount = 0;
        let errorCount = 0;

        for (const visitor of pending) {
            const nextReminderNum = (visitor.form_reminder_count || 0) + 1;

            try {
                // Construir email de recordatorio
                const html = templates.welcomeFormReminder(
                    visitor.first_name || '',
                    visitor.last_name || '',
                    visitor.phone || 'No proporcionado',
                    visitor.age ? String(visitor.age) : 'No proporcionado',
                    visitor.created_at,
                    nextReminderNum
                );

                // Enviar email
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${RESEND_API_KEY}`
                    },
                    body: JSON.stringify({
                        from: FROM_EMAIL,
                        to: [BIENVENIDA_EMAIL],
                        subject:
                            `🔔 Recordatorio #${nextReminderNum}: ` +
                            `${visitor.first_name} ` +
                            `${visitor.last_name} ` +
                            `sin completar formulario — Origen`,
                        html
                    })
                });

                if (!res.ok) {
                    const errData = await res.json();
                    console.error(
                        `[Reminder] Resend error for ${visitor.id}:`, errData
                    );
                    errorCount++;
                    continue;
                }

                // Actualizar contadores en DB
                const { error: updateError } = await supabase
                    .from('welcome_visitors')
                    .update({
                        form_reminder_count: nextReminderNum,
                        form_reminder_sent_at: now.toISOString()
                    })
                    .eq('id', visitor.id);

                if (updateError) {
                    console.error(
                        `[Reminder] Update error for ${visitor.id}:`, updateError
                    );
                    errorCount++;
                } else {
                    console.log(
                        `[Reminder] Sent #${nextReminderNum} ` +
                        `for ${visitor.first_name} ${visitor.last_name}`
                    );
                    successCount++;
                }

            } catch (err) {
                console.error(`[Reminder] Exception for ${visitor.id}:`, err);
                errorCount++;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed: pending.length,
                sent: successCount,
                errors: errorCount
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            }
        );

    } catch (err) {
        console.error('[Reminder] Fatal error:', err);
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500 }
        );
    }
});
