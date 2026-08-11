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
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildVersion = Date.now().toString();

writeFileSync(
    join(__dirname, '..', '.build-version'),
    buildVersion
);

console.log(`[generate-build-version] Build version: ${buildVersion}`);
