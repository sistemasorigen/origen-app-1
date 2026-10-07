import { ANIMACIONES_CSS } from './animaciones';
import { FUENTES_CSS } from './fuentes';
import { ESCRITORIO, ESQUINAS, FUENTE, FUENTE_PALABRA, LIMA, NEGRO, ROSA, anillo } from './tokens';

/**
 * El CSS de la página, en un solo <style>.
 *
 * Va todo bajo #nocturna-inscripcion. No es prolijidad: index.html pisa
 * todos los input con !important y una cadena de nueve :not(), y lo único
 * que le gana es la columna de ids. Con clases de Tailwind no alcanza.
 *
 * Mobile primero. A partir de ESCRITORIO (1024 px, el `lg` de la app) la
 * columna crece y el pie pasa a ser una píldora; a partir de ESQUINAS
 * (1200 px) aparecen las cuatro esquinas fijas del diseño de escritorio.
 */
export const ESTILOS_NOCTURNA = `
${FUENTES_CSS}
${ANIMACIONES_CSS}

#nocturna-inscripcion {
    color-scheme: light;
    position: relative;
    background: ${ROSA};
    color: ${NEGRO};
    font-family: ${FUENTE};
    -webkit-font-smoothing: antialiased;
    /* La barra de la app (64 px) va transparente encima: el Layout sube la
       página 64 px para que el rosa llegue al borde de arriba (ver
       useFullBleedHero en InscripcionNocturna), y este padding deja el
       contenido debajo de la barra. dvh, con vh de respaldo para iOS
       anterior al 15.4. */
    padding-top: 64px;
    min-height: 100vh;
    min-height: 100dvh;
    /* El fondo es fijo y la palabra es más ancha que cualquier pantalla. */
    overflow-x: clip;
}
#nocturna-inscripcion button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
#nocturna-inscripcion .noc-boton { transition: transform .12s ease; }
/* El toque se ve: el botón se hunde un poco. Nada depende del hover. */
#nocturna-inscripcion .noc-boton:active:not(:disabled) { transform: scale(.98); }
#nocturna-inscripcion :focus-visible { outline: 3px solid ${NEGRO}; outline-offset: 3px; }
#nocturna-inscripcion .noc-sobre-negro:focus-visible,
#nocturna-inscripcion .noc-pie :focus-visible { outline-color: ${LIMA}; }

/* ── El fondo ─────────────────────────────────────────────────────────── */
#nocturna-inscripcion .noc-fondo {
    position: fixed;
    left: 0; right: 0; top: 0; bottom: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
}
#nocturna-inscripcion .noc-palabra {
    position: absolute; left: 0; right: 0;
    top: 300px;
    display: flex; justify-content: center;
    --blur-a: 22px; --blur-b: 8px;
}
/* En la portada la palabra va detrás del árbol, no del título, y se lee
   entera: del ancho de la pantalla y con menos desenfoque (proporcional al
   tamaño). El centro de la palabra queda a la altura del centro del árbol
   (133 px): la caja mide .86 del tamaño de letra. */
#nocturna-inscripcion .noc-palabra.portada {
    --tam-portada: 16vw;
    top: calc(133px - var(--tam-portada) * .43);
    --blur-a: 8px; --blur-b: 3px;
}
#nocturna-inscripcion .noc-palabra.portada .noc-palabra-texto { font-size: var(--tam-portada); }
#nocturna-inscripcion .noc-palabra-texto {
    display: block;
    font: 400 190px/0.86 ${FUENTE_PALABRA};
    color: ${LIMA};
    white-space: nowrap;
    letter-spacing: -.02em;
}
#nocturna-inscripcion .noc-palabra-capa { position: absolute; inset: 0; }
#nocturna-inscripcion .noc-palabra-cursor { transition: transform .5s cubic-bezier(.2,.7,.2,1); }
#nocturna-inscripcion .noc-palabra-escala { transition: transform 1.4s cubic-bezier(.2,.7,.2,1); }
#nocturna-inscripcion .noc-palabra-fundido { transition: opacity 1.4s ease; }

/* Detrás de la barra transparente, una franja del mismo rosa: lo que se
   scrollea pasa por debajo y no se ve atrás del logo. La barra queda encima
   (z-index 30 del Layout). */
#nocturna-inscripcion .noc-tapa-barra {
    position: fixed; left: 0; right: 0; top: 0; height: 64px; z-index: 22;
    background: ${ROSA};
    pointer-events: none;
    /* Adentro va una copia del fondo (la palabra), fija igual que el
       original: como las dos se miden contra la pantalla, coinciden al
       píxel y la franja no se nota. contain: paint la recorta a estos 64 px
       y hace que el fixed de adentro se mida contra la franja, que está en
       el mismo lugar que la pantalla. */
    contain: paint;
}

/* ── El contenido ─────────────────────────────────────────────────────── */
#nocturna-inscripcion .noc-contenido { position: relative; z-index: 1; }

/* Arriba, en el teléfono: los pasos. Queda pegado debajo de la barra
   mientras se scrollea, como en el diseño, donde esa franja no se mueve y lo
   que corre es lo de abajo. */
#nocturna-inscripcion .noc-cabecera {
    position: sticky; top: 64px; z-index: 20;
    background: ${ROSA};
}
#nocturna-inscripcion .noc-fila-marca {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding: 16px 18px 0;
}
#nocturna-inscripcion .noc-marca { margin: 0; font: 900 32px/0.9 ${FUENTE}; letter-spacing: -.065em; text-transform: uppercase; }
#nocturna-inscripcion .noc-a-quien {
    margin: 2px 0 0; max-width: 58%; text-align: right;
    font: 800 11.5px/1.2 ${FUENTE}; letter-spacing: -.01em; text-transform: uppercase;
}
#nocturna-inscripcion .noc-columna { width: 100%; margin: 0 auto; }
#nocturna-inscripcion .noc-progreso { padding: 12px 18px 10px; }
#nocturna-inscripcion .noc-cuerpo { padding: 14px 18px 30px; }
#nocturna-inscripcion .noc-cuerpo.portada { padding-top: 6px; }

/* Las cuatro esquinas del escritorio: sólo en pantallas anchas. */
#nocturna-inscripcion .noc-esquina { display: none; }

/* ── Títulos ──────────────────────────────────────────────────────────── */
#nocturna-inscripcion .noc-titulo {
    margin: 0;
    font: 900 36px/0.92 ${FUENTE};
    letter-spacing: -.06em;
    text-transform: uppercase;
    overflow-wrap: anywhere;
}
#nocturna-inscripcion .noc-titulo.portada { font-size: 40px; }
#nocturna-inscripcion .noc-titulo .palabra { display: inline-block; white-space: nowrap; }
#nocturna-inscripcion .noc-titulo .letra { display: inline-block; }

/* ── Campos ───────────────────────────────────────────────────────────── */
#nocturna-inscripcion .noc-campo {
    width: 100%; min-width: 0;
    height: 58px;
    padding: 0 18px !important;
    border: 0 !important;
    border-radius: 18px !important;
    background-color: ${LIMA} !important;
    color: ${NEGRO} !important;
    box-shadow: inset 0 0 0 2px ${NEGRO} !important;
    /* 17 px: con menos de 16 iOS hace zoom al tocar el campo y desarma la
       pantalla. */
    font: 700 17px ${FUENTE} !important;
    outline: none !important;
    -webkit-appearance: none;
    appearance: none;
}
#nocturna-inscripcion .noc-campo::placeholder { color: rgba(0,0,0,.62) !important; opacity: 1; font-weight: 600; }
#nocturna-inscripcion .noc-campo:focus { box-shadow: inset 0 0 0 3.5px ${NEGRO} !important; }
#nocturna-inscripcion .noc-campo::-webkit-date-and-time-value { text-align: left; }
#nocturna-inscripcion .noc-campo::-webkit-calendar-picker-indicator { opacity: .7; }
/* Al enfocar un campo, el navegador lo trae a la vista dejando lugar para
   la cabecera de arriba y el pie de abajo. */
#nocturna-inscripcion input, #nocturna-inscripcion select, #nocturna-inscripcion textarea {
    scroll-margin-top: 140px;
    scroll-margin-bottom: 140px;
}

/* ── Piezas de las pantallas ────────────────────────────────────────── */
#nocturna-inscripcion .noc-arbol-marco { display: flex; justify-content: center; margin-top: 10px; }
#nocturna-inscripcion .noc-arbol {
    display: block; width: 120px; height: auto;
    animation: nocVaiven 4s ease-in-out infinite;
}
#nocturna-inscripcion .noc-sonrisa {
    display: inline-block;
    font: 900 72px/1 ${FUENTE}; letter-spacing: -.04em;
    animation: nocSonrisa .7s cubic-bezier(.2,.8,.2,1.3) .3s both;
}
/* La entrada: el QR arriba y el talón abajo, separados por un perforado.
   En escritorio, lado a lado. */
#nocturna-inscripcion .noc-entrada {
    position: relative; z-index: 1;
    margin-top: 22px;
    display: grid; grid-template-columns: minmax(0, 1fr);
    border-radius: 30px; overflow: hidden;
    box-shadow: 0 0 0 2.5px ${NEGRO};
}
#nocturna-inscripcion .noc-entrada-talon {
    background: ${LIMA};
    padding: 20px 22px 22px;
    border-top: 3px dashed ${NEGRO};
}
/* Lo que vino de la cuenta: borde punteado. Al editarlo vuelve al borde
   lleno (la clase sale) y la etiqueta pasa a "editado". */
#nocturna-inscripcion .noc-campo.de-la-cuenta {
    border: 2px dashed ${NEGRO} !important;
    box-shadow: none !important;
}
#nocturna-inscripcion .noc-campo.de-la-cuenta:focus { box-shadow: inset 0 0 0 2px ${NEGRO} !important; }
/* La fecha que deja afuera al adulto (menor de 18). */
#nocturna-inscripcion .noc-campo.alerta { box-shadow: inset 0 0 0 4px ${NEGRO} !important; }

/* La palabra de fondo vuelve con un golpe al responder (ver Fondo.tsx). */
#nocturna-inscripcion .noc-palabra-fundido.encendida { animation: nocEncendido 1s cubic-bezier(.2,.8,.2,1); }

/* Dos columnas en escritorio, una en el teléfono. */
#nocturna-inscripcion .noc-grilla { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
/* Siempre dos (Sí / No). */
#nocturna-inscripcion .noc-grilla.fija { grid-template-columns: repeat(2, minmax(0, 1fr)); }

/* Los títulos más chicos: la pregunta larga de la comida y las salidas. */
#nocturna-inscripcion .noc-titulo.chico { font-size: 30px; }
#nocturna-inscripcion .noc-titulo.serio { font-size: 34px; }

/* El texto legal: más grande y con más aire que el resto, para leerlo. */
#nocturna-inscripcion .noc-legal {
    margin: 16px 0 0;
    font: 600 17px/1.62 ${FUENTE};
    text-wrap: pretty;
}
#nocturna-inscripcion .noc-total {
    margin: 8px 0 0;
    font: 900 54px/.95 ${FUENTE}; letter-spacing: -.055em;
    color: ${LIMA}; overflow-wrap: anywhere;
}
/* La subida no informa cuánto lleva: la barra va y viene (nocEspera). */
#nocturna-inscripcion .noc-espera {
    position: relative; height: 14px; margin-top: 14px;
    border-radius: 999px; overflow: hidden;
    box-shadow: inset 0 0 0 2px ${NEGRO};
}
#nocturna-inscripcion .noc-espera > span {
    position: absolute; top: 0; bottom: 0; left: 0; width: 40%;
    border-radius: 999px; background: ${NEGRO};
    animation: nocEspera 1.1s ease-in-out infinite;
    will-change: transform;
}

#nocturna-inscripcion .noc-deshacer {
    position: fixed; left: 16px; right: 16px; z-index: 30;
    bottom: calc(104px + env(safe-area-inset-bottom));
    display: flex; justify-content: center; pointer-events: none;
}

/* ── Los diálogos ─────────────────────────────────────────────────────── */
/* Por encima del pie (25) y del deshacer (30): mientras hay un diálogo no se
   toca nada de atrás. */
#nocturna-inscripcion .noc-hoja-fondo {
    position: fixed; inset: 0; z-index: 40;
    background: rgba(0, 0, 0, .55);
    display: flex; align-items: flex-end; justify-content: center;
    animation: nocFundido .25s ease-out;
}
#nocturna-inscripcion .noc-hoja {
    width: 100%; max-height: 100%; overflow: auto;
    border-radius: 32px 32px 0 0;
    padding: 24px 20px calc(30px + env(safe-area-inset-bottom));
    animation: nocHoja .35s cubic-bezier(.2, .8, .2, 1);
}

/* Lo de adentro de un diálogo. Las medidas son las del diseño; el color lo
   pone Hoja.tsx, que es el que sabe de qué tono es la noticia. */
#nocturna-inscripcion .noc-dlg-titulo {
    margin: 12px 0 0;
    font: 900 30px/0.95 ${FUENTE};
    letter-spacing: -.055em;
    text-transform: uppercase;
}
#nocturna-inscripcion .noc-dlg-texto { margin: 14px 0 0; font: 600 15px/1.5 ${FUENTE}; }
/* La línea de arriba separa la buena noticia de la letra chica. */
#nocturna-inscripcion .noc-dlg-nota {
    margin: 14px 0 0; padding-top: 12px;
    border-top: 2px solid currentColor;
    font: 600 14px/1.5 ${FUENTE};
}
#nocturna-inscripcion .noc-dlg-rotulo {
    margin: 0; font: 900 13px ${FUENTE}; letter-spacing: -.01em; text-transform: uppercase;
}
#nocturna-inscripcion .noc-sonrisa-dlg {
    display: inline-block;
    font: 900 54px/1 ${FUENTE}; letter-spacing: -.04em;
    animation: nocSonrisa .7s cubic-bezier(.2,.8,.2,1.3) .3s both;
}

/* ── Cargando, sin conexión y cerradas ────────────────────────────────── */
#nocturna-inscripcion .noc-estado {
    min-height: 72vh;
    display: flex; flex-direction: column; align-items: stretch; justify-content: center;
    text-align: center;
}
#nocturna-inscripcion .noc-cargando {
    margin: 0; font: 900 44px/0.9 ${FUENTE}; letter-spacing: -.065em; text-transform: uppercase;
}
#nocturna-inscripcion .noc-cargando .letra { display: inline-block; }
#nocturna-inscripcion .noc-estado-texto {
    margin: 16px auto 0; max-width: 400px;
    font: 700 17px/1.45 ${FUENTE}; letter-spacing: -.015em;
}
#nocturna-inscripcion .noc-estado-fecha {
    margin: 14px 0 0; font: 800 14px/1.3 ${FUENTE}; letter-spacing: -.025em; text-transform: uppercase;
}
/* La caja lima de abajo: es la que sostiene la única salida que queda. */
#nocturna-inscripcion .noc-estado-caja {
    margin-top: 22px; border-radius: 30px; padding: 20px;
    background: ${LIMA}; box-shadow: ${anillo(2.5)};
}

/* ── El pie ───────────────────────────────────────────────────────────── */
#nocturna-inscripcion .noc-pie {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 25;
    background: ${NEGRO};
    padding: 14px 18px calc(20px + env(safe-area-inset-bottom));
    transition: transform .2s ease;
}
/* Con el teclado abierto el pie se va (ver Pie.tsx): si no, queda flotando
   encima del teclado o tapa el campo que se está escribiendo. */
#nocturna-inscripcion .noc-pie.con-teclado { transform: translateY(110%); }
#nocturna-inscripcion .noc-con-pie { padding-bottom: calc(132px + env(safe-area-inset-bottom)); }

/* ── Escritorio ───────────────────────────────────────────────────────── */
@media (min-width: ${ESCRITORIO}px) {
    #nocturna-inscripcion .noc-palabra { top: 200px; --blur-a: 34px; --blur-b: 12px; }
    #nocturna-inscripcion .noc-palabra.portada {
        --tam-portada: min(14.5vw, 330px);
        top: calc(149px - var(--tam-portada) * .43);
        --blur-a: 20px; --blur-b: 7px;
    }
    #nocturna-inscripcion .noc-palabra-texto { font-size: 330px; }
    #nocturna-inscripcion .noc-cabecera { position: static; background: transparent; }
    #nocturna-inscripcion .noc-columna { max-width: 520px; }
    #nocturna-inscripcion .noc-columna.ancha { max-width: 620px; }
    #nocturna-inscripcion .noc-progreso { padding: 0 20px; }
    #nocturna-inscripcion .noc-cuerpo { padding: 18px 20px 24px; }
    /* 16 px arriba: el árbol sube 8 px con el vaivén y no puede meterse
       debajo de la barra. */
    #nocturna-inscripcion .noc-cuerpo.portada { padding: 16px 20px 60px; }
    #nocturna-inscripcion .noc-titulo { font-size: 54px; }
    #nocturna-inscripcion .noc-titulo.portada { font-size: 54px; }
    #nocturna-inscripcion .noc-titulo.chico,
    #nocturna-inscripcion .noc-titulo.serio { font-size: 46px; }
    #nocturna-inscripcion .noc-grilla { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #nocturna-inscripcion .noc-legal { font-size: 18px; }
    #nocturna-inscripcion .noc-total { font-size: 64px; }
    /* Centrado con márgenes y no con transform: el transform lo usa la regla
       del teclado de arriba (una tablet táctil también llega a este ancho). */
    #nocturna-inscripcion .noc-pie {
        left: 20px; right: 20px; bottom: 24px;
        max-width: 560px; margin: 0 auto;
        border-radius: 28px;
        padding: 16px 22px;
    }
    #nocturna-inscripcion .noc-con-pie { padding-bottom: 150px; }
    #nocturna-inscripcion .noc-arbol-marco { margin-top: 0; }
    #nocturna-inscripcion .noc-arbol { width: 150px; }
    #nocturna-inscripcion .noc-sonrisa { font-size: 96px; }
    #nocturna-inscripcion .noc-entrada { grid-template-columns: 284px minmax(0, 1fr); }
    #nocturna-inscripcion .noc-entrada-talon { border-top: 0; border-left: 3px dashed ${NEGRO}; }
    #nocturna-inscripcion .noc-deshacer { bottom: 136px; }
    /* En escritorio el diálogo deja de ser un cajón y se centra. */
    #nocturna-inscripcion .noc-cargando { font-size: 72px; }
    #nocturna-inscripcion .noc-hoja-fondo { align-items: center; padding: 24px; }
    #nocturna-inscripcion .noc-hoja {
        max-width: 480px;
        border-radius: 32px;
        padding: 26px 26px 24px;
    }
}
@media (min-width: ${ESQUINAS}px) {
    #nocturna-inscripcion .noc-fila-marca,
    #nocturna-inscripcion .noc-sin-esquinas { display: none; }
    #nocturna-inscripcion .noc-esquina {
        display: block; position: fixed; z-index: 1; margin: 0;
        color: ${NEGRO}; transition: opacity 1.2s ease;
        font: 800 20px/1.15 ${FUENTE}; letter-spacing: -.035em; text-transform: uppercase;
    }
    #nocturna-inscripcion .noc-esquina.marca { left: 48px; top: 32px; font: 900 64px/0.9 ${FUENTE}; letter-spacing: -.065em; }
    #nocturna-inscripcion .noc-esquina.a-quien { right: 48px; top: 36px; max-width: 360px; text-align: right; }
    #nocturna-inscripcion .noc-esquina.fecha { left: 48px; bottom: 40px; }
    #nocturna-inscripcion .noc-esquina.redes { right: 48px; bottom: 40px; text-align: right; }
}
`;
