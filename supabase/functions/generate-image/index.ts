// Supabase Edge Function: generate-image
//
// Genera una imagen con Google Imagen 4.0 a partir de un texto.
//
// Pide { prompt } y devuelve { success, image } con un data:image/png;base64.
//
// CONTROL DE ACCESO (2026-10-28). Antes alcanzaba con verify_jwt = true, y eso
// no alcanza: la clave anon también es un JWT válido y viaja en el bundle del
// frontend, así que cualquiera que abriera la app podía generar imágenes a
// costa de la cuenta de Google de la iglesia, sin límite. Ahora:
//   · el bearer tiene que ser el JWT de una persona con sesión (la clave anon
//     y la de servicio no sirven: no tienen usuario);
//   · esa persona tiene que ser SUPER_ADMIN (se mira role y roles[], que
//     conviven en public.users);
//   · hasta TOPE_POR_DIA imágenes por persona y por día (hora argentina), que
//     se cuentan en public.generate_image_usos.
//
// SUPER_ADMIN es decisión propia, no del pedido original: al 2026-10-28 NADA
// llama a esta función (ni el frontend ni ningún trigger o cron), así que no
// había uso real del que deducir los roles. Si mañana una pantalla la
// necesita, hay que sumar su rol acá. Ver el reporte y la sección 38.
//
// También se saca del log la URL de Google, que llevaba la API key en el
// query string (`?key=...`) y quedaba escrita en los logs de la función.
//
// Desplegar con: npx supabase functions deploy generate-image
//   --project-ref oqtumgalnozppqnnjjdb --use-api
// (SIN --no-verify-jwt: acá verify_jwt = true suma una capa antes del
// chequeo de rol.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('ORIGEN_SERVICE_ROLE_KEY');
const GOOGLE_IMAGEN_KEY = Deno.env.get('GOOGLE_IMAGEN_KEY');

/** Imágenes por persona y por día. Nada la usa hoy: alcanza de sobra. */
const TOPE_POR_DIA = 20;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** El inicio del día de hoy en Argentina, para el tope diario. */
function inicioDelDiaArgentino(ahora = new Date()): string {
    const fecha = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(ahora);
    return new Date(`${fecha}T00:00:00-03:00`).toISOString();
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
        console.error('[generate-image] faltan variables de entorno');
        return json({ success: false, error: 'Servicio no configurado' }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // ── Quién llama ─────────────────────────────────────────────────────────
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return json({ success: false, error: 'No autorizado' }, 401);

    const { data: quien } = await supabase.auth.getUser(bearer);
    const userId = quien?.user?.id;
    if (!userId) {
        // Acá caen la clave anon y la de servicio: son JWT válidos, pero no
        // son de ninguna persona.
        console.warn('[generate-image] llamada rechazada: el bearer no es de una persona');
        return json({ success: false, error: 'No autorizado' }, 401);
    }

    const { data: fila } = await supabase
        .from('users').select('role, roles').eq('id', userId).maybeSingle();
    const esSuperAdmin = fila?.role === 'SUPER_ADMIN'
        || (Array.isArray(fila?.roles) && fila.roles.includes('SUPER_ADMIN'));
    if (!esSuperAdmin) {
        console.warn('[generate-image] llamada rechazada: sin el rol');
        return json({ success: false, error: 'No tenés permiso para generar imágenes' }, 403);
    }

    const { count } = await supabase
        .from('generate_image_usos')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', inicioDelDiaArgentino());
    if ((count ?? 0) >= TOPE_POR_DIA) {
        return json({ success: false, error: `Llegaste a las ${TOPE_POR_DIA} imágenes de hoy` }, 429);
    }

    // ── La imagen ───────────────────────────────────────────────────────────
    try {
        if (!GOOGLE_IMAGEN_KEY) {
            console.error('[generate-image] falta GOOGLE_IMAGEN_KEY');
            return json({ success: false, error: 'Servicio no configurado' }, 500);
        }

        const { prompt } = await req.json().catch(() => ({ prompt: '' }));
        const cleanPrompt = String(prompt ?? '').trim();
        if (cleanPrompt === '') return json({ success: false, error: 'Falta el texto' }, 400);

        // Se anota ANTES de pedirla: lo que cuenta para el tope es el intento,
        // así un error de Google no deja la puerta abierta para reintentar sin
        // límite.
        await supabase.from('generate_image_usos').insert({ user_id: userId });

        const targetModel = 'imagen-4.0-fast-generate-001';
        // La URL lleva la API key en el query string: NO se escribe en el log.
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:predict?key=${GOOGLE_IMAGEN_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instances: [{ prompt: cleanPrompt }],
                parameters: { sampleCount: 1, aspectRatio: '4:3' },
            }),
        });

        if (!response.ok) {
            console.error('[generate-image] Google respondió', response.status);
            return json({ success: false, error: `Google no pudo generarla (${response.status})` }, 502);
        }

        const data = await response.json();
        const base64Image = data?.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Image) {
            console.error('[generate-image] Google no devolvió imagen');
            return json({ success: false, error: 'Google no devolvió ninguna imagen' }, 502);
        }

        return json({
            success: true,
            image: `data:image/png;base64,${base64Image}`,
            mock: false,
            provider: 'google-imagen-4.0-fast',
        });
    } catch (error) {
        console.error('[generate-image] error interno:', String(error).slice(0, 200));
        return json({ success: false, error: 'Error interno' }, 500);
    }
});
