// ════════════════════════════════════════════════════════════════════════
// Las piezas que comparten las dos pantallas de Eventos generales.
//
// Del diseño: design-claude/Eventos Generales.dc.html.
//
// La lista (/eventos/admin/general) y el formulario
// (/eventos/admin/general/crear-evento) son la misma pantalla en la
// maqueta, y acá siguen siendo dos rutas: así "Editar" se puede enlazar
// con ?id=, el botón de atrás del navegador hace lo que se espera y los
// enlaces que ya existen no se rompen. Lo que comparten vive acá.
//
// Los tokens salen de components/GCX/patron donde coinciden. Los que la
// maqueta agrega —la línea, el verde de "Visible", el ámbar del error, el
// rojo de eliminar— se definen abajo con su valor del diseño.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { EventoGeneral } from '../../../types';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';

// ── Tokens ──────────────────────────────────────────────────────────────

export const T = {
    fondo: 'bg-[#f6f6f4] dark:bg-[#111110]',
    tarjeta: 'bg-white dark:bg-[#1b1b1a] shadow-[0_1px_3px_rgba(0,0,0,.04)] dark:shadow-none',
    /** Superficie interna: campos, buscador, cajas agrupadas. */
    superficie: 'bg-[#f7f7f5] dark:bg-[#232321]',
    chip: 'bg-[#f2f2f0] dark:bg-[#2a2a28]',
    chipHover: 'hover:bg-[#e9e8e4] dark:hover:bg-[#343432]',
    tinta: 'text-[#0a0a0a] dark:text-[#f4f4f2]',
    suave: 'text-black/55 dark:text-white/55',
    tenue: 'text-black/40 dark:text-white/40',
    /** La línea de 1px que separa filas. */
    linea: 'border-black/[.06] dark:border-white/[.07]',
    /** El fondo que se enciende al pasar por encima de una fila. */
    pasar: 'hover:bg-black/[.025] dark:hover:bg-white/[.035]',
    primario: 'bg-[#0a0a0a] dark:bg-white text-white dark:text-[#0a0a0a]',
    fuente: "font-['Manrope',system-ui,sans-serif]",
    foco: 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15 dark:focus-visible:ring-white/20',
} as const;

/** Rojo SOLO para eliminar. El de fondo y el de texto son el mismo en claro. */
export const ROJO_TEXTO = 'text-[#d1343a] dark:text-[#ff6369]';
export const ROJO_FONDO = 'bg-[#d1343a] dark:bg-[#e5484d]';
/** Ámbar: lo que está mal escrito en un campo. Nunca rojo en un formulario. */
export const AMBAR = '#c08a2e';
export const AMBAR_OSCURO = '#d9a54a';

export const rotulo = `text-[12px] font-semibold tracking-[.07em] ${T.tenue}`;
export const rotuloChico = `text-[11.5px] font-semibold tracking-[.07em] ${T.tenue}`;

export const botonBase =
    'rounded-full font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-opacity';

// ── Fechas y textos ─────────────────────────────────────────────────────

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Hoy en Buenos Aires, como 'YYYY-MM-DD'. */
export const hoyIso = (): string =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

/**
 * "Sáb 7 nov".
 *
 * El mediodía no es decoración: '2026-11-07' leído como instante es
 * medianoche UTC, que en Argentina cae el día anterior, y el evento
 * aparecería corrido un día.
 */
export const fechaCorta = (f: string): string => {
    if (!f) return '';
    const d = new Date(`${f.slice(0, 10)}T12:00`);
    if (Number.isNaN(d.getTime())) return '';
    return `${DIAS[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}`;
};

/** "20:00–22:30", "20:00", o nada. */
export const horario = (ini?: string, fin?: string): string => {
    const a = (ini || '').slice(0, 5);
    const b = (fin || '').slice(0, 5);
    if (!a) return '';
    return b ? `${a}–${b}` : a;
};

/** "Sáb 7 nov · 20:00–22:30". */
export const meta = (ev: { startDate: string; startTime?: string; endTime?: string }): string => {
    const h = horario(ev.startTime, ev.endTime);
    return fechaCorta(ev.startDate) + (h ? ` · ${h}` : '');
};

export const esPasado = (f: string, hoy = hoyIso()): boolean => !!f && f.slice(0, 10) < hoy;

/** Para buscar sin que importen las tildes ni las mayúsculas. */
export const normalizar = (x: string): string =>
    x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Un link de inscripción sirve si es https y apunta a un dominio.
 *
 * http:// queda afuera a propósito: el link se abre desde el teléfono de
 * cualquiera y un formulario sin cifrar pide datos en claro.
 */
