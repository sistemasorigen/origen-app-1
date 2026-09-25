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

// La hora del build, que vite embebe junto al identificador.
//
// El identificador solo dice SI la versión publicada es otra; no dice cuál
// es más nueva —son hashes de commit, no se ordenan—. Con la hora sí:
// app_version guarda cuándo se publicó, y el cliente puede preguntarse "¿lo
// que hay publicado salió después de que me compilaron a mí?".
//
// Hace falta por una ventana real: el deploy sube los archivos y recién 20
// segundos después toca la base. Quien entra en ese hueco ya tiene el bundle
// nuevo mientras la base todavía anuncia el anterior, y sin la hora se le
// ofrecería "actualizar" a una versión más vieja que la suya.
const buildTime = new Date().toISOString();
writeFileSync(
    join(__dirname, '..', '.build-time'),
    buildTime
);

console.log(`[generate-build-version] Build version: ${buildVersion} (${buildTime})`);
