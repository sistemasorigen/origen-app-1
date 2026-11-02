import React, { useEffect, useRef, useState } from 'react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import type { Anfitrion } from '../../services/testimonios';

/**
 * Piezas de los testimonios de los GCX, compartidas por /testimonios-gcx
 * (dejar un testimonio) y por /testimonios y su detalle (prompt 3).
 *
 * Todo sale de los dos diseños de Claude Design
 * (design-claude/GCX Testimonios - *.dc.html): los mismos colores, radios,
 * tamaños y animaciones. El inventario está en
 * design-claude/INVENTARIO-TESTIMONIOS-GCX.md.
 */

// ── Estilos ──────────────────────────────────────────────────────────────

/** El contenedor de cada pantalla: los estilos de abajo se cuelgan de este id. */
export const ID_TESTIMONIOS = 'testimonios-gcx';

/*
 * index.html les pone a TODOS los campos fondo, borde y foco propios con
 * !important —(0,8,1) por la cadena de :not()—. Con un id adelante estas
 * reglas quedan en (1,0,1) y ganan. Las animaciones son las del diseño (tIn,
 * tShake, tCircle…), con prefijo para no chocar con otras de la app, y se
 * apagan con prefers-reduced-motion, como en el diseño.
 */
export const ESTILOS = `
#${ID_TESTIMONIOS} { color: #0a0a0a; }
/* Todo en Manrope: los h1-h4 de la app llevan otra familia con !important. */
#${ID_TESTIMONIOS}, #${ID_TESTIMONIOS} * { font-family: Manrope, system-ui, sans-serif !important; }
#${ID_TESTIMONIOS} :focus { outline: none; }
#${ID_TESTIMONIOS} :focus-visible { outline: 2.5px solid #0a0a0a; outline-offset: 3px; }
#${ID_TESTIMONIOS} textarea, #${ID_TESTIMONIOS} input {
  background: transparent !important; color: #0a0a0a !important; border: 0 !important;
  border-radius: 20px !important; box-shadow: none !important; outline: none !important;
}
#${ID_TESTIMONIOS} textarea::placeholder { color: rgba(0,0,0,.38) !important; opacity: 1; }
@keyframes tstIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
@keyframes tstFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes tstSpin { to { transform: rotate(360deg) } }
@keyframes tstPulse { 0%, 100% { opacity: 1 } 50% { opacity: .5 } }
@keyframes tstCircle { from { stroke-dashoffset: 151 } to { stroke-dashoffset: 0 } }
@keyframes tstCheck { from { stroke-dashoffset: 36 } to { stroke-dashoffset: 0 } }
@keyframes tstShake { 0%, 100% { transform: none } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
/* El corazón que salta, el número que rueda y el resaltado de un testimonio
   al que se entró por un link compartido (tPop, tRoll y tHl del diseño). */
@keyframes tstPop { 0% { transform: scale(1) } 35% { transform: scale(1.35) } 70% { transform: scale(.9) } 100% { transform: scale(1) } }
@keyframes tstRoll { from { opacity: 0; transform: translateY(60%) } to { opacity: 1; transform: none } }
@keyframes tstHl { 0% { opacity: 0 } 10% { opacity: 1 } 75% { opacity: 1 } 100% { opacity: 0 } }
@media (prefers-reduced-motion: reduce) {
  #${ID_TESTIMONIOS} *, #${ID_TESTIMONIOS} *::before, #${ID_TESTIMONIOS} *::after { animation: none !important; transition: none !important; }
}
`;

/** Colores del diseño. */
export const C = {
    tinta: '#0a0a0a',
    fondo: '#f6f6f4',
    gris: '#f2f2f0',
    m38: 'rgba(0,0,0,.38)',
    m52: 'rgba(0,0,0,.52)',
    m62: 'rgba(0,0,0,.62)',
    rojo: '#b42318',
    rojoFondo: '#fdecea',
    ambar: '#8a5200',
    ambarBorde: '#c08a2e',
    esqueleto: '#ebeae6',
} as const;

/** Los pasteles de los avatares sin foto, en el orden del diseño. */
export const PASTELES = ['#e3ece5', '#efe6dc', '#e2e6ee', '#ece4ea', '#e9e7dc'];

