
// debug_imagen_request.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Env
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (line && line.includes('=')) {
                    const [key, ...val] = line.split('=');
                    if (key && val) {
                        process.env[key.trim()] = val.join('=').trim();
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error loading .env.local', e);
    }
}

loadEnv();

async function testImagen() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No API Key');
        return;
    }

    const model = 'imagen-4.0-fast-generate-001';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const payload = {
        instances: [
            { prompt: "A futuristic cathedral with neon lights, realistic, 8k" }
        ],
        parameters: {
            sampleCount: 1,
            aspectRatio: "4:3"
        }
    };

    console.log('Testing URL:', url);
    console.log('Payload:', JSON.stringify(payload));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response Body:', text);

    } catch (e) {
        console.error('Fetch Failed:', e);
    }
}

testImagen();
