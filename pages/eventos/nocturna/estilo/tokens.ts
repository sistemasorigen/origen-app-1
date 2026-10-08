import type React from 'react';

/**
 * El lenguaje visual de Nocturna (design-claude/Nocturna - Inscripcion.dc.html).
 *
 * Tres colores y nada más: el rosa del flyer de fondo, el lima de las
 * tarjetas, y el negro de la tinta. Sin grises: un texto que
 * tiene que leerse menos se achica o se aligera, no se destiñe. Sobre el rosa
 * un negro al 60% no llega al contraste mínimo.
 */
export const ROSA = '#E04497';
/**
 * Las dos vetas del fondo, medidas sobre el flyer
 * (design-claude/uploads/nocturna_APP 1920x1080.jpg).
 *
 * Ahí el campo es un coral apagado (#E06E82, el 78% de la imagen) manchado
 * de un rosa más magenta (#E272B3, el 13%): las manchas casi no son más
 * claras —0,32 de luminancia contra 0,29— pero están 24° corridas de tono, y
 * eso solo ya las hace leer como luz.
 *
 * Acá el campo es el rosa de la app, que ya es el magenta; las manchas van
 * para el otro lado, al coral del flyer, y una veta honda da el gastado.
 */
export const ROSA_CLARO = '#FA93B8';
export const ROSA_HONDO = '#B02C78';
export const LIMA = '#DBE479';
export const NEGRO = '#000000';
export const BLANCO = '#ffffff';

/**
 * Archivo para todo, Bagel Fat One sólo para la palabra de fondo.
 * Se sirven desde /fonts (ver fuentes.ts): la política de seguridad de la
 * página bloquea Google Fonts.
 */
export const FUENTE = "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FUENTE_PALABRA = "'Bagel Fat One', Archivo, system-ui, sans-serif";

export const arch = (peso: number, tam: string, alto?: string): React.CSSProperties => ({
    font: `${peso} ${tam}${alto ? `/${alto}` : ''} ${FUENTE}`,
});

/** El borde de todo: un anillo hacia adentro, que no cambia el tamaño de la caja. */
export const anillo = (grosor = 2.5, color = NEGRO) => `inset 0 0 0 ${grosor}px ${color}`;

/** La curva de las entradas y de las respuestas a un toque. */
export const CURVA = 'cubic-bezier(.2,.8,.2,1)';

/**
 * Los cortes de pantalla.
 *  · ESCRITORIO: la columna crece, los títulos también, el pie pasa a píldora.
 *  · ESQUINAS: aparecen las cuatro esquinas fijas del diseño de escritorio, y
 *    se va la fila de "NOCTURNA" de arriba. Más angosto que esto, las
 *    esquinas de abajo se meten debajo del pie.
 */
export const ESCRITORIO = 1024;
export const ESQUINAS = 1200;