/** Las portadas de reemplazo cuando el GCX no tiene foto (los degradés del diseño). */
const PORTADAS = [
    'radial-gradient(circle at 28% 32%, #f3c9a8 0 18%, transparent 19%), radial-gradient(circle at 72% 70%, #c9d6c3 0 26%, transparent 27%), linear-gradient(135deg, #efe4d6, #e2d2bf)',
    'radial-gradient(circle at 76% 24%, #f1e3b5 0 15%, transparent 16%), linear-gradient(160deg, #d9c3a5 0 46%, #b9946d 46% 52%, #e9dfd2 52%)',
    'radial-gradient(ellipse at 30% 82%, #b8c6d9 0 30%, transparent 31%), radial-gradient(circle at 72% 30%, #e7c0b4 0 20%, transparent 21%), linear-gradient(135deg, #e3e7ee, #cfd6e2)',
];

/** El rótulo de 11px del diseño ("TU TESTIMONIO", "¿EN QUÉ GCX?"…). */
export const ROTULO: React.CSSProperties = {
    margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: C.m38,
};

/** Botones del diseño. `alto` 64 en las acciones del formulario, 56–58 en las pantallas. */
export const botonNegro = (alto: number, apagado = false): React.CSSProperties => ({
    width: '100%', height: alto, padding: '0 24px', border: 0, borderRadius: 999,
    background: C.tinta, color: '#fff', fontSize: alto >= 64 ? 17 : 16, fontWeight: 700,
    cursor: 'pointer', opacity: apagado ? 0.3 : 1, transition: 'opacity .2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
});
export const botonGris = (alto: number): React.CSSProperties => ({
    width: '100%', height: alto, padding: '0 24px', border: 0, borderRadius: 999,
    background: C.gris, color: C.m62, fontSize: alto >= 64 ? 17 : 16, fontWeight: 700, cursor: 'pointer',
});

/** El esqueleto que late (`sk` del diseño). */
export const esqueleto = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    background: C.esqueleto, borderRadius: 10, animation: 'tstPulse 1.2s ease-in-out infinite', ...extra,
});

// ── Personas y grupos ───────────────────────────────────────────────────

/** "Sofía G." → "SG": las iniciales del avatar, como el diseño (`ini`). */
export const iniciales = (nombre: string): string =>
    nombre.replace(/[.]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/**
 * La cara de una persona: su foto si la tiene, y si no las iniciales sobre un
 * pastel. El diseño dibuja sólo iniciales; la base manda la foto del
 * anfitrión y del co-anfitrión, y se usa cuando está.
 */
export const Cara: React.FC<{ nombre: string; foto?: string | null; tam: number; fondo: string; letra: number }> = ({ nombre, foto, tam, fondo, letra }) => {
    const [rota, setRota] = useState(false);
    const base: React.CSSProperties = { width: tam, height: tam, flex: 'none', borderRadius: 999 };
    if (foto && !rota) {
        return <img src={foto} alt="" aria-hidden="true" onError={() => setRota(true)} style={{ ...base, objectFit: 'cover', background: fondo }} />;
    }
    return (
        <span aria-hidden="true" style={{ ...base, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: letra, fontWeight: 800, color: C.tinta }}>
            {iniciales(nombre)}
        </span>
    );
};

/** Una fila de anfitrión: cara, y "Nombre · Rol" (como en las opciones del formulario). */
export const FilaAnfitrion: React.FC<{ a: Anfitrion; fondo: string }> = ({ a, fondo }) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Cara nombre={a.nombre} foto={a.foto} tam={26} fondo={fondo} letra={10.5} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.m62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {a.nombre} · {a.rol}
        </span>
    </span>
);

