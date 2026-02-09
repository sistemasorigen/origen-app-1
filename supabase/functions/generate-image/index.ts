
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { prompt } = await req.json();
        const cleanPrompt = (prompt || '').trim();

        console.log('Generando imagen (GOOGLE IMAGEN 4.0 - HARDCODED KEY) para:', cleanPrompt);

        // API KEY
        const apiKey = "AIzaSyDrevR_K1HjaGYCvjoCkxnLdvTqSpdPWq4";

        const targetModel = 'imagen-4.0-fast-generate-001';
        // const targetModel = 'imagen-3.0-generate-001'; // Fallback if 4.0 fails?

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:predict?key=${apiKey}`;

        const payload = {
            instances: [
                { prompt: cleanPrompt }
            ],
            parameters: {
                sampleCount: 1,
                aspectRatio: "4:3"
            }
        };

        console.log('Calling Google API:', url);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Google API Error:', response.status, errText);
            // Throw simple error to catch block
            throw new Error(`Google Error (${response.status}): ${errText}`);
        }

        const data = await response.json();

        // Parse response
        if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
            console.error('Unexpected response format:', data);
            throw new Error('Google API: No image data returned. ' + JSON.stringify(data));
        }

        const base64Image = data.predictions[0].bytesBase64Encoded;
        const finalImage = `data:image/png;base64,${base64Image}`;

        return new Response(
            JSON.stringify({
                success: true,
                image: finalImage,
                mock: false,
                provider: 'google-imagen-4.0-fast'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
        );

    } catch (error) {
        console.error('Error in generate-image:', error);

        // CRITICAL CHANGE: Return 200 OK even on error, so the client receives the JSON body
        // This allows us to see the "error" message in the frontend
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Unknown error',
                details: JSON.stringify(error)
            }),
            {
                status: 200, // <--- CHANGED FROM 500 TO 200
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
