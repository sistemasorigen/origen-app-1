import React from 'react';
import type { Alerta } from '../../../services/notificaciones';

/**
 * Piezas de la Gestión de notificaciones (design-claude/Sistemas - Gestion de
 * notificaciones.dc.html): fechas en hora argentina, los ejemplos de las
 * variables, las pantallas que puede abrir un push, el interruptor y la vista
 * previa del teléfono.
 */

const ZONA = 'America/Argentina/Buenos_Aires';

/** Hoy en Buenos Aires, 'YYYY-MM-DD' (para comparar con desde/hasta de la base). */
export const hoyAr = (): string =>
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** '2026-11-08T13:00:00+00:00' → 'dom 8/11, 10:00', en hora argentina. */
export const formatoProximo = (iso: string): string => {
    const partes = new Intl.DateTimeFormat('es-AR', {
        timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'numeric',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso));
    const de = (t: Intl.DateTimeFormatPartTypes) => partes.find(p => p.type === t)?.value ?? '';
    const dia = de('weekday').replace('.', '').toLowerCase();
    return `${dia} ${de('day')}/${de('month')}, ${de('hour')}:${de('minute')}`;
};

/**
 * Lo que va en "Próximo envío". Con fecha, la fecha; sin fecha, por qué:
 * pausada, ya terminó (vigencia vencida) o no le quedan días.
 */
export const textoProximo = (a: Alerta): string => {
    if (a.tipo === 'automatica') return 'Cuando pasa';
    if (!a.activa) return 'Pausada';
    if (a.proximoEnvio) return formatoProximo(a.proximoEnvio);
    if (!a.siempreActiva && a.hasta && a.hasta < hoyAr()) return 'Terminó';
    return 'Sin más envíos';
};

/**
 * Los ejemplos de las variables. Los MISMOS que usa la base para la prueba
 * (notif_ejemplos(), sql/notif_prueba.sql): la vista previa y el push de
 * prueba dicen lo mismo.
 */
export const EJEMPLOS: Record<string, string> = {
    nombre: 'Sofía Ejemplo', pareja: 'Martín Ejemplo', grupo: 'GCX Palermo Martes', fecha: '28/10',
    horario: '20:00 – 21:30', presentes: '7', dia: 'Martes', motivo: ' Motivo: faltan el día y el horario.',
    tarea: 'Armar la mesa de bienvenida', departamento: 'Bienvenida', subdepartamento: 'Recepción',
    detalle: 'Necesitamos un flyer para el anuncio del domingo', codigo: 'REP-0001', numero: '0001',
    tipo: 'Acceso a mis datos', pantalla: 'Eventos', resultado: 'aprobado', pedido: 'la baja',
};

/** El texto con las variables reemplazadas, como lo arma notif_render. */
export const conEjemplos = (t: string): string =>
    t.replace(/\{([a-z][a-z0-9_]{0,29})\}/g, (_, k: string) => EJEMPLOS[k] ?? '').replace(/\s+/g, ' ').trim();

/**
 * Las pantallas que puede abrir una programada. Sólo rutas internas de la app
 * (las que acepta notif_url_interna): un push con la marca de Origen nunca
 * abre un link de afuera.
 */
export const PANTALLAS: { ruta: string; nombre: string }[] = [
    { ruta: '/notificaciones', nombre: 'Notificaciones' },
    { ruta: '/', nombre: 'Inicio' },
    { ruta: '/gcx', nombre: 'GCX · Grupos de Conexión' },
    { ruta: '/mis-grupos', nombre: 'Mis grupos' },
    { ruta: '/eventos', nombre: 'Eventos' },
    { ruta: '/agenda', nombre: 'Agenda Origen' },
    { ruta: '/perfil', nombre: 'Mi cuenta' },
    { ruta: '/perfil/compras', nombre: 'Mi cuenta · Mis compras' },
    { ruta: '/prode', nombre: 'Prode Mundial' },
    { ruta: '/trivia', nombre: 'Trivia' },
    { ruta: '/tutoriales', nombre: 'Tutoriales' },
];

export const nombreDePantalla = (ruta: string | null): string =>
    PANTALLAS.find(p => p.ruta === ruta)?.nombre ?? ruta ?? 'Inicio';

/** Una ruta de la app escrita a mano ("/gcx"): la regla de notif_url_interna. */
export const esRutaInterna = (url: string): boolean => {
    const u = url.trim();
    return u.startsWith('/') && !u.startsWith('//') && !/https?:/i.test(u)
        && !/[\s\u0000-\u001f\\]/.test(u) && u.length <= 300;
};

