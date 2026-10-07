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

/**
 * El rosa de Nocturna, el mismo de la inscripción (estilo/tokens.ts). En el
 * panel se usa para destacar: el retiro de las 6 AM lleva este anillo en vez
 * del negro, que pesaba como un error.
 */
export const ROSA = '#E04497';

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
       puerta eso dejaba el video ocupando un tercio y el resto en negro, así
       que acá se lo hace tapar la pantalla —pero SIN cambiarle la relación de
       aspecto, y eso no es una preferencia de diseño—.

       html5-qrcode no lee del <video>: cada cuadro lo copia a un canvas del
       tamaño del elemento, y para saber qué parte copiar divide
       videoWidth / clientWidth en el eje X y videoHeight / clientHeight en el
       Y. Si la caja del video no tiene el aspecto del stream, esos dos
       factores no coinciden y el cuadro llega deformado al decodificador:
       ZXing descarta los patrones de posición cuando el módulo no mide lo
       mismo de ancho que de alto, así que la cámara no lee NADA. Pasó:
       forzar width/height al 100% con object-fit:cover dejó el escáner
       ciego, y se veía perfecto.

       Por eso la caja del video conserva su tamaño natural y el que la
       agranda hasta tapar la pantalla es un transform, que es puro dibujo y
       no toca el layout: clientWidth y clientHeight siguen siendo los del
       stream. La escala la calcula useEscanerQR, que es el único que sabe
       cuánto mide la cámara, y por eso el transform de acá abajo NO lleva
       !important: tiene que poder pisarlo desde el inline.

       Esto además es lo que hace que lea rápido. El lienzo mide lo que la
       caja, así que con la caja en su tamaño natural la copia es 1:1 y
       zxing trabaja sobre 640x480 en vez de sobre los 1125x844 de la
       pantalla. Medido con un cuadro sin QR —que es lo que la cámara mira
       mientras la persona apunta, o sea casi siempre—: 9 ms contra 48 ms.

       Dos invariantes, entonces:
         clientWidth / clientHeight === videoWidth / videoHeight
         y la caja no crece más allá del stream: agrandar el lienzo no
         agrega información, sólo trabajo. */
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
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        /* Sin !important y sin escala: el hook lo reemplaza por completo
           cuando sabe cuánto mide el stream. Mientras tanto, centrado. */
        transform: translate(-50%, -50%);
        transform-origin: center;
        /* El tamaño natural del stream. html5-qrcode le escribe el ancho del
           contenedor inline, de ahí el !important. */
        width: auto !important;
        height: auto !important;
        /* Techo, para que un celular que entregue 1080p no deje un lienzo de
           2 MP: cada cuadro costaría más que antes de todo esto. Recorta
           conservando el aspecto, que es el invariante que no se puede
           romper.

           960 y no 720: medido con una cámara de 720p y una entrada chica en
           el cuadro —la que se lee de más lejos—, con techo de 720 se
           pierde y con 960 se lee, por 4 ms más. Bajar más el techo ahorra
           milisegundos que no se notan y recorta el alcance, que sí. */
        max-width: 960px !important;
        max-height: 960px !important;
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
