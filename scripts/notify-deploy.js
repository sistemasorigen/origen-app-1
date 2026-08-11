// Se corre al final de "npm run deploy" — actualiza
// app_version en Supabase para que todos los
// clientes con la app abierta reciban el aviso de
// actualización vía Realtime, sin necesidad de
// refrescar la página para "enterarse".
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, unlinkSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[notify-deploy] Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local — no se pudo avisar del deploy.');
    process.exit(1);
}

const buildVersionPath = join(__dirname, '..', '.build-version');

if (!existsSync(buildVersionPath)) {
    console.error('[notify-deploy] No existe .build-version. Este script espera correr después de "npm run build" (que lo genera) — corré "npm run deploy" completo en vez de este script suelto.');
    process.exit(1);
}

// Mismo identificador que quedó embebido en el bundle recién subido:
// scripts/generate-build-version.js lo generó UNA sola vez, antes de
// `vite build`, y vite.config.ts lo leyó de este mismo archivo para
// embeberlo. Si acá se generara un Date.now() nuevo en su lugar, sería un
// número distinto al que el código compilado tiene adentro, y
// useVersionCheck nunca podría confirmar que un reload trajo el build
// correcto.
const newVersion = readFileSync(buildVersionPath, 'utf-8').trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// El `git push` de este mismo `npm run deploy` recién terminó, pero eso no
// garantiza que el hosting ya esté sirviendo el dist/ nuevo — hay una
// ventana de propagación. Avisar antes de tiempo manda a cualquiera que
// recargue justo en ese hueco a una versión a medio publicar. No hay forma
// de confirmar la propagación desde acá sin saber el mecanismo exacto del
// hosting, así que este delay es el margen de seguridad razonable.
const PROPAGATION_DELAY_MS = 20_000;
console.log(`[notify-deploy] Esperando ${PROPAGATION_DELAY_MS / 1000}s para darle margen al hosting antes de avisar del deploy (no se colgó)...`);
await new Promise(resolve => setTimeout(resolve, PROPAGATION_DELAY_MS));

const { error } = await supabase
    .from('app_version')
    .update({ version: newVersion, updated_at: new Date().toISOString() })
    .eq('id', 1);

if (error) {
    console.error('[notify-deploy] Error actualizando app_version:', error);
    process.exit(1);
}

console.log(`[notify-deploy] app_version actualizada a ${newVersion} — los clientes conectados van a ver el aviso de actualización.`);

// Archivo de trabajo intermedio: no debe quedar colgado entre deploys (el
// próximo build lo regenera desde cero de todos modos, pero dejarlo viejo
// tirado en el repo confundiría a cualquiera que lo mire).
try {
    unlinkSync(buildVersionPath);
} catch (err) {
    console.warn('[notify-deploy] No se pudo borrar .build-version:', err instanceof Error ? err.message : err);
}