export const linkValido = (l: string): boolean => {
    try {
        const u = new URL(l);
        return u.protocol === 'https:' && u.hostname.includes('.');
    } catch {
        return false;
    }
};

/** "forms.gle", para el "Abre …" debajo del campo. */
export const dominioDe = (l: string): string => {
    try {
        return new URL(l).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
};

// ── Pastillas de estado ─────────────────────────────────────────────────

export const Pastilla: React.FC<{ clase: 'visible' | 'oculto' | 'pasado'; children: React.ReactNode }> = ({ clase, children }) => (
    <span
        className={`h-[26px] px-2.5 rounded-full inline-flex items-center text-[12px] font-semibold whitespace-nowrap transition-colors duration-300 ${
            clase === 'visible'
                ? 'bg-[#e2f4ea] text-[#0b6b45] dark:bg-[rgba(52,199,123,.15)] dark:text-[#7ee0aa]'
                : clase === 'oculto'
                    ? `${T.chip} ${T.suave}`
                    : `bg-transparent shadow-[inset_0_0_0_1px_rgba(0,0,0,.13)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.13)] ${T.suave}`
        }`}
    >
        {children}
    </span>
);

/** Las pastillas de un evento: siempre su estado, y "Ya pasó" si corresponde. */
export const pastillasDe = (ev: EventoGeneral, hoy = hoyIso()): Array<{ clase: 'visible' | 'oculto' | 'pasado'; texto: string }> => {
    const lista: Array<{ clase: 'visible' | 'oculto' | 'pasado'; texto: string }> = [
        ev.isVisible ? { clase: 'visible', texto: 'Visible' } : { clase: 'oculto', texto: 'Oculto' },
    ];
    if (esPasado(ev.startDate, hoy)) lista.push({ clase: 'pasado', texto: 'Ya pasó' });
    return lista;
};

// ── El ícono de "sin portada" ───────────────────────────────────────────

export const IconoCalendario: React.FC<{ className?: string; grosor?: number }> = ({
    className = 'w-[22px] h-[22px]', grosor = 1.8,
}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor}
        strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d="M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2zM8 3v4M16 3v4M4 10h16" />
    </svg>
);

// ── La tarjeta de "ASÍ SE VE EN /EVENTOS" ───────────────────────────────

/**
 * La vista previa, que es la misma en la columna del escritorio y en la
 * hoja del teléfono.
 *
 * `version` sube con cada tecla y se usa como `key`: así la tarjeta se
 * vuelve a montar y entra con un fundido corto. Sin eso, escribir el
 * nombre cambia el texto de golpe y no se nota que esto es lo que va a
 * ver la gente.
 */
export const VistaPrevia: React.FC<{
    nombre: string;
    fecha: string;
    hora: string;
    descripcion: string;
    hayLink: boolean;
    portada: string;
    version: number;
}> = ({ nombre, fecha, hora, descripcion, hayLink, portada, version }) => {
    const sinMovimiento = useReducedMotion();
    return (
        <div
            key={sinMovimiento ? undefined : version}
            className={`rounded-[26px] overflow-hidden ${T.tarjeta} shadow-[0_1px_3px_rgba(0,0,0,.05),0_8px_24px_rgba(0,0,0,.04)] dark:shadow-none ${sinMovimiento ? '' : 'animate-fadeIn'}`}
        >
            <div className={`w-full aspect-square flex items-center justify-center ${portada ? '' : T.chip}`}>
                {portada
                    ? <img src={portada} alt="" className="w-full h-full object-cover" />
                    : (
                        <span className={`flex flex-col items-center gap-2 ${T.tenue}`}>
                            <IconoCalendario className="w-[30px] h-[30px]" grosor={1.6} />
                            <span className="text-[12.5px] font-semibold">Sin portada</span>
                        </span>
                    )}
            </div>
            <div className="px-5 pt-[18px] pb-5">
                <span className={`inline-flex items-center h-7 px-3 rounded-full text-[12px] font-bold tracking-[.05em] ${T.chip} ${T.tinta}`}>
                    {fecha ? fechaCorta(fecha).toUpperCase() : 'FECHA'}
                </span>
                <p className={`mt-3 m-0 text-[19px] leading-[1.25] font-bold tracking-[-.015em] [overflow-wrap:anywhere] ${nombre.trim() ? T.tinta : T.tenue}`}>
                    {nombre.trim() || 'Nombre del evento'}
                </p>
                {!!hora && <p className={`mt-1.5 m-0 text-[14px] font-semibold ${T.suave}`}>{hora}</p>}
                {!!descripcion.trim() && (
                    <p className={`mt-2.5 m-0 text-[14px] leading-[1.5] line-clamp-3 ${T.suave}`}>{descripcion}</p>
                )}
                {hayLink && (
                    <span className={`flex items-center justify-center h-[46px] mt-4 rounded-full text-[14.5px] font-semibold ${T.primario}`}>
                        Inscribirme
                    </span>
                )}
            </div>
        </div>
    );
};

