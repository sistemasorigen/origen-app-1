
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic .env parser
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

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
        console.error('No API Key found in .env.local');
        return;
    }

    console.log('Querying Google AI Models with Key:', apiKey.substring(0, 10) + '...');

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error('API Error:', response.status, response.statusText);
            const errText = await response.text();
            console.error('Body:', errText);
            return;
        }

        const data = await response.json();

        if (data.models) {
            console.log('\n--- AVAILABLE MODELS ---');
            let foundGenerative = false;

            for (const m of data.models) {
                const methods = m.supportedGenerationMethods || [];
                if (m.name.includes('vision') || m.name.includes('image') || m.name.includes('gemini') || methods.includes('generateImage')) {
                    console.log(`- ${m.name}`); // Full name includes models/ prefix
                    console.log(`  Methods: ${methods.join(', ')}`);
                    if (methods.includes('generateImage')) foundGenerative = true;
                }
            }

            if (!foundGenerative) {
                console.log('\nWARNING: No models with [generateImage] capability found.');
            }

        } else {
            console.log('No models returned:', data);
        }

    } catch (error) {
        console.error('Script Error:', error.message);
    }
}

listModels();
