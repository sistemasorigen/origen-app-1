// Genera los íconos de la app instalable (public/iconos/) a partir del isotipo.
//
// Se corrió una vez (28-oct-2026). Volver a correrlo sólo si cambia el logo:
//
//     node scripts/generar-iconos.mjs
//
// Por qué así: favicon.png mide 820×741 y no es cuadrado, y ni iPhone ni
// Android aceptan eso como ícono. No usa sharp ni ninguna librería de
// imágenes: el árbol de dependencias ya arrastra un conflicto de peers
// (react-joyride contra React 19) y cada paquete nuevo obliga a
// --legacy-peer-deps. Playwright ya está entre las devDependencies y su
// Chromium dibuja en un <canvas> igual que cualquier editor.
//
// Van en public/iconos/ y no en public/icons/: en el hosting, /icons/ es un
// alias global de Apache y nuestros archivos ahí daban 404.
//
// Qué sale:
//   · icon-192.png, icon-512.png  → "any": el isotipo blanco sobre negro,
//     ocupando el 62 % del ancho.
//   · icon-512-maskable.png       → Android recorta estos con la forma que
//     quiera (círculo, gota, cuadrado redondeado). La zona segura es el
//     círculo central del 80 %: el isotipo va al 48 % para que entre entero
//     en cualquier recorte, con un 20 % de margen de cada lado como mínimo.
//   · apple-touch-icon.png (180)  → SIN transparencia: el iPhone pinta de
//     negro lo transparente y redondea las esquinas él solo.
//   · badge-96.png                → el ícono chico de los push en Android:
//     isotipo blanco sobre transparente (Android usa sólo la forma).
//
// Fondo negro puro y marca blanca: el negro es el color primario de la app
// (los botones píldora del login), y en una pantalla de inicio llena de
// íconos claros es el que se encuentra de un vistazo.

import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(ROOT, 'public', 'iconos');
const LOGO = readFileSync(join(ROOT, 'public', 'favicon.png')).toString('base64');

const FONDO = '#000000';
const ICONOS = [
    { archivo: 'icon-192.png', lado: 192, marca: 0.62 },
    { archivo: 'icon-512.png', lado: 512, marca: 0.62 },
    { archivo: 'icon-512-maskable.png', lado: 512, marca: 0.48 },
    { archivo: 'apple-touch-icon.png', lado: 180, marca: 0.62 },
    // El ícono chico de las notificaciones push (public/sw.js): Android lo
    // pinta en la barra de estado usando sólo su forma, así que va el
    // isotipo blanco sobre transparente, casi a tamaño completo.
    { archivo: 'badge-96.png', lado: 96, marca: 0.84, transparente: true },
];

mkdirSync(SALIDA, { recursive: true });

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

for (const { archivo, lado, marca, transparente = false } of ICONOS) {
    const dataUrl = await pagina.evaluate(async ({ logo, lado, marca, fondo }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${logo}`;
        await img.decode();

        // La caja real del isotipo: el PNG trae aire transparente alrededor,
        // y centrar el archivo entero lo dejaría corrido.
        const c0 = document.createElement('canvas');
        c0.width = img.width; c0.height = img.height;
        const x0 = c0.getContext('2d');
        x0.drawImage(img, 0, 0);
        const { data } = x0.getImageData(0, 0, img.width, img.height);
        let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                if (data[(y * img.width + x) * 4 + 3] > 16) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        const w = maxX - minX + 1, h = maxY - minY + 1;

        // La marca en blanco: se dibuja y se tiñe por composición, así los
        // bordes suavizados del original se conservan.
        const cm = document.createElement('canvas');
        cm.width = w; cm.height = h;
        const xm = cm.getContext('2d');
        xm.drawImage(img, minX, minY, w, h, 0, 0, w, h);
        // El favicon tiene una manchita apenas transparente dentro del lóbulo
        // de arriba —en negro no se ve, en blanco sobre negro sí—. Se lleva a
        // opaco todo lo que ya es casi opaco; los bordes suavizados quedan.
        const px = xm.getImageData(0, 0, w, h);
        for (let i = 3; i < px.data.length; i += 4) {
            const a = px.data[i];
            px.data[i] = a >= 200 ? 255 : Math.round(a * 255 / 200);
        }
        xm.putImageData(px, 0, 0);
        xm.globalCompositeOperation = 'source-in';
        xm.fillStyle = '#ffffff';
        xm.fillRect(0, 0, w, h);

        const c = document.createElement('canvas');
        c.width = lado; c.height = lado;
        const x = c.getContext('2d');
        if (fondo) {
            x.fillStyle = fondo;
            x.fillRect(0, 0, lado, lado);
        }
        const escala = (lado * marca) / Math.max(w, h);
        const dw = w * escala, dh = h * escala;
        x.imageSmoothingQuality = 'high';
        x.drawImage(cm, (lado - dw) / 2, (lado - dh) / 2, dw, dh);
        return c.toDataURL('image/png');
    }, { logo: LOGO, lado, marca, fondo: transparente ? null : FONDO });

    writeFileSync(join(SALIDA, archivo), Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`[generar-iconos] ${archivo} (${lado}×${lado})`);
}

await navegador.close();
