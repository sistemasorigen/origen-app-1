// Se corre al final de "npm run deploy" — actualiza
// app_version en Supabase para que todos los
// clientes con la app abierta reciban el aviso de
// actualización vía Realtime, sin necesidad de
// refrescar la página para "enterarse".
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[notify-deploy] Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local — no se pudo avisar del deploy.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const newVersion = Date.now().toString();

const { error } = await supabase
    .from('app_version')
    .update({ version: newVersion, updated_at: new Date().toISOString() })
    .eq('id', 1);

if (error) {
    console.error('[notify-deploy] Error actualizando app_version:', error);
    process.exit(1);
}

console.log(`[notify-deploy] app_version actualizada a ${newVersion} — los clientes conectados van a ver el aviso de actualización.`);