/** Una página de afuera: sólo https://, con dominio. La regla de notif_url_externa. */
export const esUrlExterna = (url: string): boolean => {
    const u = url.trim();
    return u.length <= 500 && !u.includes('\\') && !/[\u0000-\u001f\s]/.test(u)
        && /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?([/?#].*)?$/i.test(u);
};

/** Lo que acepta la base como destino de una programada (notif_url_destino). */
export const destinoValido = (url: string): boolean => esRutaInterna(url) || esUrlExterna(url);

/** El interruptor del diseño: pista negra con la perilla blanca. */
export const Perilla: React.FC<{ on: boolean; chico?: boolean }> = ({ on, chico }) => (
    <span
        aria-hidden="true"
        className={`relative inline-flex flex-none items-center rounded-full transition-colors ${chico ? 'h-[18px] w-[30px]' : 'h-[26px] w-[44px]'} ${on ? 'bg-[#0a0a0a]' : 'bg-black/[.18]'}`}
    >
        <span
            className={`absolute rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-transform ${chico ? 'left-[2px] h-[14px] w-[14px]' : 'left-[3px] h-5 w-5'}`}
            style={{ transform: on ? `translateX(${chico ? 12 : 18}px)` : 'none' }}
        />
    </span>
);

/** La pastilla gris de "Automática" / "Programada". */
export const Etiqueta: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="inline-flex h-[22px] flex-none items-center rounded-full bg-[#f2f2f0] px-2.5 text-[11.5px] font-bold text-black/[.62]">
        {children}
    </span>
);

/** Rótulo de cada paso del editor ("1 · NOMBRE DE LA ALERTA"). */
export const RotuloPaso: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
    <span id={id} className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/[.58]">{children}</span>
);

export const ErrorDeCampo: React.FC<{ id?: string; children: React.ReactNode }> = ({ id, children }) => (
    <span id={id} role="alert" className="text-[12.5px] font-bold text-[#b42318]">{children}</span>
);

/** El ícono de la app en la notificación. */
const IconoApp: React.FC<{ tam: number }> = ({ tam }) => (
    <span
        aria-hidden="true"
        className="flex flex-none items-center justify-center rounded-[9px] bg-[#0a0a0a] font-extrabold text-white"
        style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.5) }}
    >
        O
    </span>
);

/**
 * Cómo se ve en el teléfono: la pantalla bloqueada del iPhone y la persiana de
 * Android, con las variables reemplazadas por los ejemplos. Los recortes son
 * los de send-push (80 y 180).
 */
export const VistaPrevia: React.FC<{ titulo: string; mensaje: string }> = ({ titulo, mensaje }) => {
    const t = conEjemplos(titulo) || 'El título de la notificación';
    const m = conEjemplos(mensaje) || 'Lo que la persona lee en la pantalla bloqueada.';
    const corta = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
    return (
        <div className="flex flex-col gap-2.5" aria-label="Vista previa en el teléfono">
            <span className="text-[13px] font-bold text-black/[.62]">Vista previa</span>
            <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
                <figure className="m-0 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-[26px] bg-[linear-gradient(160deg,#3a3f4b,#1d1f25)] px-3 pb-4 pt-3.5 text-white">
                        <p className="m-0 text-center text-[11px] font-semibold text-white/75">jueves 29 de octubre</p>
                        <p className="m-0 text-center text-[34px] font-semibold leading-none tracking-[-0.02em]">9:41</p>
                        <div className="mt-3.5 flex gap-2.5 rounded-[18px] bg-white/[.82] p-2.5 text-[#0a0a0a] backdrop-blur">
                            <IconoApp tam={30} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-[13px] font-bold">{corta(t, 80)}</span>
                                    <span className="flex-none text-[11px] font-medium text-black/50">ahora</span>
                                </div>
                                <p className="m-0 mt-0.5 line-clamp-3 text-[12.5px] font-medium leading-[1.35] text-black/[.78]">{corta(m, 180)}</p>
                            </div>
                        </div>
                    </div>
                    <figcaption className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/[.5]">iPhone</figcaption>
                </figure>
                <figure className="m-0 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-[26px] bg-[#e9eef5] px-3 pb-4 pt-3.5">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-black/60">
                            <span>9:41</span><span>jue, 29 oct</span>
                        </div>
                        <div className="mt-3.5 rounded-[20px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,.06)]">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-black/55">
                                <IconoApp tam={16} /> Origen · ahora
                            </div>
                            <p className="m-0 mt-1.5 truncate text-[13.5px] font-bold text-[#0a0a0a]">{corta(t, 80)}</p>
                            <p className="m-0 mt-0.5 line-clamp-3 text-[12.5px] font-medium leading-[1.4] text-black/[.7]">{corta(m, 180)}</p>
                        </div>
                    </div>
                    <figcaption className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-black/[.5]">Android</figcaption>
                </figure>
            </div>
        </div>
    );
};

export const Cargando: React.FC<{ tam?: number }> = ({ tam = 16 }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin motion-reduce:animate-none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
        <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);
