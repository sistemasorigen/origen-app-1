// ════════════════════════════════════════════════════════════════════════
// /eventos — la agenda pública de Origen.
//
// Implementa design-claude/Eventos.dc.html.
//
// La pantalla la mira cualquiera, casi siempre desde el teléfono y casi
// siempre buscando una sola cosa: qué es lo próximo y cuándo. Por eso el
// primer evento va destacado y solo, y el resto queda agrupado por mes.
//
// La portada es el flyer que subió el encargado. En las tarjetas entra
// recortada a un cuadrado —si cada una respetara su proporción, la grilla
// quedaría desparej— y el visor la muestra entera: para eso está.
//
// Los tokens, las fechas y los helpers de link salen de
// ./general/piezas.tsx, que es de donde los toma el admin de estos mismos
// eventos. Si divergen, la vista previa del formulario deja de parecerse a
// lo que la gente ve acá.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEventosGeneralPublic } from '../../services/supabaseService';
import { EventoGeneral } from '../../types';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import {
    T, rotulo, hoyIso, fechaCorta, horario, linkValido, IconoCalendario,
} from './general/piezas';

// ── Fechas que esta pantalla necesita y el admin no ─────────────────────

const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/**
 * El mediodía no es decoración: '2026-11-07' leído como instante es
 * medianoche UTC, que en Argentina cae el día anterior. Mismo criterio que
 * piezas.tsx.
 */
const comoFecha = (f: string): Date | null => {
    const d = new Date(`${(f || '').slice(0, 10)}T12:00`);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** "Sáb 7 de noviembre", o "Hoy, sábado 7 de noviembre" el mismo día. */
const fechaLarga = (f: string, hoy = hoyIso()): string => {
    const d = comoFecha(f);
    if (!d) return '';
    const cuerpo = `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`;
    return f.slice(0, 10) === hoy
        ? `Hoy, ${DIAS_LARGOS[d.getDay()]} ${cuerpo}`
        : `${DIAS_CORTOS[d.getDay()]} ${cuerpo}`;
};

/** "NOVIEMBRE", y con año cuando no es el que corre: "ENERO 2027". */
const nombreDelMes = (f: string, hoy = hoyIso()): string => {
    const d = comoFecha(f);
    if (!d) return '';
    const mes = MESES_LARGOS[d.getMonth()].toUpperCase();
    return f.slice(0, 4) === hoy.slice(0, 4) ? mes : `${mes} ${d.getFullYear()}`;
};

/**
 * "Hoy", "Mañana", "En 18 días".
 *
 * Se cuenta por días de calendario y no por horas: un evento de mañana a
 * las 9 está "en 14 horas", pero lo que la gente quiere leer es "mañana".
 */
const cuantoFalta = (f: string, hoy = hoyIso()): string => {
    const a = comoFecha(hoy);
    const b = comoFecha(f);
    if (!a || !b) return '';
    const dias = Math.round((b.getTime() - a.getTime()) / 86_400_000);
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    return `En ${dias} días`;
};

/** "Sáb 7 nov · 20:00–22:30". */
const cuando = (ev: EventoGeneral): string => {
    const h = horario(ev.startTime, ev.endTime);
    return fechaCorta(ev.startDate) + (h ? ` · ${h}` : '');
};

// ── Estilos que no son de Tailwind ──────────────────────────────────────

/**
 * Las cuatro animaciones del diseño, con su apagado para quien pidió menos
 * movimiento. Van en un <style> porque la entrada de cada tarjeta lleva su
 * propio retardo y el brillo del esqueleto es un degradado que se desplaza.
 */
const ESTILOS = `
@keyframes evIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes evFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes evZoom { from { opacity: 0; transform: scale(.9) } to { opacity: 1; transform: none } }
@keyframes evShim { from { background-position: 120% 0 } to { background-position: -120% 0 } }
.ev-entra { animation: evIn .4s ease both }
.ev-brillo {
    background-image: linear-gradient(100deg, #ebeae6 30%, #f6f5f2 50%, #ebeae6 70%);
    background-size: 240% 100%;
    animation: evShim 1.3s linear infinite;
}
.dark .ev-brillo { background-image: linear-gradient(100deg, #232321 30%, #2e2e2c 50%, #232321 70%) }
@media (prefers-reduced-motion: reduce) {
    #eventos *, #eventos *::before, #eventos *::after,
    #eventos-visor *, #eventos-visor *::before, #eventos-visor *::after {
        animation: none !important;
        transition: none !important;
    }
}
`;

// ── Piezas ──────────────────────────────────────────────────────────────

const BOTON_PRIMARIO = `w-full rounded-full ${T.primario} flex items-center justify-center gap-2.5 text-[16px] font-semibold transition-opacity hover:opacity-90 active:scale-[.98] ${T.foco}`;

const IconoReloj: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
    </svg>
);