/** El fondo de una portada: la foto del GCX, o un degradé del diseño. */
export const fondoDePortada = (portada: string | null, i: number): React.CSSProperties => (
    portada
        ? { backgroundImage: `url("${portada.replace(/"/g, '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: C.esqueleto }
        : { background: PORTADAS[i % PORTADAS.length] }
);

// ── Íconos (los trazos del diseño) ──────────────────────────────────────

const Trazo: React.FC<{ tam: number; ancho?: number; children: React.ReactNode; estilo?: React.CSSProperties }> = ({ tam, ancho = 1.75, children, estilo }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={ancho}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={estilo}>
        {children}
    </svg>
);

export const IconoReloj: React.FC<{ tam?: number }> = ({ tam = 17 }) => (
    <Trazo tam={tam} estilo={{ flex: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Trazo>
);
export const IconoTilde: React.FC<{ tam?: number; ancho?: number }> = ({ tam = 14, ancho = 3 }) => (
    <Trazo tam={tam} ancho={ancho}><path d="M5 12.5l4.5 4.5L19 7" /></Trazo>
);
export const IconoPersonas: React.FC = () => (
    <Trazo tam={30}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></Trazo>
);
export const IconoCalendarioCerrado: React.FC = () => (
    <Trazo tam={30}><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18M10 14l4 4M14 14l-4 4" /></Trazo>
);
export const IconoSinConexion: React.FC = () => (
    <Trazo tam={30}><path d="M2 2l20 20M8.5 16.5a5 5 0 017 0M5 12.86a10 10 0 015.17-2.69M19 12.86a10 10 0 00-2.3-1.64M2 8.82a15 15 0 014.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M12 20h.01" /></Trazo>
);
export const IconoChat: React.FC<{ tam?: number; ancho?: number }> = ({ tam = 30, ancho = 1.75 }) => (
    <Trazo tam={tam} ancho={ancho}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /><path d="M8 9h8M8 13h5" /></Trazo>
);
export const IconoChatChico: React.FC = () => (
    <Trazo tam={13} ancho={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Trazo>
);
export const IconoLupa: React.FC<{ tam?: number }> = ({ tam = 19 }) => (
    <Trazo tam={tam}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Trazo>
);
/** La lupa con el menos: "Sin resultados". */
export const IconoLupaSin: React.FC = () => (
    <Trazo tam={30}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8 11h6" /></Trazo>
);
export const IconoEquis: React.FC<{ tam?: number; ancho?: number }> = ({ tam = 15, ancho = 2.4 }) => (
    <Trazo tam={tam} ancho={ancho}><path d="M6 6l12 12M18 6L6 18" /></Trazo>
);
export const IconoFlecha: React.FC<{ tam?: number }> = ({ tam = 16 }) => (
    <Trazo tam={tam} ancho={2} estilo={{ flex: 'none' }}><path d="M5 12h14M13 6l6 6-6 6" /></Trazo>
);
export const IconoVolver: React.FC = () => (
    <Trazo tam={18} ancho={2} estilo={{ flex: 'none' }}><path d="M19 12H5M11 18l-6-6 6-6" /></Trazo>
);
export const IconoLapiz: React.FC = () => (
    <Trazo tam={19}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" /></Trazo>
);
export const IconoCompartir: React.FC<{ tam?: number }> = ({ tam = 18 }) => (
    <Trazo tam={tam}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></Trazo>
);
export const IconoCandado: React.FC = () => (
    <Trazo tam={30}><rect x="4" y="11" width="16" height="10" rx="3" /><path d="M8 11V8a4 4 0 018 0v3" /></Trazo>
);
/** El corazón: relleno cuando está dado. */
export const IconoCorazon: React.FC<{ dado: boolean; tam?: number }> = ({ dado, tam = 19 }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill={dado ? 'currentColor' : 'none'} stroke="currentColor"
        strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
    </svg>
);

export const LogoGoogle: React.FC = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.5 5.5 0 01-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.87-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.79-2.11-6.74-4.96H1.27v3.1A12 12 0 0012 24z" />
        <path fill="#FBBC05" d="M5.26 14.27a7.2 7.2 0 010-4.54v-3.1H1.27a12 12 0 000 10.74l3.99-3.1z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.43-3.43A11.5 11.5 0 0012 0 12 12 0 001.27 6.63l3.99 3.1C6.21 6.88 8.87 4.77 12 4.77z" />
    </svg>
);

/** La ruedita de "Enviando…". */
export const Ruedita: React.FC = () => (
    <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 999, border: '2.5px solid currentColor', borderRightColor: 'transparent', animation: 'tstSpin .7s linear infinite' }} />
);

// ── Pantallas de aviso (sin GCX, plazo cerrado, error) ──────────────────

/** La tarjeta centrada con ícono, título, texto y un botón, como en el diseño. */
export const PantallaAviso: React.FC<{
    icono: React.ReactNode;
    titulo: string;
    texto: string;
    boton: string;
    onBoton: () => void;
    alerta?: boolean;
}> = ({ icono, titulo, texto, boton, onBoton, alerta }) => (
    <div style={{ animation: 'tstIn .35s ease both' }}>
        <div role={alerta ? 'alert' : undefined} style={{ maxWidth: 440, margin: '0 auto', background: '#fff', borderRadius: 28, padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
            <span style={{ width: 72, height: 72, borderRadius: 999, background: C.gris, color: C.m62, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icono}
            </span>
            <h1 style={{ margin: '20px 0 0', fontSize: 22, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-.02em', textWrap: 'balance' } as React.CSSProperties}>{titulo}</h1>
            <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55, fontWeight: 500, color: C.m62, textWrap: 'pretty' } as React.CSSProperties}>{texto}</p>
            <button type="button" onClick={onBoton} style={{ ...botonNegro(56), marginTop: 24 }}>{boton}</button>
        </div>
    </div>
);

/**
 * La tarjeta blanca de un estado: ícono, título, texto y (a veces) un botón.
 *
 * Es la del diseño de /testimonios: error, sin resultados y GCX sin
 * testimonios. Ocupa todo el ancho que le den, a diferencia de
 * `PantallaAviso`, que es la tarjeta angosta y centrada de /testimonios-gcx.
 */
export const TarjetaEstado: React.FC<{
    icono: React.ReactNode;
    titulo: React.ReactNode;
    texto?: React.ReactNode;
    boton?: string;
    onBoton?: () => void;
    /** El botón ancho de "Dejar mi testimonio" (60px) en vez del compacto. */
    botonAncho?: boolean;
    alerta?: boolean;
    children?: React.ReactNode;
}> = ({ icono, titulo, texto, boton, onBoton, botonAncho, alerta, children }) => (
    <div
        role={alerta ? 'alert' : undefined}
        style={{
            marginTop: 14, background: '#fff', borderRadius: 28, padding: '44px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,.04)', animation: 'tstIn .3s ease both',
        }}
    >
        <span style={{ width: 72, height: 72, borderRadius: 999, background: C.gris, color: C.m62, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icono}
        </span>
        <h2 style={{ margin: '20px 0 0', maxWidth: 340, fontSize: 21, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-.02em', textWrap: 'balance' } as React.CSSProperties}>
            {titulo}
        </h2>
        {texto && (
            <p style={{ margin: '8px 0 0', maxWidth: 340, fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: C.m62, textWrap: 'pretty' } as React.CSSProperties}>
                {texto}
            </p>
        )}
        {boton && onBoton && (
            botonAncho
                ? <button type="button" onClick={onBoton} style={{ ...botonNegro(60), marginTop: 22 }} className="active:scale-[.98]">{boton}</button>
                : (
                    <button
                        type="button"
                        onClick={onBoton}
                        className="active:scale-[.98]"
                        style={{ marginTop: 22, height: 50, padding: '0 26px', border: 0, borderRadius: 999, background: C.tinta, color: '#fff', fontSize: 15.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                        {boton}
                    </button>
                )
        )}
        {children}
    </div>
);

// ── Links para compartir ────────────────────────────────────────────────

/**
 * El link que se comparte, armado como el de Enlaces Origen: el origen de la
 * app + "/#" + la ruta. El diseño muestra `origeniglesia.org/testimonios/…`,
 * pero la app vive en `app.origeniglesia.org` y con HashRouter, así que ese
 * link no abriría nada (conflicto 1 del inventario).
 */
const origen = (): string =>
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.origeniglesia.org');

export const linkDeGrupo = (groupId: string): string =>
    `${origen()}/#/testimonios/${encodeURIComponent(groupId)}`;

export const linkDeTestimonio = (groupId: string, testimonioId: string): string =>
    `${linkDeGrupo(groupId)}?testimonio=${encodeURIComponent(testimonioId)}`;

// ── Ancho de la pantalla ────────────────────────────────────────────────

/** Los tres tamaños del diseño: teléfono < 600, tablet < 1024, compu. */
export type Vista = 'movil' | 'tablet' | 'compu';

const vistaDe = (ancho: number): Vista => (ancho < ANCHO_MOVIL ? 'movil' : ancho < 1024 ? 'tablet' : 'compu');

export const useVista = (): Vista => {
    // Se mide en el PRIMER render: arrancando en 'compu', un teléfono
    // dibujaría tres columnas y las acomodaría después, a la vista.
    const [vista, setVista] = useState<Vista>(() => (typeof window === 'undefined' ? 'compu' : vistaDe(window.innerWidth)));
    useEffect(() => {
        const medir = () => setVista(vistaDe(window.innerWidth));
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);
    return vista;
};

// ── Textos ──────────────────────────────────────────────────────────────

/**
 * El corte de "ver más" del diseño: 100 caracteres, sin partir una palabra
 * ni dejar un signo colgado.
 *
 * Por letra y no por `length`: un emoji son dos unidades en JS, y cortar por
 * la mitad lo deja roto. Se corta en el último espacio para no partir una
 * palabra, y se le saca una coma o un punto final antes de los puntos
 * suspensivos.
 */
export const LARGO_CORTE = 100;

export const cortar = (texto: string, largo = LARGO_CORTE): string => {
    const letras = Array.from(texto);
    if (letras.length <= largo) return texto;
    const trozo = letras.slice(0, largo).join('');
    const sinPalabraPartida = trozo.replace(/\s+\S*$/, '');
    const base = sinPalabraPartida.length >= Math.floor(largo / 2) ? sinPalabraPartida : trozo;
    return `${base.replace(/[,.;:]$/, '')}…`;
};

/** ¿Hace falta el "ver más"? */
export const hayQueCortar = (texto: string, largo = LARGO_CORTE): boolean =>
    Array.from(texto || '').length > largo;

// ── La hoja (teléfono) / el modal (compu) ───────────────────────────────

/** Debajo de este ancho, hoja desde abajo; arriba, modal centrado (el `isMobile` del diseño). */
export const ANCHO_MOVIL = 600;
/** Arrastrada más de esto, la hoja se cierra (el `dy > 90` del diseño). */
const CIERRA_EN = 90;

export const useEsMovil = (): boolean => {
    // Se mide en el PRIMER render, no en un efecto: arrancando en false, en un
    // teléfono la hoja montaría con la entrada de la compu.
    const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.innerWidth < ANCHO_MOVIL);
    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < ANCHO_MOVIL);
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);
    return esMovil;
};

