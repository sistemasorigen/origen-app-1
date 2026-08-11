// Genera un identificador de build único y lo
// guarda en un archivo que:
// 1. vite.config.ts lee para embeberlo en el bundle
//    vía `define` (así el código compilado sabe su
//    propio identificador de build en runtime).
// 2. notify-deploy.js lee para mandar ESE MISMO
//    valor a la base — no un timestamp generado por
//    separado, para que los dos números siempre
//    coincidan cuando el deploy es exitoso.
import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Se usa el hash del commit actual (no Date.now())
// para que rebuilds sin cambios reales de código
// —como los que dispara .git/hooks/pre-push en
// cada push, aunque no haya nada nuevo— produzcan
// SIEMPRE el mismo build version. Solo un commit
// real (HEAD distinto) genera un valor nuevo, que
// es cuando de verdad corresponde avisar de una
// actualización.
let buildVersion;
try {
    buildVersion = execSync('git rev-parse HEAD', { cwd: join(__dirname, '..') })
        .toString()
        .trim();
} catch (err) {
    // Si no hay git disponible (poco probable acá,
    // pero por las dudas) o falla el comando, caer
    // en un valor basado en tiempo como respaldo —
    // mejor eso que romper el build entero.
    console.warn('[generate-build-version] No se pudo leer git rev-parse HEAD, usando timestamp como respaldo:', err.message);
    buildVersion = Date.now().toString();
}

writeFileSync(
    join(__dirname, '..', '.build-version'),
    buildVersion
);

console.log(`[generate-build-version] Build version: ${buildVersion}`);