const IconoAfuera: React.FC<{ tam?: number }> = ({ tam = 17 }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
    </svg>
);

/**
 * El botón de inscribirse.
 *
 * Es un <a> y no un <button>: lleva a otro sitio, así que el clic del
 * medio y "abrir en pestaña nueva" tienen que funcionar como en cualquier
 * enlace. Sólo se dibuja si el link es https y apunta a un dominio
 * (linkValido): el campo lo carga una persona y un `javascript:` escrito
 * ahí no puede llegar nunca a un href.
 */
const Inscribirme: React.FC<{ link: string; alto: string; className?: string }> = ({ link, alto, className = '' }) => (
    <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BOTON_PRIMARIO} ${alto} ${className}`}
    >
        Inscribirme<IconoAfuera />
    </a>
);

/**
 * La portada de un evento, siempre cuadrada.
 *
 * Mientras la imagen viaja se ve el brillo del esqueleto y recién cuando
 * terminó aparece, con un fundido: sin eso, en una conexión lenta la
 * tarjeta se dibuja con un hueco blanco que parece un error.
 *
 * Si la imagen no carga —el archivo se borró del bucket, la URL quedó
 * vieja— cae en el mismo lugar que un evento sin portada. Un cuadrado roto
 * es peor que un cuadrado que dice el nombre.
 */
const Portada: React.FC<{ ev: EventoGeneral }> = ({ ev }) => {
    const [cargada, setCargada] = useState(false);
    const [fallo, setFallo] = useState(false);

    // Si cambia el evento (el visor reusa el componente), vuelve a empezar.
    useEffect(() => { setCargada(false); setFallo(false); }, [ev.imageUrl]);

    if (!ev.imageUrl || fallo) {
        return (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-[4cqw] p-[10cqw] text-center ${T.chip}`}>
                <IconoCalendario className="w-[18%] h-auto" grosor={1.6} />
                <span className="text-[7cqw] leading-[1.1] font-bold tracking-[-.03em]">{ev.name}</span>
            </div>
        );
    }

    return (
        <>
            <img
                src={ev.imageUrl}
                alt=""
                loading="lazy"
                onLoad={() => setCargada(true)}
                onError={() => setFallo(true)}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${cargada ? 'opacity-100' : 'opacity-0'}`}
            />
            {!cargada && <span aria-hidden="true" className="ev-brillo absolute inset-0" />}
        </>
    );
};

/** El marco cuadrado que abre el visor. */
const CajaDePortada: React.FC<{
    ev: EventoGeneral;
    onAbrir: () => void;
    sombra: string;
}> = ({ ev, onAbrir, sombra }) => (
    <button
        type="button"
        onClick={onAbrir}
        aria-label={`Ver la portada de ${ev.name} completa`}
        className={`block w-full p-0 border-0 bg-transparent rounded-[22px] cursor-zoom-in ${T.foco}`}
    >
        <div
            role="img"
            aria-label={ev.imageUrl ? `Portada de ${ev.name}` : `${ev.name}, sin portada`}
            className={`relative w-full aspect-square rounded-[22px] overflow-hidden [container-type:inline-size] ${sombra} ${T.chip}`}
        >
            <Portada ev={ev} />
        </div>
    </button>
);

/**
 * La descripción, cortada a unas líneas con un "Leer más".
 *
 * El corte se decide por largo del texto y no midiendo el nodo: medir
 * obliga a dibujar, leer y volver a dibujar, y en una lista de diez
 * tarjetas eso se ve como un salto. Los umbrales son los del diseño.
 */
const Descripcion: React.FC<{
    texto: string;
    destacado: boolean;
    esMovil: boolean;
    abierto: boolean;
    onAlternar: () => void;
}> = ({ texto, destacado, esMovil, abierto, onAlternar }) => {
    const lineas = destacado ? 4 : 2;
    const altoDeLinea = destacado ? 24 : 22;
    const umbral = destacado ? (esMovil ? 150 : 260) : (esMovil ? 85 : 95);
    const largo = texto.length > umbral;
    const cortada = largo && !abierto;

    return (
        <>
            <p
                className={`${destacado ? 'mt-4 text-[15.5px]' : 'mt-3 text-[14.5px]'} m-0 overflow-hidden transition-[max-height] duration-300 text-black/[.62] dark:text-white/[.62]`}
                style={{
                    lineHeight: `${altoDeLinea}px`,
                    maxHeight: cortada ? `${lineas * altoDeLinea}px` : '640px',
                    // El degradado que desvanece la última línea cortada.
                    WebkitMaskImage: cortada ? 'linear-gradient(#000 60%, transparent)' : undefined,
                    maskImage: cortada ? 'linear-gradient(#000 60%, transparent)' : undefined,
                }}
            >
                {texto}
            </p>
            {largo && (
                <button
                    type="button"
                    onClick={onAlternar}
                    aria-expanded={abierto}
                    className={`h-11 p-0 border-0 bg-transparent ${destacado ? 'text-[14.5px] mt-0.5' : 'text-[14px]'} font-bold underline underline-offset-[3px] ${T.tinta} ${T.foco} rounded-lg`}
                >
                    {abierto ? 'Leer menos' : 'Leer más'}
                </button>
            )}
        </>
    );
};

// ── El visor de la portada ──────────────────────────────────────────────

/**
 * La portada a pantalla completa.
 *
 * Acá la imagen va entera (`object-contain`) y no recortada: el botón que
 * abre esto dice "ver la portada completa", y un flyer vertical recortado
 * al cuadrado de la tarjeta se come justo el texto de abajo, que suele ser
 * la dirección y la hora.
 *
 * Se cierra con Escape, tocando afuera, con la X, o deslizando la portada
 * hacia abajo, que es el gesto con el que se cierra cualquier visor en un
 * teléfono.
 */
const Visor: React.FC<{
    ev: EventoGeneral;
    esMovil: boolean;
    onCerrar: () => void;
}> = ({ ev, esMovil, onCerrar }) => {
    const [zoom, setZoom] = useState(false);
    const [cargada, setCargada] = useState(false);
    const [fallo, setFallo] = useState(false);
    const caja = useRef<HTMLDivElement | null>(null);
    const arrastre = useRef<{ desde: number; corrido: number } | null>(null);

    useBloqueoDeFondo(true);

    useEffect(() => {
        const alTeclado = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', alTeclado);
        return () => window.removeEventListener('keydown', alTeclado);
    }, [onCerrar]);

    // Arrastrar hacia abajo para cerrar. Con la portada ampliada no corre:
    // ahí el gesto sirve para mirar la parte de abajo.
    const empezar = (e: React.PointerEvent) => {
        if (zoom) return;
        arrastre.current = { desde: e.clientY, corrido: 0 };
        if (caja.current) caja.current.style.transition = 'none';
    };
    const mover = (e: React.PointerEvent) => {
        const a = arrastre.current;
        if (!a) return;
        const dy = Math.max(0, e.clientY - a.desde);
        a.corrido = dy;
        if (caja.current) {
            caja.current.style.transform = `translateY(${dy}px)`;
            caja.current.style.opacity = String(1 - Math.min(dy / 400, 0.5));
        }
    };
    const soltar = () => {
        const a = arrastre.current;
        if (!a) return;
        arrastre.current = null;
        if (caja.current) {
            caja.current.style.transition = 'transform .2s ease, opacity .2s ease';
            caja.current.style.transform = '';
            caja.current.style.opacity = '';
        }
        if (a.corrido > 110) onCerrar();
    };

    const link = ev.registrationLink && linkValido(ev.registrationLink) ? ev.registrationLink : null;

    return createPortal(
        <div
            id="eventos-visor"
            role="dialog"
            aria-modal="true"
            aria-label={ev.imageUrl ? `Portada de ${ev.name}` : ev.name}
            onClick={onCerrar}
            className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-[rgba(8,8,8,.94)] px-4 pb-10 lg:px-10 lg:pb-10"
            style={{
                animation: 'evFade .2s ease',
                // El visor tapa la pantalla entera, barra de estado incluida:
                // sin el inset, en un iPhone con muesca la X queda debajo del
                // reloj. El diseño reserva 64 px arriba en el teléfono por lo
                // mismo, y 40 parejos en la compu.
                paddingTop: esMovil ? 'calc(64px + env(safe-area-inset-top, 0px))' : '40px',
            }}
        >
            <style>{ESTILOS}</style>

            <button
                type="button"
                onClick={onCerrar}
                aria-label="Cerrar"
                style={{ top: 'calc(16px + env(safe-area-inset-top, 0px))' }}
                className="absolute right-4 z-10 w-11 h-11 rounded-full bg-white/[.14] text-white flex items-center justify-center hover:bg-white/25 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                </svg>
            </button>

            <div
                ref={caja}
                onClick={e => e.stopPropagation()}
                onPointerDown={empezar}
                onPointerMove={mover}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                className="w-full max-w-[420px] lg:max-w-[560px] [touch-action:pinch-zoom]"
                style={{ animation: 'evZoom .28s cubic-bezier(.2,.8,.2,1)' }}
            >
                <div
                    onClick={() => setZoom(z => !z)}
                    className={`rounded-[22px] overflow-hidden ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
                >
                    {/* `h-auto` es lo que deja ver el flyer entero, pero también
                        es lo que lo hace desaparecer si no carga: una imagen
                        rota con altura automática mide cero y el visor queda
                        vacío, sin nada que tocar. Por eso el cuadrado de
                        respaldo se dibuja igual, debajo, hasta que la imagen
                        llegue. */}
                    {ev.imageUrl && !fallo ? (
                        <>
                            <img
                                src={ev.imageUrl}
                                alt=""
                                onLoad={() => setCargada(true)}
                                onError={() => setFallo(true)}
                                className={`block w-full h-auto max-h-[64vh] object-contain transition-transform duration-[250ms] ${cargada ? '' : 'hidden'}`}
                                style={{ transform: zoom ? 'scale(2)' : 'none', transformOrigin: 'center' }}
                            />
                            {!cargada && <div className="ev-brillo w-full aspect-square" />}
                        </>
                    ) : (
                        <div className="relative w-full aspect-square bg-[#f2f2f0] [container-type:inline-size] flex flex-col items-center justify-center gap-[4cqw] p-[10cqw] text-center text-[#0a0a0a]">
                            <IconoCalendario className="w-[18%] h-auto" grosor={1.6} />
                            <span className="text-[7cqw] leading-[1.1] font-bold">{ev.name}</span>
                        </div>
                    )}
                </div>

                <p className="mt-[18px] m-0 text-[20px] font-semibold tracking-[-.02em] text-white text-center">{ev.name}</p>
                <p className="mt-1.5 m-0 text-[14px] font-semibold text-white/70 text-center">{cuando(ev)}</p>

                {link && (
                    <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="w-full h-14 mt-4 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center gap-2.5 text-[16px] font-semibold active:scale-[.98] transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                    >
                        Inscribirme<IconoAfuera />
                    </a>
                )}

                <p className="mt-3.5 m-0 text-[12.5px] text-white/60 text-center">
                    {esMovil
                        ? 'Pellizcá o tocá la portada para ampliar · Deslizá hacia abajo para cerrar'
                        : 'Clic en la portada para ampliar · Esc o clic afuera para cerrar'}
                </p>
            </div>
        </div>,
        document.body,
    );
};

