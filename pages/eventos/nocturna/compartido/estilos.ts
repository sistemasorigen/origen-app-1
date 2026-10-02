import React from 'react';

/**
 * Los tokens visuales del panel de Nocturna.
 *
 * Salen de `design-claude/Nocturna - Admin.dc.html`. La inscripción pública
 * tiene su propio juego porque su fondo es otro (#e9e7e3 contra #f6f6f4) y
 * porque es una pantalla de celular, no una planilla.
 */

export const INK = '#0a0a0a';
export const FONDO = '#f6f6f4';
export const CARTA = '#ffffff';
export const CAMPO = '#f2f2f0';
export const CAMPO_HONDO = '#f4f4f2';
export const CAMPO_CLARO = '#fafaf9';
export const BORDE = '#ecebe8';
export const BORDE_SUAVE = '#f4f4f2';

export const VERDE = '#12783f';
export const VERDE_FONDO = '#eaf6ee';
export const VERDE_PUNTO = '#16a34a';

export const AMBAR = '#fdf3e3';
export const AMBAR_INK = '#7a4f10';
export const AMBAR_BORDE = '#e8b96a';

export const ROJO = '#b42318';
export const ROJO_FONDO = '#fdecea';

export const GRIS = 'rgba(0,0,0,.6)';
export const GRIS_SUAVE = 'rgba(0,0,0,.55)';

export const fuente = (peso: number, tam: string, alto?: string): React.CSSProperties => ({
    font: `${peso} ${tam}${alto ? `/${alto}` : ''} Manrope, system-ui, sans-serif`,
});

/**
 * `index.html` pisa todos los input con `!important` y nueve `:not()`
 * encadenados. La única forma de ganarle es la columna de ids, así que todo
 * esto va scopeado por `#nocturna-panel`. Con clases de Tailwind no alcanza:
 * se escriben en el DOM y no pintan nada.
 */
export const ESTILOS_PANEL = `
    #nocturna-panel { color-scheme: light; }
    #nocturna-panel .campo {
        width: 100%;
        height: 48px;
        padding: 0 14px !important;
        border: 0 !important;
        border-radius: 14px !important;
        background-color: ${CAMPO_HONDO} !important;
        color: ${INK} !important;
        /* 16px: con menos, iOS hace zoom al enfocar. */
        font: 600 16px Manrope, system-ui, sans-serif !important;
        outline: none !important;
        box-shadow: none !important;
        -webkit-appearance: none;
        appearance: none;
    }
    #nocturna-panel .campo::placeholder { color: rgba(0,0,0,.42) !important; opacity: 1; }
    #nocturna-panel .campo:focus { box-shadow: 0 0 0 1.5px ${INK} inset !important; }
    #nocturna-panel .campo--claro { background-color: ${CARTA} !important; }
    #nocturna-panel .campo--alerta {
        background-color: ${AMBAR} !important;
        box-shadow: 0 0 0 1.5px ${AMBAR_BORDE} inset !important;
    }
    /* El buscador y el precio viven adentro de una píldora: sin fondo propio. */
    #nocturna-panel .campo--desnudo {
        height: auto !important;
        padding: 0 !important;
        border-radius: 0 !important;
        background-color: transparent !important;
        font-size: 15px !important;
    }
    #nocturna-panel .campo--desnudo:focus { box-shadow: none !important; }
    /* ── El visor del escáner ─────────────────────────────────────────
       html5-qrcode le escribe al contenedor y al <video> un alto calculado
       del aspecto de la cámara, con estilos inline. En una pantalla de
       puerta eso dejaba el video ocupando un tercio y el resto en negro.
       Se fuerza a que llene, recortando lo que sobra. */
    #nocturna-panel #nocturna-qr {
        /* position va con !important porque html5-qrcode le escribe
           "position: relative" inline al contenedor, y eso lo saca del
           absoluto: queda en el flujo, el alto en porcentaje no resuelve
           contra un padre de alto automático, y el visor terminaba midiendo
           lo que mide el video. */
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden;
    }
    #nocturna-panel #nocturna-qr video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
    }
    /* El recuadro sombreado que dibuja la librería: el marco es el del
       diseño, y dos marcos encimados confunden a quien apunta. */
    #nocturna-panel #nocturna-qr #qr-shaded-region { display: none !important; }

    #nocturna-panel .campo::-webkit-date-and-time-value { text-align: left; }
    #nocturna-panel .campo::-webkit-calendar-picker-indicator { opacity: .5; }
`;

/** La píldora de estado: "Aprobado 2/4" o "Inscripto". */
export const estiloEstado = (aprobado: boolean): React.CSSProperties => ({
    height: 28,
    padding: '0 11px',
    borderRadius: 999,
    background: aprobado ? VERDE_FONDO : CAMPO,
    color: aprobado ? VERDE : 'rgba(0,0,0,.62)',
    ...fuente(600, '12px'),
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flex: 'none',
    whiteSpace: 'nowrap',
});

export const estiloPunto = (aprobado: boolean): React.CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: 999,
    background: aprobado ? VERDE_PUNTO : '#a3a39e',
    flex: 'none',
});
