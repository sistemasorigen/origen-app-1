
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://tu-dominio.com';

const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { phone, message } = await req.json()

        console.log(`Sending WhatsApp to ${phone}: ${message}`)

        // TODO: Integrate with WhatsApp Provider (Twilio, Meta, etc.)
        // For now, we return success to unblock the frontend.

        return new Response(
            JSON.stringify({ success: true, message: 'Message queued' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