// ── Esqueleto ───────────────────────────────────────────────────────────

const Esqueleto: React.FC = () => (
    <div aria-busy="true" aria-label="Cargando eventos" className="mt-7">
        <div className="grid grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)] gap-2.5 lg:gap-10 items-center">
            <div className="ev-brillo w-full aspect-square rounded-[22px]" />
            <div className="flex flex-col gap-3 px-1 py-2 lg:p-0">
                <div className="ev-brillo w-[110px] h-[30px] rounded-full" />
                <div className="ev-brillo w-[70%] h-[26px] rounded-[10px]" />
                <div className="ev-brillo w-[55%] h-4 rounded-lg" />
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-10">
            {[0, 1].map(i => (
                <div key={i} className={`rounded-[28px] p-2.5 ${T.tarjeta}`}>
                    <div className="ev-brillo w-full aspect-square rounded-[22px]" />
                    <div className={`ev-brillo h-[18px] rounded-lg mx-2.5 mt-4 mb-3 ${i === 0 ? 'w-3/5' : 'w-1/2'}`} />
                </div>
            ))}
        </div>
    </div>
);

// ── Pantalla ────────────────────────────────────────────────────────────

const useEsMovil = () => {
    const consulta = '(max-width: 1023px)';
    const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
    useEffect(() => {
        const mq = window.matchMedia(consulta);
        const cambiar = () => setEs(mq.matches);
        mq.addEventListener('change', cambiar);
        return () => mq.removeEventListener('change', cambiar);
    }, []);
    return es;
};

