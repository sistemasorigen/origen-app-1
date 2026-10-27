import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import {
    AlertTriangle,
    Bell,
    CalendarCheck,
    Check,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    Inbox,
    Info,
    MessageSquareReply,
    MoreHorizontal,
    Pin,
    ShieldCheck,
    Trash2,
    Users,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import type { AppNotification } from '../../hooks/useNotifications';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { volverOA } from '../../src/utils/volver';

/**
 * El centro de notificaciones (design-claude/Notificaciones.dc).
 *
 * Se llega desde el menú: "Notificaciones", en el panel de la cuenta. La
 * campana de la navbar ya no existe.
 *
 * La pantalla SÓLO lee el contexto y llama a sus funciones —markAsRead,
 * togglePin, deleteNotification, markAllAsRead, clearAllNotifications—. No
 * guarda una copia de la lista: lo que se ve es lo que el contexto tiene en
 * ese momento, que es lo que el canal de Realtime mantiene al día. Lo único
 * local es lo que no es dato: qué vista está elegida, qué hoja está abierta,
 * qué fila acaba de leerse y el aviso de "borrada".
 */

// ── Tokens del diseño ───────────────────────────────────────────────────
// En clases y no en estilos inline porque el modo oscuro de la app es la
// clase `dark` en <html>: un objeto de colores en JS no se enteraría.
const FONDO = 'bg-[#f6f6f4] dark:bg-[#111110]';
const TARJETA = 'bg-white dark:bg-[#1b1b1a]';
const SUPERFICIE = 'bg-[#f7f7f5] dark:bg-[#232321]';
const CHIP = 'bg-[#f2f2f0] dark:bg-[#2a2a28]';
const ENCIMA = 'hover:bg-[#f2f2f0] dark:hover:bg-[#2a2a28]';
const TINTA = 'text-[#0a0a0a] dark:text-[#f4f4f2]';
const M66 = 'text-black/[0.68] dark:text-white/[0.68]';
const M50 = 'text-black/55 dark:text-white/55';
const M38 = 'text-black/40 dark:text-white/40';
const LINEA = 'bg-black/[0.06] dark:bg-white/[0.07]';
const SOMBRA = 'shadow-[0_1px_3px_rgba(0,0,0,.04)] dark:shadow-none';
const FUENTE = "font-['Manrope',system-ui,sans-serif]";
const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 dark:focus-visible:ring-white/25';

/** El rojo: el punto de sin leer y la palabra de lo que no se puede deshacer. */
const PUNTO_ROJO = 'bg-[#e5484d] dark:bg-[#ff6369]';
const TEXTO_ROJO = 'text-[#d1343a] dark:text-[#ff6369]';

const ROTULO = `text-[12px] font-semibold uppercase tracking-[0.07em] ${M38}`;

/**
 * El ícono de cada tipo, en un solo lugar.
 *
 * Los tipos salen de quien crea la notificación (REGISTRATION, ATTENDANCE,
 * ADMIN, success, warning, info, y los cuatro AGENDA_* de Agenda Origen). Cualquier otro —uno nuevo que todavía no
 * tenga dibujo— cae en la campana genérica en vez de romper la fila.
 */
const ICONOS: Record<string, React.ElementType> = {
    REGISTRATION: Users,
    ATTENDANCE: ClipboardCheck,
    ADMIN: ShieldCheck,
    success: CheckCircle2,
    warning: AlertTriangle,
    info: Info,
    // Agenda Origen (sql/agenda_avisos.sql)
    AGENDA_TAREA_ASIGNADA: CalendarCheck,
    AGENDA_TAREA_COMPLETADA: CheckCircle2,
    AGENDA_SOLICITUD_NUEVA: Inbox,
    AGENDA_SOLICITUD_REVISADA: MessageSquareReply,
};

const iconoDe = (tipo: string): React.ElementType => ICONOS[tipo] || Bell;

// ── Fechas, en hora argentina ───────────────────────────────────────────

const ZONA = 'America/Argentina/Buenos_Aires';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** El día de una fecha en Buenos Aires, como 'YYYY-MM-DD'. */
const diaAr = (fecha: Date): string =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(fecha);

/**
 * Hace cuánto, en palabras.
 *
 * Es la función que ya tenía la pantalla, con una sola cosa más: pasada la
 * semana deja de contar días y dice la fecha, como el diseño. "Hace 43 días"
 * no le dice nada a nadie.
 */
export const timeAgo = (dateStr: string): string => {
    const cuando = new Date(dateStr);
    const minutos = Math.floor((Date.now() - cuando.getTime()) / 60000);
    if (minutos < 1) return 'Ahora mismo';
    if (minutos < 60) return `Hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `Hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'Ayer';
    if (dias < 7) return `Hace ${dias} días`;
    const partes = diaAr(cuando).split('-');
    return `${Number(partes[2])} ${MESES[Number(partes[1]) - 1]}`;
};

type Grupo = 'ANCLADAS' | 'HOY' | 'AYER' | 'ESTA SEMANA' | 'ANTES';
const ORDEN: Grupo[] = ['ANCLADAS', 'HOY', 'AYER', 'ESTA SEMANA', 'ANTES'];

/**
 * En qué bloque va cada una.
 *
 * "Hoy" y "ayer" son días del calendario argentino, no las últimas 24 y 48
 * horas: una notificación de las 23:50 de anoche es de AYER, aunque hayan
 * pasado nueve horas.
 */
const grupoDe = (n: AppNotification, hoy: string, ayer: string): Grupo => {
    if (n.is_pinned) return 'ANCLADAS';
    const dia = diaAr(new Date(n.created_at));
    if (dia === hoy) return 'HOY';
    if (dia === ayer) return 'AYER';
    const dias = (Date.now() - new Date(n.created_at).getTime()) / 86400000;
    return dias < 7 ? 'ESTA SEMANA' : 'ANTES';
};

/**
 * El emoji del principio del título, afuera.
 *
 * Muchas notificaciones vienen con un emoji adelante ("📋 Nueva solicitud").
 * El ícono del círculo ya dice de qué se trata, así que el emoji duplica y
 * además desalinea el texto. Se saca SÓLO para mostrar: el dato no se toca.
 *
 * El rango cubre los emojis de varios caracteres —el selector de variación
 * (️), el unidor (‍) y los tonos de piel—, que si no quedarían
 * como un cuadradito suelto.
 */
const EMOJI_AL_PRINCIPIO =
    /^(?:[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍⃣]|\s)+/u;

const sinEmoji = (titulo: string): string => {
    const limpio = (titulo || '').replace(EMOJI_AL_PRINCIPIO, '').trim();
    // Un título que era sólo emojis se queda como estaba: mejor el emoji que
    // una fila sin nombre.
    return limpio || (titulo || '').trim();
};

/**
 * A dónde lleva una notificación.
 *
 * Interna con navigate (la app es HashRouter: un href no serviría), externa
 * en otra pestaña y sin acceso a la nuestra. Cualquier otra cosa —javascript:,
 * data:— no se abre: el action_url lo escribe quien crea la notificación y
 * esto es lo último que lo mira antes de ejecutarlo.
 */
const claseDeDestino = (url: string | null): 'interno' | 'externo' | 'ninguno' => {
    const limpio = (url || '').trim();
    if (!limpio) return 'ninguno';
    if (/^https?:\/\//i.test(limpio)) return 'externo';
    if (limpio.startsWith('/')) return 'interno';
    return 'ninguno';
};

// ── La hoja: panel desde abajo en el teléfono, modal en la compu ────────

/** Arrastrar más que esto la cierra. Lo mismo que el .dc. */
const CIERRA_EN = 90;

/**
 * La técnica es la de components/Reportes/HojaDetalle.tsx —medir el ancho en
 * el PRIMER render, Escape, devolver el foco, bloquear el fondo como lo
 * necesita iOS, respetar prefers-reduced-motion—, pero con los tokens de
 * esta pantalla: aquélla está pintada con los colores de Reportes y en
 * blanco fijo, y acá hay modo oscuro.
 */
const Hoja: React.FC<{
    abierta: boolean;
    onCerrar: () => void;
    etiqueta: string;
    children: React.ReactNode;
}> = ({ abierta, onCerrar, etiqueta, children }) => {
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const focoPrevio = useRef<HTMLElement | null>(null);
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    useEffect(() => {
        if (!abierta) return;
        focoPrevio.current = document.activeElement as HTMLElement;
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alTeclear);
        return () => {
            document.removeEventListener('keydown', alTeclear);
            focoPrevio.current?.focus?.();
        };
    }, [abierta, onCerrar]);

    useBloqueoDeFondo(abierta);

    if (typeof document === 'undefined') return null;

    const transicion = sinMovimiento
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 34, stiffness: 340 };

    return createPortal(
        <AnimatePresence>
            {abierta && (
                <motion.div
                    className={`fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-6 bg-black/[0.42] ${FUENTE}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: sinMovimiento ? 0 : 0.2 }}
                    onClick={onCerrar}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={etiqueta}
                        className={`relative w-full md:w-[480px] max-h-[92%] md:max-h-[90vh] overflow-y-auto overscroll-contain rounded-t-[28px] md:rounded-[28px] px-4 pb-[34px] md:pb-5 ${TARJETA} ${TINTA} shadow-[0_24px_60px_rgba(0,0,0,.22)]`}
                        initial={esMovil ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                        animate={esMovil ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                        exit={esMovil ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                        transition={transicion}
                        // El arrastre sale sólo de la agarradera: desde el
                        // cuerpo competiría con el scroll de la hoja.
                        drag={esMovil ? 'y' : false}
                        dragListener={false}
                        dragControls={arrastre}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={(_, info) => { if (info.offset.y > CIERRA_EN) onCerrar(); }}
                        onClick={e => e.stopPropagation()}
                    >
                        {esMovil && (
                            <div
                                onPointerDown={e => arrastre.start(e)}
                                className="pt-2.5 pb-2 cursor-grab"
                                style={{ touchAction: 'none' }}
                            >
                                <span className={`block mx-auto w-10 h-[5px] rounded-full ${CHIP}`} />
                            </div>
                        )}
                        <div className={esMovil ? '' : 'pt-5'}>{children}</div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

/** Una opción de la hoja: ícono, texto y nada más. */
const OpcionDeHoja: React.FC<{
    icon: React.ElementType;
    onClick: () => void;
    rojo?: boolean;
    children: React.ReactNode;
}> = ({ icon: Icono, onClick, rojo, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full h-[52px] px-4 rounded-[18px] flex items-center gap-3.5 text-[15.5px] font-semibold text-left transition-colors ${ENCIMA} ${FOCO} ${rojo ? TEXTO_ROJO : TINTA}`}
    >
        <Icono className="w-[19px] h-[19px] shrink-0" strokeWidth={2} />
        {children}
    </button>
);

/** El botón ancho del pie de una hoja: Cancelar, Borrar todas. */
const BotonDeHoja: React.FC<{
    onClick: () => void;
    rojo?: boolean;
    children: React.ReactNode;
}> = ({ onClick, rojo, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`w-full h-[54px] rounded-full text-[15.5px] font-semibold transition-colors ${CHIP} ${ENCIMA} ${FOCO} ${rojo ? TEXTO_ROJO : TINTA}`}
    >
        {children}
    </button>
);

// ── Una fila ────────────────────────────────────────────────────────────

const Fila: React.FC<{
    n: AppNotification;
    primera: boolean;
    brilla: boolean;
    onAbrir: (n: AppNotification) => void;
    onAnclar: (n: AppNotification) => void;
    onBorrar: (n: AppNotification) => void;
    onAcciones: (n: AppNotification) => void;
}> = ({ n, primera, brilla, onAbrir, onAnclar, onBorrar, onAcciones }) => {
    const titulo = sinEmoji(n.title);
    const destino = claseDeDestino(n.action_url);
    const Icono = iconoDe(n.type);

    const etiqueta = `${titulo}${n.is_read ? '' : ', sin leer'}${destino !== 'ninguno' ? ', abre un enlace' : ''}`;

    return (
        <div
            className="group/fila relative transition-colors duration-[1600ms]"
            style={brilla ? undefined : { background: 'transparent' }}
        >
            {/* El brillo de la que acaba de llegar: un amarillo muy bajo que
                se apaga solo. Va en estilo y no en clase porque es un color
                que sólo existe acá. */}
            {brilla && (
                <span
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none dark:hidden"
                    style={{ background: '#f6eed6' }}
                />
            )}
            {brilla && (
                <span
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none hidden dark:block"
                    style={{ background: '#2b2716' }}
                />
            )}

            {!primera && <div className={`h-px ml-[74px] ${LINEA}`} />}

            <div className="relative flex items-start">
                <button
                    type="button"
                    onClick={() => onAbrir(n)}
                    aria-label={etiqueta}
                    className={`relative flex-1 min-w-0 flex items-start gap-3 pl-[22px] pr-1 py-[15px] text-left transition-colors ${FOCO} ${ENCIMA}`}
                >
                    {/* El punto de sin leer. No se desmonta al leer: se achica
                        a cero, que es lo que lo hace "apagarse". */}
                    <span
                        aria-hidden="true"
                        className={`absolute left-2 top-[31px] w-2 h-2 rounded-full transition-all duration-200 ${PUNTO_ROJO}`}
                        style={{ transform: `scale(${n.is_read ? 0 : 1})`, opacity: n.is_read ? 0 : 1 }}
                    />
                    <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${CHIP} ${TINTA}`}>
                        <Icono className="w-[19px] h-[19px]" strokeWidth={2} />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-1">
                        <span className="flex items-baseline gap-2">
                            <span
                                className={`flex-1 min-w-0 text-[15px] leading-[1.3] font-semibold transition-colors duration-200 ${n.is_read ? M66 : TINTA}`}
                                style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
                                {titulo}
                            </span>
                            <span className={`shrink-0 flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap ${M50}`}>
                                {n.is_pinned && <Pin className="w-3 h-3 fill-current" strokeWidth={2} aria-label="Anclada" />}
                                {timeAgo(n.created_at)}
                            </span>
                        </span>
                        <span
                            className={`text-[14px] leading-[1.45] font-medium ${M50}`}
                            style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                            {n.message}
                        </span>
                    </span>
                    {destino !== 'ninguno' && (
                        <ChevronRight className={`w-4 h-4 shrink-0 self-center ${M38}`} strokeWidth={2.2} />
                    )}
                </button>

                {/* En la compu, anclar y borrar aparecen al pasar el mouse.
                    Siguen siendo alcanzables con el tabulador —y ahí se
                    encienden solas—: esconderlas del teclado dejaría la fila
                    con una sola acción. */}
                <div className="hidden md:flex gap-1 pt-3 shrink-0 opacity-0 transition-opacity duration-150 group-hover/fila:opacity-100 focus-within:opacity-100">
                    <button
                        type="button"
                        onClick={() => onAnclar(n)}
                        aria-label={n.is_pinned ? 'Desanclar' : 'Anclar'}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${CHIP} ${ENCIMA} ${TINTA} ${FOCO}`}
                    >
                        <Pin className={`w-4 h-4 ${n.is_pinned ? 'fill-current' : ''}`} strokeWidth={2} />
                    </button>
                    <button
                        type="button"
                        onClick={() => onBorrar(n)}
                        aria-label="Borrar"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${CHIP} ${ENCIMA} ${TEXTO_ROJO} ${FOCO}`}
                    >
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                    </button>
                </div>

                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onAcciones(n); }}
                    aria-label={`Acciones de ${titulo}`}
                    className={`w-11 h-11 shrink-0 mt-2.5 mr-1.5 rounded-full flex items-center justify-center transition-colors ${M50} ${ENCIMA} ${FOCO}`}
                >
                    <MoreHorizontal className="w-[18px] h-[18px]" strokeWidth={2.4} />
                </button>
            </div>
        </div>
    );
};

// ── El esqueleto ────────────────────────────────────────────────────────

const ANCHOS: [string, string][] = [['62%', '88%'], ['48%', '70%'], ['55%', '80%'], ['40%', '64%']];

const Esqueleto: React.FC = () => (
    <div aria-busy="true">
        <div className={`w-[60px] h-[11px] rounded-lg mt-[26px] mb-2.5 ml-1.5 animate-pulse bg-[#ecebe7] dark:bg-[#262624]`} />
        <div className={`rounded-[26px] overflow-hidden ${TARJETA} ${SOMBRA}`}>
            {ANCHOS.map(([a1, a2], i) => (
                <div key={i} className="flex gap-3 px-4 py-4 pl-[22px]">
                    {i > 0 && <div className={`absolute h-px ${LINEA}`} />}
                    <div className="w-10 h-10 shrink-0 rounded-full animate-pulse bg-[#ecebe7] dark:bg-[#262624]" />
                    <div className="flex-1 min-w-0 pt-[3px]">
                        <div className="h-[13px] rounded-lg animate-pulse bg-[#ecebe7] dark:bg-[#262624]" style={{ width: a1 }} />
                        <div className="h-[11px] mt-2.5 rounded-lg animate-pulse bg-[#ecebe7] dark:bg-[#262624]" style={{ width: a2 }} />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ── La pantalla ─────────────────────────────────────────────────────────

type Vista = 'todas' | 'no_leidas';

const Notifications: React.FC = () => {
    const navigate = useNavigate();
    const sinMovimiento = useReducedMotion();
    const {
        notifications, isLoading,
        markAsRead, markAllAsRead, togglePin, deleteNotification, clearAllNotifications,
    } = useNotifications();

    const [vista, setVista] = useState<Vista>('todas');
    /** Qué hoja está abierta: las acciones de una fila, el menú o el confirmar. */
    const [hoja, setHoja] = useState<{ tipo: 'fila'; id: string } | { tipo: 'menu' } | { tipo: 'confirmar' } | null>(null);
    const [menuPc, setMenuPc] = useState(false);
    const [aviso, setAviso] = useState<{ texto: string; k: number } | null>(null);
    /**
     * Las que se leyeron sin salir de "No leídas".
     *
     * Sin esto, tocar una notificación en esa vista la hace desaparecer bajo
     * el dedo. Se quedan a la vista —ya apagadas— hasta que se cambia de
     * vista.
     */
    const [recienLeidas, setRecienLeidas] = useState<Record<string, true>>({});
    /** Las que acaban de llegar: entran con un brillo que se apaga solo. */
    const [brillo, setBrillo] = useState<Record<string, true>>({});

    const relojes = useRef<number[]>([]);
    useEffect(() => () => { relojes.current.forEach(clearTimeout); }, []);
    const luego = useCallback((fn: () => void, ms: number) => {
        relojes.current.push(window.setTimeout(fn, ms));
    }, []);

    const avisar = useCallback((texto: string) => {
        const k = Date.now();
        setAviso({ texto, k });
        luego(() => setAviso(a => (a && a.k === k ? null : a)), 3000);
    }, [luego]);

    // ── La que llega en vivo ────────────────────────────────────────────
    const conocidas = useRef<Set<string> | null>(null);
    useEffect(() => {
        const ids = notifications.map(n => n.id);
        if (conocidas.current === null) {
            // La primera carga no "llega": ya estaba. Sin esto, abrir la
            // pantalla prendería todas las filas a la vez.
            conocidas.current = new Set(ids);
            return;
        }
        const nuevas = ids.filter(id => !conocidas.current!.has(id));
        conocidas.current = new Set(ids);
        if (!nuevas.length) return;
        setBrillo(b => nuevas.reduce((o, id) => Object.assign(o, { [id]: true as const }), { ...b }));
        luego(() => setBrillo(b => {
            const copia = { ...b };
            nuevas.forEach(id => delete copia[id]);
            return copia;
        }), 1800);
    }, [notifications, luego]);

    // ── Acciones ────────────────────────────────────────────────────────

    const sinLeer = notifications.filter(n => !n.is_read).length;
    const hay = notifications.length > 0;

    const abrir = useCallback((n: AppNotification) => {
        if (!n.is_read) {
            void markAsRead(n.id);
            if (vista === 'no_leidas') setRecienLeidas(r => ({ ...r, [n.id]: true }));
        }
        const destino = claseDeDestino(n.action_url);
        const url = (n.action_url || '').trim();
        if (destino === 'externo') window.open(url, '_blank', 'noopener,noreferrer');
        else if (destino === 'interno') navigate(url);
    }, [markAsRead, navigate, vista]);

    const anclar = useCallback((n: AppNotification) => {
        setHoja(null);
        void togglePin(n.id, n.is_pinned);
    }, [togglePin]);

    const borrar = useCallback((n: AppNotification) => {
        setHoja(null);
        void deleteNotification(n.id);
        avisar('Notificación borrada');
    }, [deleteNotification, avisar]);

    const leerUna = useCallback((n: AppNotification) => {
        setHoja(null);
        void markAsRead(n.id);
        if (vista === 'no_leidas') setRecienLeidas(r => ({ ...r, [n.id]: true }));
    }, [markAsRead, vista]);

    const marcarTodas = useCallback(() => {
        if (vista === 'no_leidas') {
            setRecienLeidas(r => notifications.reduce(
                (o, n) => (n.is_read ? o : Object.assign(o, { [n.id]: true as const })), { ...r },
            ));
        }
        void markAllAsRead();
    }, [markAllAsRead, notifications, vista]);

    const borrarTodas = useCallback(() => {
        setHoja(null);
        setMenuPc(false);
        setVista('todas');
        void clearAllNotifications();
        avisar('Borraste todas las notificaciones');
    }, [clearAllNotifications, avisar]);

    const cambiarVista = useCallback((v: Vista) => {
        setVista(v);
        setRecienLeidas({});
    }, []);

    // ── Los grupos ──────────────────────────────────────────────────────

    const grupos = useMemo(() => {
        const hoy = diaAr(new Date());
        const ayer = diaAr(new Date(Date.now() - 86400000));
        const lista = notifications.filter(
            n => vista === 'todas' || !n.is_read || recienLeidas[n.id],
        );
        return ORDEN.map(label => ({
            label,
            filas: lista
                .filter(n => grupoDe(n, hoy, ayer) === label)
                .sort((a, b) => b.created_at.localeCompare(a.created_at)),
        })).filter(g => g.filas.length > 0);
    }, [notifications, vista, recienLeidas]);

    const cargando = isLoading && !hay;
    const vacioTodo = !cargando && !hay;
    const vacioSinLeer = !cargando && hay && vista === 'no_leidas' && grupos.length === 0;

    const laDeLaHoja = hoja?.tipo === 'fila'
        ? notifications.find(n => n.id === hoja.id) || null
        : null;

    // ── Dibujo ──────────────────────────────────────────────────────────

    const fade = sinMovimiento ? { duration: 0 } : { duration: 0.22 };

    return (
        <div className={`min-h-screen ${FONDO} ${TINTA} ${FUENTE}`}>
            <div className="max-w-[752px] mx-auto px-4 pt-7 pb-20 lg:pt-12 lg:pb-24">

                {/* ── Encabezado ─────────────────────────────────────── */}
                <div className="flex items-start gap-2.5">
                    {/* El mismo volver que las funciones de /perfil, de donde
                        se llega casi siempre. */}
                    <button
                        type="button"
                        onClick={() => volverOA(navigate, '/perfil')}
                        aria-label="Volver"
                        className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-[#e9e9e6] dark:hover:bg-[#333331] ${CHIP} ${TINTA} ${FOCO}`}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" /></svg>
                    </button>
                    <div className="flex-1 min-w-0 pt-1">
                        <h1 className="text-[28px] lg:text-[32px] leading-[1.1] font-semibold tracking-[-.025em]">
                            Notificaciones
                        </h1>
                        <p className={`mt-1.5 text-[14.5px] font-semibold ${M50}`}>
                            {cargando ? 'Cargando…' : sinLeer > 0 ? `${sinLeer} sin leer` : 'Estás al día'}
                        </p>
                    </div>

                    {sinLeer > 0 && !cargando && (
                        <button
                            type="button"
                            onClick={marcarTodas}
                            className={`hidden sm:flex items-center h-11 px-[18px] shrink-0 rounded-full text-[13.5px] font-semibold whitespace-nowrap transition-colors ${CHIP} ${ENCIMA} ${TINTA} ${FOCO}`}
                        >
                            Marcar todas como leídas
                        </button>
                    )}

                    <div className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                // En el teléfono no hay desplegables: lo que
                                // en la compu cuelga del botón, acá sube.
                                if (window.innerWidth < 768) setHoja({ tipo: 'menu' });
                                else setMenuPc(v => !v);
                            }}
                            aria-label="Más opciones"
                            aria-haspopup="menu"
                            aria-expanded={menuPc}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${CHIP} ${ENCIMA} ${TINTA} ${FOCO}`}
                        >
                            <MoreHorizontal className="w-5 h-5" strokeWidth={2.4} />
                        </button>

                        {menuPc && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setMenuPc(false)} />
                                <div
                                    role="menu"
                                    className={`absolute right-0 top-[calc(100%+8px)] z-[31] w-[220px] p-1.5 rounded-[20px] ${TARJETA} shadow-[0_14px_40px_rgba(0,0,0,.16)]`}
                                >
                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={!hay}
                                        onClick={() => { setMenuPc(false); setHoja({ tipo: 'confirmar' }); }}
                                        className={`w-full h-11 px-4 rounded-full flex items-center gap-3 text-[14.5px] font-semibold text-left transition-colors ${ENCIMA} ${TEXTO_ROJO} ${FOCO} disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                        <Trash2 className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                                        Borrar todas
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {sinLeer > 0 && !cargando && (
                    <button
                        type="button"
                        onClick={marcarTodas}
                        className={`sm:hidden flex items-center justify-center w-full h-11 mt-3.5 rounded-full text-[13.5px] font-semibold transition-colors ${CHIP} ${ENCIMA} ${TINTA} ${FOCO}`}
                    >
                        Marcar todas como leídas
                    </button>
                )}

                {/* ── Todas · No leídas ──────────────────────────────── */}
                <div
                    role="tablist"
                    aria-label="Vista"
                    className={`relative grid grid-cols-2 w-full lg:w-[320px] mt-[22px] p-1 rounded-full ${CHIP}`}
                >
                    <span
                        aria-hidden="true"
                        className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-[#0a0a0a] dark:bg-white"
                        style={{
                            left: vista === 'todas' ? 4 : '50%',
                            transition: sinMovimiento ? 'none' : 'left .3s cubic-bezier(.3,.8,.2,1)',
                        }}
                    />
                    <button
                        type="button"
                        role="tab"
                        aria-selected={vista === 'todas'}
                        onClick={() => cambiarVista('todas')}
                        className={`relative z-[1] h-11 rounded-full text-[14.5px] font-semibold transition-colors duration-[250ms] ${FOCO} ${vista === 'todas' ? 'text-white dark:text-[#0a0a0a]' : TINTA}`}
                    >
                        Todas
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={vista === 'no_leidas'}
                        onClick={() => cambiarVista('no_leidas')}
                        className={`relative z-[1] h-11 rounded-full flex items-center justify-center gap-2 text-[14.5px] font-semibold transition-colors duration-[250ms] ${FOCO} ${vista === 'no_leidas' ? 'text-white dark:text-[#0a0a0a]' : TINTA}`}
                    >
                        No leídas
                        {sinLeer > 0 && (
                            <span
                                className={`min-w-[22px] h-[22px] px-[7px] inline-flex items-center justify-center rounded-full text-[12px] font-bold ${vista === 'no_leidas'
                                    ? 'bg-white/20 dark:bg-black/[0.12]'
                                    : 'bg-black/[0.08] dark:bg-white/[0.08]'}`}
                            >
                                {sinLeer}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── La lista ───────────────────────────────────────── */}
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={vista}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={fade}
                    >
                        {cargando && <Esqueleto />}

                        {vacioTodo && (
                            <div className="py-[72px] px-6 flex flex-col items-center text-center">
                                <Bell className={`w-16 h-16 ${M38}`} strokeWidth={1.2} />
                                <p className="mt-5 text-[18px] font-semibold">No tenés notificaciones</p>
                                <p className={`mt-2 max-w-[290px] text-[14.5px] leading-[1.55] ${M50}`}>
                                    Cuando pase algo en tus grupos o eventos, te avisamos acá.
                                </p>
                            </div>
                        )}

                        {vacioSinLeer && (
                            <div className="py-[72px] px-6 flex flex-col items-center text-center">
                                <span className={`w-16 h-16 rounded-full flex items-center justify-center ${CHIP} ${M50}`}>
                                    <Check className="w-7 h-7" strokeWidth={2} />
                                </span>
                                <p className="mt-5 text-[18px] font-semibold">Estás al día</p>
                                <p className={`mt-2 text-[14.5px] ${M50}`}>No tenés notificaciones sin leer.</p>
                            </div>
                        )}

                        {grupos.map(g => (
                            <div key={g.label}>
                                <p className={`${ROTULO} mt-[26px] mb-2.5 ml-1.5`}>{g.label}</p>
                                <div className={`rounded-[26px] overflow-hidden ${TARJETA} ${SOMBRA}`}>
                                    <AnimatePresence initial={false}>
                                        {g.filas.map((n, i) => (
                                            <motion.div
                                                key={n.id}
                                                layout={!sinMovimiento}
                                                initial={sinMovimiento ? false : { opacity: 0, y: -14 }}
                                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                                exit={sinMovimiento
                                                    ? { opacity: 0, height: 0 }
                                                    : { opacity: 0, height: 0, transition: { duration: 0.26, ease: [0.3, 0.7, 0.2, 1] } }}
                                                transition={sinMovimiento ? { duration: 0 } : { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                                                className="overflow-hidden"
                                            >
                                                <Fila
                                                    n={n}
                                                    primera={i === 0}
                                                    brilla={!!brillo[n.id]}
                                                    onAbrir={abrir}
                                                    onAnclar={anclar}
                                                    onBorrar={borrar}
                                                    onAcciones={x => setHoja({ tipo: 'fila', id: x.id })}
                                                />
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ── El aviso de abajo ──────────────────────────────────── */}
            <AnimatePresence>
                {aviso && (
                    <motion.div
                        role="status"
                        initial={sinMovimiento ? false : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={sinMovimiento ? { opacity: 0 } : { opacity: 0, y: 14 }}
                        transition={{ duration: sinMovimiento ? 0 : 0.22 }}
                        className="fixed left-1/2 -translate-x-1/2 bottom-10 z-[130] w-max max-w-[calc(100%-32px)] px-5 py-3.5 rounded-full bg-[#0a0a0a] dark:bg-white text-white dark:text-[#0a0a0a] text-[14px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,.2)]"
                    >
                        {aviso.texto}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── La hoja ────────────────────────────────────────────
                Una sola, que cambia de adentro: pasar del menú a la
                confirmación no hace salir un panel y entrar otro, sólo
                cambia lo que muestra. Es como lo arma el .dc. */}
            <Hoja
                abierta={!!hoja && (hoja.tipo !== 'fila' || !!laDeLaHoja)}
                onCerrar={() => setHoja(null)}
                etiqueta={hoja?.tipo === 'confirmar' ? 'Borrar todas' : hoja?.tipo === 'menu' ? 'Opciones' : 'Acciones de la notificación'}
            >
                {hoja?.tipo === 'fila' && laDeLaHoja && (() => {
                    const Icono = iconoDe(laDeLaHoja.type);
                    return (
                        <>
                            <div className="flex items-center gap-3 px-1.5 pt-1.5 pb-3.5">
                                <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${CHIP} ${TINTA}`}>
                                    <Icono className="w-[19px] h-[19px]" strokeWidth={2} />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[15px] font-semibold truncate">{sinEmoji(laDeLaHoja.title)}</p>
                                    <p className={`mt-0.5 text-[13px] ${M50}`}>{timeAgo(laDeLaHoja.created_at)}</p>
                                </div>
                            </div>
                            <div className={`rounded-[22px] p-1 ${SUPERFICIE}`}>
                                <OpcionDeHoja icon={Pin} onClick={() => anclar(laDeLaHoja)}>
                                    {laDeLaHoja.is_pinned ? 'Desanclar' : 'Anclar'}
                                </OpcionDeHoja>
                                {!laDeLaHoja.is_read && (
                                    <OpcionDeHoja icon={Check} onClick={() => leerUna(laDeLaHoja)}>
                                        Marcar como leída
                                    </OpcionDeHoja>
                                )}
                                <OpcionDeHoja icon={Trash2} rojo onClick={() => borrar(laDeLaHoja)}>
                                    Borrar
                                </OpcionDeHoja>
                            </div>
                            <div className="mt-3">
                                <BotonDeHoja onClick={() => setHoja(null)}>Cancelar</BotonDeHoja>
                            </div>
                        </>
                    );
                })()}

                {hoja?.tipo === 'menu' && (
                    <>
                        <div className={`mt-1.5 rounded-[22px] p-1 ${SUPERFICIE}`}>
                            <OpcionDeHoja
                                icon={Trash2}
                                rojo
                                onClick={() => { if (hay) setHoja({ tipo: 'confirmar' }); }}
                            >
                                Borrar todas
                            </OpcionDeHoja>
                        </div>
                        <div className="mt-3">
                            <BotonDeHoja onClick={() => setHoja(null)}>Cancelar</BotonDeHoja>
                        </div>
                    </>
                )}

                {hoja?.tipo === 'confirmar' && (
                    <>
                        <div className="px-1.5 pt-2.5 pb-1 text-center">
                            <p className="text-[20px] lg:text-[21px] font-semibold tracking-[-.015em]">
                                ¿Borrar todas tus notificaciones?
                            </p>
                            <p className={`mt-2 text-[14.5px] ${M50}`}>No se puede deshacer.</p>
                        </div>
                        <div className="flex flex-col gap-2.5 mt-5">
                            <BotonDeHoja rojo onClick={borrarTodas}>Borrar todas</BotonDeHoja>
                            <BotonDeHoja onClick={() => setHoja(null)}>Cancelar</BotonDeHoja>
                        </div>
                    </>
                )}
            </Hoja>
        </div>
    );
};

export default Notifications;
