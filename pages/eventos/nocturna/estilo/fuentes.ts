import { preload } from 'react-dom';

/**
 * Las fuentes de Nocturna, servidas desde el propio sitio.
 *
 * El diseño las pide a Google Fonts, pero la política de seguridad de la
 * página (index.html) no deja conectarse ahí, y en el navegador de Instagram
 * o con poca señal una fuente de afuera puede no llegar nunca. Van en
 * public/fonts, sólo con el juego latino —trae todo lo del español: á é í ó
 * ú ü ñ ¿ ¡—, en woff2. Las dos son de licencia libre (SIL Open Font License).
 *
 * Archivo va en cinco archivos, uno por peso de los que usa el diseño (500
 * a 900), y no en el archivo variable de Google. El variable pesa menos (35
 * KB contra 71), pero el WebKit de las pruebas lo dibujaba en un peso
 * intermedio, sin el negro del diseño: lo que se ve en el iPhone tiene que
 * poder verificarse. Los cinco salen del mismo variable de Google
 * (fontTools, varLib.instancer). El navegador baja sólo los pesos que la
 * pantalla usa: la portada, tres.
 *
 *   archivo-500-latin.woff2   14,6 KB     archivo-800-latin.woff2   14,4 KB
 *   archivo-600-latin.woff2   13,8 KB     archivo-900-latin.woff2   13,5 KB
 *   archivo-700-latin.woff2   14,5 KB     bagel-fat-one-latin.woff2 24,4 KB
 *
 * Se declaran acá y no en index.html para que no carguen en el resto de la
 * app: sólo las baja quien abre esta página.
 */
const PESOS = [500, 600, 700, 800, 900] as const;
const archivo = (peso: number) => `/fonts/archivo-${peso}-latin.woff2`;
export const BAGEL_URL = '/fonts/bagel-fat-one-latin.woff2';

export const FUENTES_CSS = `
${PESOS.map(p => `@font-face {
    font-family: 'Archivo';
    font-style: normal;
    font-weight: ${p};
    font-display: swap;
    src: url('${archivo(p)}') format('woff2');
}`).join('\n')}
@font-face {
    font-family: 'Bagel Fat One';
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url('${BAGEL_URL}') format('woff2');
}
`;

/**
 * Precarga del peso de los títulos, el primero que se ve. Con React 19
 * `preload` se puede llamar al renderizar: React lo sube al <head> una sola
 * vez, aunque se llame en cada render.
 */
export const precargarFuentes = () => {
    preload(archivo(900), { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
};