// ── La hoja: cajón abajo en el teléfono, ventana al medio en la compu ───

const CIERRA_EN = 90;

export const Hoja: React.FC<{
    abierta: boolean;
    etiqueta: string;
    /** La de "Detalle del evento" es más ancha que las de confirmar. */
    ancha?: boolean;
    onCerrar: () => void;
    children: React.ReactNode;
}> = ({ abierta, etiqueta, ancha, onCerrar, children }) => {
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();
    const panel = useRef<HTMLDivElement | null>(null);
    const devolverFoco = useRef<HTMLElement | null>(null);

    // El ancho se mide en el PRIMER render: montar el cajón y la ventana a
    // la vez deja dos diálogos en el árbol.
    const [esMovil] = React.useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
    );

    useBloqueoDeFondo(abierta);

    useEffect(() => {
        if (!abierta) return;
        devolverFoco.current = document.activeElement as HTMLElement;
        const alTeclado = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', alTeclado);
        panel.current?.focus();
        return () => {
            window.removeEventListener('keydown', alTeclado);
            devolverFoco.current?.focus?.();
        };
    }, [abierta, onCerrar]);

    return createPortal(
        <AnimatePresence>
            {abierta && (
                <motion.div
                    className={`fixed inset-0 z-[70] flex ${esMovil ? 'items-end' : 'items-center justify-center'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: sinMovimiento ? 0 : .2 }}
                    onClick={onCerrar}
                    style={{ background: 'rgba(0,0,0,.42)' }}
                >
                    <motion.div
                        ref={panel}
                        role="dialog"
                        aria-modal="true"
                        aria-label={etiqueta}
                        tabIndex={-1}
                        onClick={e => e.stopPropagation()}
                        drag={esMovil && !sinMovimiento ? 'y' : false}
                        dragControls={arrastre}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: .6 }}
                        onDragEnd={(_, info) => { if (info.offset.y > CIERRA_EN) onCerrar(); }}
                        initial={sinMovimiento ? false : (esMovil ? { y: '100%' } : { opacity: 0, y: 6, scale: .98 })}
                        animate={esMovil ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                        exit={sinMovimiento ? undefined : (esMovil ? { y: '100%' } : { opacity: 0, y: 6, scale: .98 })}
                        transition={{ duration: sinMovimiento ? 0 : .28, ease: [.2, .8, .2, 1] }}
                        className={`max-h-[92%] overflow-y-auto ${T.tarjeta} ${T.tinta} ${T.fuente} focus:outline-none ${
                            esMovil
                                ? 'w-full rounded-t-[28px] px-4 pb-[34px]'
                                : `${ancha ? 'w-[520px]' : 'w-[480px]'} rounded-[28px] p-6 shadow-[0_24px_60px_rgba(0,0,0,.22)]`
                        }`}
                    >
                        {esMovil && (
                            <div
                                onPointerDown={e => arrastre.start(e)}
                                className="pt-2.5 pb-2 cursor-grab touch-none"
                            >
                                <span className={`block w-10 h-[5px] rounded-full mx-auto ${T.chip}`} />
                            </div>
                        )}
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

// ── El aviso de abajo ───────────────────────────────────────────────────

export const Aviso: React.FC<{ texto: string | null; abajo: string }> = ({ texto, abajo }) => {
    const sinMovimiento = useReducedMotion();
    return createPortal(
        <AnimatePresence>
            {texto && (
                <motion.div
                    role="status"
                    className={`fixed left-1/2 z-[80] w-max max-w-[calc(100%-32px)] px-5 py-3 rounded-full text-[14px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,.2)] ${T.primario} ${T.fuente}`}
                    style={{ bottom: abajo }}
                    initial={sinMovimiento ? { x: '-50%' } : { opacity: 0, y: 10, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={sinMovimiento ? { x: '-50%' } : { opacity: 0, y: 10, x: '-50%' }}
                    transition={{ duration: sinMovimiento ? 0 : .2 }}
                >
                    {texto}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

/** El temporizador del aviso, que todas las pantallas repiten igual. */
export const useAviso = () => {
    const [texto, setTexto] = React.useState<string | null>(null);
    const reloj = useRef<number | null>(null);

    useEffect(() => () => { if (reloj.current) window.clearTimeout(reloj.current); }, []);

    const avisar = React.useCallback((t: string) => {
        setTexto(t);
        if (reloj.current) window.clearTimeout(reloj.current);
        reloj.current = window.setTimeout(() => setTexto(null), 2300);
    }, []);

    return { aviso: texto, avisar };
};