/**
 * La hoja que sube desde abajo en el teléfono (con manija, se cierra
 * arrastrándola) y el modal centrado en la compu (se cierra con Esc). Tocar
 * afuera también cierra. Mientras `ocupada` no se cierra de ninguna forma.
 * El contenido es libre: cada pantalla pone su rótulo, su título y sus
 * botones, como en el diseño. El título tiene que llevar el id `idTitulo`.
 */
export const HojaModal: React.FC<{
    idTitulo: string;
    onCerrar: () => void;
    ocupada?: boolean;
    /** El ancho del modal en la compu (520 el consentimiento, 460 compartir). */
    ancho: number;
    children: React.ReactNode;
}> = ({ idTitulo, onCerrar, ocupada = false, ancho, children }) => {
    useBloqueoDeFondo(true);
    const esMovil = useEsMovil();
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();
    const panel = useRef<HTMLDivElement>(null);
    const ocupadaRef = useRef(ocupada);
    ocupadaRef.current = ocupada;
    const cerrar = () => { if (!ocupadaRef.current) onCerrar(); };

    useEffect(() => { panel.current?.focus(); }, []);
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    });

    const transicion = sinMovimiento
        ? { duration: 0 }
        : esMovil ? { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as const } : { duration: 0.24, ease: 'easeOut' as const };

    return (
        <div
            onClick={cerrar}
            style={{
                position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.42)',
                display: 'flex', alignItems: esMovil ? 'flex-end' : 'center', justifyContent: 'center',
                padding: esMovil ? 0 : 32, animation: 'tstFade .2s ease both',
            }}
        >
            <motion.div
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={idTitulo}
                onClick={e => e.stopPropagation()}
                initial={esMovil ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
                animate={esMovil ? { y: 0 } : { opacity: 1, scale: 1 }}
                transition={transicion}
                drag={esMovil ? 'y' : false}
                dragListener={false}
                dragControls={arrastre}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => { if (info.offset.y > CIERRA_EN) cerrar(); }}
                style={{
                    position: 'relative', width: '100%', maxWidth: esMovil ? '100%' : ancho, maxHeight: '92%',
                    overflowY: 'auto', overscrollBehavior: 'contain', background: '#fff', outline: 'none',
                    borderRadius: esMovil ? '28px 28px 0 0' : 28, boxShadow: '0 20px 60px rgba(0,0,0,.25)',
                    paddingBottom: esMovil ? 'env(safe-area-inset-bottom)' : undefined,
                }}
            >
                {esMovil && (
                    <div
                        onPointerDown={e => arrastre.start(e)}
                        style={{ padding: '10px 0 8px', touchAction: 'none', cursor: 'grab' }}
                    >
                        <div style={{ width: 44, height: 5, borderRadius: 999, background: 'rgba(0,0,0,.16)', margin: '0 auto' }} />
                    </div>
                )}
                {children}
            </motion.div>
        </div>
    );
};