const Eventos: React.FC = () => {
    const [eventos, setEventos] = useState<EventoGeneral[]>([]);
    const [cargando, setCargando] = useState(true);
    // "No hay eventos" y "no pude traerlos" se veían igual: las dos como una
    // agenda vacía.
    const [fallo, setFallo] = useState(false);
    const [leer, setLeer] = useState<Record<string, boolean>>({});
    const [abierta, setAbierta] = useState<string | null>(null);
    const esMovil = useEsMovil();

    const cargar = useCallback(() => {
        setCargando(true);
        setFallo(false);
        getEventosGeneralPublic()
            .then(data => {
                const hoy = hoyIso();
                setEventos(data.filter(e => (e.startDate || '').slice(0, 10) >= hoy));
            })
            .catch(error => {
                console.error('[Eventos] No se pudieron cargar:', error);
                setFallo(true);
            })
            .finally(() => setCargando(false));
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const destacado = eventos[0];
    const resto = useMemo(() => eventos.slice(1), [eventos]);

    /** El resto, agrupado por mes y en el orden en que llegó (por fecha). */
    const meses = useMemo(() => {
        const grupos: Array<{ clave: string; mes: string; items: EventoGeneral[] }> = [];
        for (const ev of resto) {
            const clave = (ev.startDate || '').slice(0, 7);
            let g = grupos.find(x => x.clave === clave);
            if (!g) {
                g = { clave, mes: nombreDelMes(ev.startDate), items: [] };
                grupos.push(g);
            }
            g.items.push(ev);
        }
        return grupos;
    }, [resto]);

    const alternarLeer = (id: string) => setLeer(l => ({ ...l, [id]: !l[id] }));
    const evAbierta = eventos.find(e => e.id === abierta) || null;

    const linkDe = (ev: EventoGeneral) =>
        ev.registrationLink && linkValido(ev.registrationLink) ? ev.registrationLink : null;

    const esHoy = !!destacado && (destacado.startDate || '').slice(0, 10) === hoyIso();

    return (
        <div id="eventos" className={`min-h-screen ${T.fondo} ${T.tinta} ${T.fuente}`}>
            <style>{ESTILOS}</style>

            <div className="max-w-[1200px] mx-auto px-4 pt-6 pb-12 lg:px-10 lg:pt-7 lg:pb-[72px]">

                {/* ── Encabezado ── */}
                <div className="ev-entra">
                    <p className={rotulo}>ORIGEN · COMUNIDAD</p>
                    <h1 className="mt-2.5 m-0 text-[40px] lg:text-[52px] leading-none font-semibold tracking-[-.035em]">
                        Eventos
                    </h1>
                    <p className={`mt-2.5 m-0 text-[16px] leading-[1.5] ${T.suave}`}>
                        Lo que viene en Origen. Guardate la fecha.
                    </p>
                </div>

                {cargando && <Esqueleto />}

                {!cargando && fallo && (
                    <div
                        role="alert"
                        className={`ev-entra mt-7 rounded-[28px] px-6 py-11 flex flex-col items-center text-center ${T.tarjeta}`}
                    >
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={T.tenue} aria-hidden="true">
                            <path d="M2 8.5a15 15 0 0120 0M5.5 12a10 10 0 0113 0M9 15.5a5 5 0 016 0" />
                            <path d="M3 3l18 18" />
                        </svg>
                        <p className="mt-[18px] m-0 text-[19px] font-semibold">No pudimos cargar los eventos</p>
                        <p className={`mt-2 m-0 text-[15px] leading-[1.5] ${T.suave}`}>
                            Revisá la conexión y probá de nuevo.
                        </p>
                        <button
                            type="button"
                            onClick={cargar}
                            className={`h-[52px] px-7 mt-[22px] rounded-full ${T.primario} text-[15.5px] font-semibold active:scale-[.98] transition-transform ${T.foco}`}
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {!cargando && !fallo && eventos.length === 0 && (
                    <div className={`ev-entra mt-7 rounded-[28px] px-6 py-12 flex flex-col items-center text-center ${T.tarjeta}`}>
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={T.tenue} aria-hidden="true">
                            <rect x="12" y="16" width="40" height="36" rx="9" />
                            <path d="M12 27h40M23 11v9M41 11v9" />
                            <path d="M26 39h12" />
                        </svg>
                        <p className="mt-[18px] m-0 text-[19px] font-semibold">No hay eventos próximos</p>
                        <p className={`mt-2 m-0 text-[15px] leading-[1.5] ${T.suave}`}>
                            Cuando haya algo nuevo, lo vas a ver acá.
                        </p>
                    </div>
                )}

                {!cargando && !fallo && destacado && (
                    <>
                        {/* ── Lo próximo ── */}
                        <section
                            aria-label="Próximo evento"
                            className="ev-entra mt-7 grid grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)] gap-2.5 lg:gap-10 items-center"
                            style={{ animationDelay: '.05s' }}
                        >
                            <CajaDePortada
                                ev={destacado}
                                onAbrir={() => setAbierta(destacado.id)}
                                sombra="shadow-[0_2px_14px_rgba(0,0,0,.08)] dark:shadow-none"
                            />

                            <div className={`rounded-[28px] p-5 lg:p-8 ${T.tarjeta}`}>
                                {/* En negro el día del evento: ese día la pastilla
                                    es la información, no una etiqueta más. */}
                                <span
                                    className={`inline-flex items-center h-8 px-3.5 rounded-full text-[13.5px] font-bold ${esHoy ? T.primario : `${T.chip} ${T.tinta}`}`}
                                >
                                    {cuantoFalta(destacado.startDate)}
                                </span>

                                <h2 className="mt-3.5 m-0 text-[24px] lg:text-[34px] leading-[1.12] font-semibold tracking-[-.025em] [overflow-wrap:anywhere]">
                                    {destacado.name}
                                </h2>

                                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                                    <span className="flex items-center gap-[7px] text-[14.5px] font-semibold text-black/70 dark:text-white/70">
                                        <IconoCalendario className="w-4 h-4" grosor={2} />
                                        {fechaLarga(destacado.startDate)}
                                    </span>
                                    {horario(destacado.startTime, destacado.endTime) && (
                                        <span className="flex items-center gap-[7px] text-[14.5px] font-semibold text-black/70 dark:text-white/70">
                                            <IconoReloj />
                                            {horario(destacado.startTime, destacado.endTime)}
                                        </span>
                                    )}
                                </div>

                                {destacado.description && (
                                    <Descripcion
                                        texto={destacado.description}
                                        destacado
                                        esMovil={esMovil}
                                        abierto={!!leer[destacado.id]}
                                        onAlternar={() => alternarLeer(destacado.id)}
                                    />
                                )}

                                {linkDe(destacado) && (
                                    <Inscribirme link={linkDe(destacado)!} alto="h-[58px]" className="mt-[18px]" />
                                )}
                            </div>
                        </section>

                        {/* ── Más adelante ── */}
                        {meses.length > 0 && (
                            <>
                                <p className={`${rotulo} mt-12`}>MÁS ADELANTE</p>

                                {meses.map(grupo => (
                                    <div key={grupo.clave} className="mt-[22px]">
                                        <p className={`m-0 mb-3 ml-1 text-[13px] font-bold tracking-[.07em] ${T.suave}`}>
                                            {grupo.mes}
                                        </p>
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                                            {grupo.items.map((ev, i) => {
                                                const d = comoFecha(ev.startDate);
                                                return (
                                                    <article
                                                        key={ev.id}
                                                        className={`ev-entra rounded-[28px] p-2.5 ${T.tarjeta}`}
                                                        style={{ animationDelay: `${(0.12 + i * 0.06).toFixed(2)}s` }}
                                                    >
                                                        <CajaDePortada
                                                            ev={ev}
                                                            onAbrir={() => setAbierta(ev.id)}
                                                            sombra="shadow-[0_1px_8px_rgba(0,0,0,.06)] dark:shadow-none"
                                                        />
                                                        <div className="px-2.5 pt-3.5 pb-2.5">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    aria-hidden="true"
                                                                    className={`w-[54px] h-[54px] shrink-0 rounded-2xl flex flex-col items-center justify-center ${T.chip}`}
                                                                >
                                                                    <span className="text-[20px] leading-none font-bold tracking-[-.02em]">
                                                                        {d ? String(d.getDate()).padStart(2, '0') : '—'}
                                                                    </span>
                                                                    <span className={`mt-[3px] text-[10.5px] font-bold tracking-[.08em] ${T.suave}`}>
                                                                        {d ? MESES_CORTOS[d.getMonth()] : ''}
                                                                    </span>
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h3 className="m-0 text-[19px] leading-[1.2] font-semibold tracking-[-.02em] [overflow-wrap:anywhere]">
                                                                        {ev.name}
                                                                    </h3>
                                                                    <p className={`mt-1 m-0 text-[13.5px] font-semibold ${T.suave}`}>
                                                                        {cuando(ev)}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {ev.description && (
                                                                <Descripcion
                                                                    texto={ev.description}
                                                                    destacado={false}
                                                                    esMovil={esMovil}
                                                                    abierto={!!leer[ev.id]}
                                                                    onAlternar={() => alternarLeer(ev.id)}
                                                                />
                                                            )}

                                                            {linkDe(ev) && (
                                                                <Inscribirme link={linkDe(ev)!} alto="h-[52px]" className="mt-3" />
                                                            )}
                                                        </div>
                                                    </article>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </>
                )}
            </div>

            {evAbierta && (
                <Visor ev={evAbierta} esMovil={esMovil} onCerrar={() => setAbierta(null)} />
            )}
        </div>
    );
};

export default Eventos;
