// Capturas del diseño (design-claude/Nocturna - Inscripcion.dc.html), para
// ponerlas al lado de las de la implementación.
//
//   node tests/nocturna-golden/herramientas/capturar-diseno.mjs [carpeta-de-salida]
//
// Sirve design-claude/ en un puerto local (el .dc necesita support.js y no
// abre desde file://), maneja la barra de demo del lienzo y recorta el marco
// del teléfono o del escritorio.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../design-claude');
const SALIDA = path.resolve(process.argv[2] || path.join(AQUI, '../capturas-diseno'));
const PUERTO = 5288;

const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
const servidor = http.createServer((q, r) => {
    const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => {
        if (e) { r.writeHead(404); r.end(); return; }
        r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'application/octet-stream' });
        r.end(d);
    });
}).listen(PUERTO);

// Cada captura: qué botones de la barra de demo tocar, en orden.
const ESTADOS = {
    '00-bienvenida': ['0 · Bienvenida'],
    '00b-bienvenida-con-sesion': ['Con sesión', '0 · Bienvenida'],
    '02-chicos': ['3 chicos', '2 · Chicos'],
    '02b-chicos-uno': ['1 chico', '2 · Chicos'],
    '02c-sumando': ['Sumando chicos', '2 · Chicos'],
    '08-entrada': ['3 chicos', '8 · Entrada'],
    '20-cerrada': ['Cerrada'],
    '21-cargando': ['Cargando'],
    '22-sin-conexion': ['Sin conexión'],
};

const navegador = await chromium.launch();
fs.mkdirSync(SALIDA, { recursive: true });

for (const vista of ['Mobile', 'Desktop']) {
    for (const [nombre, toques] of Object.entries(ESTADOS)) {
        const page = await navegador.newPage({ viewport: { width: 1340, height: 1000 }, deviceScaleFactor: 2 });
        await page.goto(`http://localhost:${PUERTO}/Nocturna%20-%20Inscripcion.dc.html`);
        await page.waitForTimeout(1500);
        await page.getByRole('button', { name: vista, exact: true }).click();
        for (const t of toques) {
            await page.getByRole('button', { name: t, exact: true }).first().click();
            await page.waitForTimeout(350);
        }
        await page.waitForTimeout(1600); // que terminen las entradas y el confeti
        // El marco: el div rosa del tamaño del dispositivo (390×844 o 1280×800).
        const caja = await page.evaluate(() => {
            const el = [...document.querySelectorAll('div')].find(d => {
                const c = getComputedStyle(d);
                return c.backgroundColor === 'rgb(224, 68, 151)' && (d.offsetWidth === 390 || d.offsetWidth === 1280);
            });
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
        });
        const destino = path.join(SALIDA, `${vista === 'Mobile' ? 'iphone' : 'desktop'}--${nombre}.png`);
        await page.screenshot({ path: destino, fullPage: true, ...(caja ? { clip: caja } : {}) });
        await page.close();
    }
}
await navegador.close();
servidor.close();
console.log('capturas en', SALIDA);
