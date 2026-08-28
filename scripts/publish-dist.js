// Sube dist/ al hosting por FTPS y CONFIRMA que quedó publicado.
//
// Por qué existe este script
// --------------------------
// Hasta el 24-ago-2026 "npm run deploy" terminaba en `git push` y nada más:
// se daba por hecho que el hosting tomaba el dist/ del repo por su cuenta.
// Ese pull se cortó en silencio y producción quedó cuatro días sirviendo un
// build viejo mientras cada deploy reportaba éxito. El push a GitHub nunca
// fue una publicación — sólo lo parecía.
//
// Acá se cierra ese tramo: el propio deploy deja los archivos en el server y
// después verifica contra la URL pública que el bundle servido sea el que se
// acaba de construir. Si no coincide, falla. Un deploy que no publica tiene
// que doler en el momento, no cuatro días después.
//
// No usa ninguna librería de FTP a propósito: el árbol de dependencias del
// proyecto ya arrastra un conflicto de peers (react-joyride pide React 15-18
// contra el React 19 del proyecto), así que agregar paquetes obliga a
// --legacy-peer-deps y a tocar node_modules. curl viene con Windows 10+ y con
// cualquier Linux, y habla FTPS nativo.

import { execFileSync } from 'child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

config({ path: join(ROOT, '.env.local') });

const {
    DEPLOY_FTP_HOST,
    DEPLOY_FTP_USER,
    DEPLOY_FTP_PASSWORD,
    // El dominio no sirve public_html a secas: el server tiene el repo
    // clonado en public_html/app-origen/ y apunta a la subcarpeta dist/ de
    // ese clone. Ese es el docroot real.
    DEPLOY_FTP_DIR = 'public_html/app-origen/dist',
    DEPLOY_PUBLIC_URL = 'https://app.origeniglesia.org',
    // FTPS explícito (AUTH TLS) es el default. Si el hosting no lo soporta y
    // curl corta con "server doesn't support AUTH", poner DEPLOY_FTP_PLAIN=true
    // en .env.local — pero sabiendo que ahí la contraseña viaja en claro.
    DEPLOY_FTP_PLAIN
} = process.env;

const faltantes = ['DEPLOY_FTP_HOST', 'DEPLOY_FTP_USER', 'DEPLOY_FTP_PASSWORD']
    .filter(k => !process.env[k]);

if (faltantes.length > 0) {
    console.error(`[publish-dist] Faltan variables en .env.local: ${faltantes.join(', ')}`);
    console.error('[publish-dist] Ver .env.example para el detalle de cada una.');
    process.exit(1);
}

if (!existsSync(join(DIST, 'index.html'))) {
    console.error('[publish-dist] No existe dist/index.html. Este script corre DESPUÉS de "vite build" — usá "npm run deploy" completo.');
    process.exit(1);
}

