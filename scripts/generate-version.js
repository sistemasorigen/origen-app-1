// Genera public/version.json ANTES de cada build,
// para que Vite lo copie a dist/version.json.
// El frontend lo usa para detectar cuándo hubo un
// deploy nuevo mientras alguien tenía la app abierta.
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const versionFilePath = join(__dirname, '..', 'public', 'version.json');

const version = {
    version: Date.now().toString(),
    generatedAt: new Date().toISOString()
};

writeFileSync(versionFilePath, JSON.stringify(version, null, 2));
console.log(`[generate-version] public/version.json generado: ${version.version}`);