// ── Qué bundle tiene que terminar sirviendo producción ───────────────────
// Sale del index.html recién construido, que es la única fuente de verdad:
// el nombre lleva el hash del contenido, así que si producción sirve otro,
// está sirviendo otro build.
const indexLocal = readFileSync(join(DIST, 'index.html'), 'utf-8');
const bundleEsperado = indexLocal.match(/assets\/index-[^"']+\.js/)?.[0];

if (!bundleEsperado) {
    console.error('[publish-dist] No se pudo leer el nombre del bundle en dist/index.html. ¿El build terminó bien?');
    process.exit(1);
}

// ── Listado de archivos a subir ──────────────────────────────────────────
const listarArchivos = (dir) => readdirSync(dir).flatMap(nombre => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? listarArchivos(ruta) : [ruta];
});

// index.html va ÚLTIMO, no por prolijidad sino porque es lo que evita una
// ventana de pantalla en blanco: apunta a assets/index-<hash>.js, y el
// .htaccess reescribe cualquier ruta inexistente a index.html. Si el HTML
// nuevo llega antes que su bundle, el navegador pide el .js, recibe HTML, y
// el <script type="module"> muere por MIME type.
const archivos = listarArchivos(DIST).sort((a, b) => {
    const aEsIndex = relative(DIST, a) === 'index.html';
    const bEsIndex = relative(DIST, b) === 'index.html';
    return Number(aEsIndex) - Number(bEsIndex);
});

// ── Subida ───────────────────────────────────────────────────────────────
// Las credenciales van por stdin (curl -K -) y no como argumentos: en la
// línea de comandos quedarían visibles para cualquier proceso que liste la
// tabla de procesos del sistema.
const escaparConfig = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const configCurl = `user = "${escaparConfig(DEPLOY_FTP_USER)}:${escaparConfig(DEPLOY_FTP_PASSWORD)}"\n`;

// Siempre `ftp://` (puerto 21), nunca `ftps://`. En curl el esquema `ftps://`
// significa FTPS *implícito*, que escucha en el 990 — un puerto que los
// hostings compartidos no suelen abrir (Ferozo/DonWeb corta ahí con
// "Could not connect to server"). El cifrado se pide con --ssl-reqd, que
// negocia TLS sobre la conexión normal del 21: eso es FTPS *explícito*
// (AUTH TLS), que es lo que estos hostings sí soportan.
const baseRemota = `ftp://${DEPLOY_FTP_HOST}/${DEPLOY_FTP_DIR.replace(/^\/+|\/+$/g, '')}`;
const usaTLS = DEPLOY_FTP_PLAIN !== 'true';

console.log(`[publish-dist] Subiendo ${archivos.length} archivos a ${DEPLOY_FTP_HOST}/${DEPLOY_FTP_DIR} (${usaTLS ? 'FTPS explícito' : 'FTP sin cifrar'})...`);

let subidos = 0;
for (const local of archivos) {
    const remoto = relative(DIST, local).split('\\').join('/');
    try {
        execFileSync('curl', [
            '--silent', '--show-error', '--fail',
            '--connect-timeout', '20',
            ...(usaTLS ? ['--ssl-reqd'] : []),
            '--ftp-create-dirs',   // crea subcarpetas remotas que no existan (assets/, fonts/)
            '--upload-file', local,
            `${baseRemota}/${remoto}`,
            '--config', '-'
        ], { input: configCurl, stdio: ['pipe', 'inherit', 'inherit'] });
        subidos++;
        process.stdout.write(`\r[publish-dist] ${subidos}/${archivos.length} — ${remoto}${' '.repeat(20)}`);
    } catch (err) {
        console.error(`\n[publish-dist] Falló la subida de ${remoto}`);
        console.error('[publish-dist] Según lo que diga curl arriba:');
        console.error('[publish-dist]   (28) timeout / could not connect  → revisá DEPLOY_FTP_HOST (el nombre del servidor FTP, no el dominio del sitio).');
        console.error('[publish-dist]   (67) login denied                 → usuario o contraseña incorrectos.');
        console.error('[publish-dist]   AUTH / TLS / SSL                  → el hosting no acepta FTPS: poné DEPLOY_FTP_PLAIN=true en .env.local.');
        console.error('[publish-dist]   (9) access denied to remote dir   → DEPLOY_FTP_DIR no existe o el usuario no llega ahí.');
        process.exit(1);
    }
}
console.log(`\n[publish-dist] ${subidos} archivos subidos.`);

// ── Verificación ─────────────────────────────────────────────────────────
// El paso que faltaba. Sin esto el script sólo puede afirmar "mandé los
// archivos", que es exactamente lo que "git push" ya decía mientras
// producción llevaba días congelada.
const verificar = async () => {
    const url = `${DEPLOY_PUBLIC_URL.replace(/\/+$/, '')}/index.html?_cb=${Date.now()}`;
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} al pedir ${url}`);
    const html = await res.text();
    return html.match(/assets\/index-[^"']+\.js/)?.[0];
};

console.log(`[publish-dist] Verificando que ${DEPLOY_PUBLIC_URL} sirva ${bundleEsperado}...`);

// Algunos hostings tardan unos segundos en reflejar el archivo nuevo, así que
// se reintenta un rato antes de dar el deploy por fallido.
const INTENTOS = 6;
const ESPERA_MS = 5000;
let servido = null;

for (let i = 1; i <= INTENTOS; i++) {
    try {
        servido = await verificar();
        if (servido === bundleEsperado) break;
    } catch (err) {
        servido = `error: ${err instanceof Error ? err.message : err}`;
    }
    if (i < INTENTOS) await new Promise(r => setTimeout(r, ESPERA_MS));
}

if (servido !== bundleEsperado) {
    console.error('\n[publish-dist] ❌ EL DEPLOY NO LLEGÓ A PRODUCCIÓN.');
    console.error(`[publish-dist]    esperado: ${bundleEsperado}`);
    console.error(`[publish-dist]    servido : ${servido}`);
    console.error('[publish-dist] Los archivos se subieron pero la URL pública sigue devolviendo otro build.');
    console.error('[publish-dist] Revisá que DEPLOY_FTP_DIR apunte al docroot real del dominio.');
    process.exit(1);
}

console.log(`[publish-dist] ✅ Publicado y verificado: ${DEPLOY_PUBLIC_URL} sirve ${bundleEsperado}`);
