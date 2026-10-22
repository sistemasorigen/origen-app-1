import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    gestionarReporte, reportesSistemas, urlCapturaReporte,
    type AccionDeReporte, type EstadoDeReporte, type ReporteSistemas,
} from '../../services/miCuenta';
import { linkDeWhatsApp } from '../../src/utils/whatsapp';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * /panel-admin/reportes — design-claude/Panel Admin - Reportes.dc.html.
 *
 * Vive adentro del layout de Administrador.tsx: la cabecera (título, resumen
 * y la navegación con la pastilla de nuevos) es la de ese layout, y esto es
 * el cuerpo: buscador, filtros, la planilla (tarjetas en el teléfono) y el
 * detalle. Todo lee de reportes_admin() y escribe con gestionar_reporte()
 * (sql/reportes_sistemas.sql), que sólo responden a SUPER_ADMIN.
 *
 *   · Abrir un reporte nuevo lo pasa solo a "visto".
 *   · ?id=<id> abre ese reporte: es el link del email y de la notificación.
 *   · La captura se pide firmada (5 minutos) recién al abrir el detalle.
 */

const PANTALLAS_DEL_FORMULARIO = ['Inicio', 'Grupos', 'Eventos', 'Compras', 'Mi cuenta', 'Otra'];
const POR_PAGINA = 8;

const ESTILOS = `
#rep-sistemas {
  --r-bg:#f6f6f4; --r-card:#ffffff; --r-chip:#f2f2f0; --r-hover:#fafaf8; --r-sel:#f2f2f0;
  --r-ink:#0a0a0a; --r-inv:#ffffff; --r-m62:rgba(0,0,0,.64); --r-m55:rgba(0,0,0,.56); --r-m42:rgba(0,0,0,.46);
  --r-line:rgba(0,0,0,.07); --r-lineS:rgba(0,0,0,.16); --r-shadow:0 1px 2px rgba(0,0,0,.04), 0 2px 10px rgba(0,0,0,.03);
  --r-red:#d93025; --r-redBg:#fdecea; --r-redInk:#a8231a; --r-grn:#118f46; --r-grnBg:#e7f4eb;
  --r-amb:#8a5200; --r-ambBg:#fdf1dc; --r-shim:#fafaf8;
  --r-av0:#e3ece5; --r-av1:#efe6dc; --r-av2:#e2e6ee; --r-av3:#efe2e8;
  font-family: Manrope, system-ui, sans-serif; color: var(--r-ink);
}
/* Sin variante oscura: el layout de Administrador es claro siempre, y unas
   tarjetas oscuras sobre su fondo claro quedarían como un parche. */
#rep-sistemas .rep-mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
#rep-sistemas :focus-visible { outline: 2px solid var(--r-ink); outline-offset: 2px; }
/* El detalle toma el foco al abrir sólo para que el teclado entre ahí: un
   anillo alrededor de todo el panel no dice nada. */
#rep-sistemas aside[tabindex="-1"]:focus, #rep-sistemas aside[tabindex="-1"]:focus-visible { outline: none !important; }
#rep-sistemas input[type="search"] {
  border: 0 !important; background: transparent !important; color: var(--r-ink) !important;
  border-radius: 0 !important; outline: none !important; box-shadow: none !important;
}
#rep-sistemas textarea.rep-nota {
  border: 0 !important; background: var(--r-card) !important; color: var(--r-ink) !important;
  border-radius: 16px !important;
}
#rep-sistemas textarea.rep-nota:focus { box-shadow: 0 0 0 2px var(--r-ink) !important; outline: none !important; }
#rep-sistemas ::placeholder { color: var(--r-m42) !important; }
@keyframes rpIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
@keyframes rpSlide { from { transform:translateX(100%) } to { transform:none } }
@keyframes rpFade { from { opacity:0 } to { opacity:1 } }
@keyframes rpShim { from { background-position:120% 0 } to { background-position:-120% 0 } }
#rep-sistemas .rep-brillo {
  background: linear-gradient(90deg, var(--r-chip) 30%, var(--r-shim) 50%, var(--r-chip) 70%);
  background-size: 300% 100%; animation: rpShim 1.4s linear infinite;
}
#rep-sistemas .rep-fila:hover { background: var(--r-hover); }
#rep-sistemas .rep-chip:hover { filter: brightness(.97); }
@media (prefers-reduced-motion: reduce) {
  #rep-sistemas *, #rep-sistemas *::before, #rep-sistemas *::after { animation: none !important; transition: none !important; }
}
`;

// ── Formatos ────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dosDigitos = (n: number) => String(n).padStart(2, '0');
const hora = (d: Date) => `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
/** "22 oct · 11:05" */
const fechaCorta = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} · ${hora(d)}`; };
/** "22 de octubre de 2026 a las 11:05" */
const fechaLarga = (iso: string) => { const d = new Date(iso); return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()} a las ${hora(d)}`; };

const iniciales = (nombre: string | null) =>
    (nombre || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** El navegador, contado por su user agent. */
const navegadorDe = (ua: string | null): string => {
    if (!ua) return '—';
    const m = (re: RegExp) => ua.match(re)?.[1];
    if (/Edg\//.test(ua)) return `Edge ${m(/Edg\/(\d+)/) || ''}`.trim();
    if (/OPR\//.test(ua)) return `Opera ${m(/OPR\/(\d+)/) || ''}`.trim();
    if (/Firefox\//.test(ua)) return `Firefox ${m(/Firefox\/(\d+)/) || ''}`.trim();
    if (/CriOS\//.test(ua)) return `Chrome ${m(/CriOS\/(\d+)/) || ''}`.trim();
    if (/Chrome\//.test(ua)) return `Chrome ${m(/Chrome\/(\d+)/) || ''}`.trim();
    if (/Safari\//.test(ua)) return `Safari ${m(/Version\/([\d.]+)/) || ''}`.trim();
    return '—';
};

const PASTILLA: Record<EstadoDeReporte, { t: string; bg: string; ink: string; punto?: boolean }> = {
    nuevo: { t: 'Nuevo', bg: 'var(--r-redBg)', ink: 'var(--r-redInk)', punto: true },
    visto: { t: 'Visto', bg: 'var(--r-chip)', ink: 'var(--r-m62)' },
    resuelto: { t: 'Resuelto', bg: 'var(--r-grnBg)', ink: 'var(--r-grn)' },
};

const Pastilla: React.FC<{ estado: EstadoDeReporte; grande?: boolean }> = ({ estado, grande }) => {
    const p = PASTILLA[estado];
    return (
        <span
            className={`${grande ? 'h-8 px-[13px] text-[13.5px]' : 'h-7 px-[11px] text-[12.5px]'} rounded-full inline-flex items-center gap-[7px] font-bold whitespace-nowrap`}
            style={{ background: p.bg, color: p.ink, transition: 'background .5s ease, color .5s ease' }}
        >
            {p.punto && <span className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--r-red)' }} />}
            {p.t}
        </span>
    );
};

const Svg: React.FC<{ tam?: number; grosor?: number; children: React.ReactNode; relleno?: boolean }> = ({ tam = 16, grosor = 2, children, relleno }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill={relleno ? 'currentColor' : 'none'} stroke={relleno ? 'none' : 'currentColor'}
        strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{children}</svg>
);
const Tilde = ({ tam = 16 }) => <Svg tam={tam} grosor={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;

/** El texto de "Copiar todo", con el mismo orden del diseño. */
const textoDelReporte = (r: ReporteSistemas) =>
    `${r.codigo} · ${r.pantalla || 'Sin pantalla'}\n` +
    `Enviado por: ${r.nombre || 'Sin nombre'} · ${r.email || 'sin email'}${r.telefono ? ' · ' + r.telefono : ''}\n` +
    `Fecha: ${fechaLarga(r.createdAt)}\n` +
    `Estado: ${PASTILLA[r.estado].t}\n\n` +
    `Qué pasó:\n${r.descripcion}\n\n` +
    `Captura: ${r.capturaPath ? 'sí (en el panel)' : 'no'}\n` +
    `Versión: ${r.versionApp || '—'}\n` +
    `Dispositivo: ${r.dispositivo || '—'}\n` +
    `Navegador: ${navegadorDe(r.dispositivo)}` +
    (r.notaInterna ? `\n\nNota interna: ${r.notaInterna}` : '');

const copiar = async (texto: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; }
    } catch { /* cae al respaldo */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = texto; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch { return false; }
};

// ════════════════════════════════════════════════════════════════════════

interface Props {
    /** Nombre de pila de quien gestiona, para el historial mientras no se recarga. */
    miNombre: string;
    /** Para la cabecera del layout: nuevos y total. */
    onResumen?: (nuevos: number, total: number) => void;
}

const ReportesSistemas: React.FC<Props> = ({ miNombre, onResumen }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [lista, setLista] = useState<ReporteSistemas[] | null | 'error'>(null);
    const [q, setQ] = useState('');
    const [filtro, setFiltro] = useState<'todos' | EstadoDeReporte>('todos');
    const [pant, setPant] = useState<string | null>(null);
    const [pantAbierto, setPantAbierto] = useState(false);
    const [pagina, setPagina] = useState(0);
    const [selId, setSelId] = useState<string | null>(null);
    const [nota, setNota] = useState('');
    const [copiado, setCopiado] = useState(false);
    const [visor, setVisor] = useState(false);
    const [zoom, setZoom] = useState(false);
    const [captura, setCaptura] = useState<{ id: string; url: string | null; cargando: boolean } | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    const filaQueAbrio = useRef<HTMLElement | null>(null);
    const panelRef = useRef<HTMLElement>(null);
    const pantRef = useRef<HTMLDivElement>(null);
    const avisoT = useRef(0);

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    const avisar = (t: string) => {
        window.clearTimeout(avisoT.current);
        setAviso(t);
        avisoT.current = window.setTimeout(() => setAviso(null), 2200);
    };

    const cargar = useCallback(() => {
        setLista(null);
        reportesSistemas().then(l => setLista(l ?? 'error'));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const reportes = Array.isArray(lista) ? lista : [];
    const nuevos = reportes.filter(r => r.estado === 'nuevo').length;
    useEffect(() => { if (Array.isArray(lista)) onResumen?.(nuevos, reportes.length); }, [lista, nuevos]); // eslint-disable-line react-hooks/exhaustive-deps

    const cambiar = (id: string, cambios: Partial<ReporteSistemas>) =>
        setLista(prev => Array.isArray(prev) ? prev.map(r => r.id === id ? { ...r, ...cambios } : r) : prev);

    // ── Filtros ─────────────────────────────────────────────────────────
    const pantallas = useMemo(() => {
        const vistas = new Set(PANTALLAS_DEL_FORMULARIO);
        reportes.forEach(r => { if (r.pantalla) vistas.add(r.pantalla); });
        return [...vistas];
    }, [lista]); // eslint-disable-line react-hooks/exhaustive-deps

    const busqueda = q.trim().toLowerCase();
    const filtrados = useMemo(() => reportes.filter(r =>
        (filtro === 'todos' || r.estado === filtro)
        && (!pant || r.pantalla === pant)
        && (!busqueda
            || r.codigo.toLowerCase().includes(busqueda)
            || (r.nombre || '').toLowerCase().includes(busqueda)
            || r.descripcion.toLowerCase().includes(busqueda))
    ), [lista, filtro, pant, busqueda]); // eslint-disable-line react-hooks/exhaustive-deps

    const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    const pag = Math.min(pagina, paginas - 1);
    const visibles = filtrados.slice(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA);

    useEffect(() => {
        if (!pantAbierto) return;
        const fuera = (e: MouseEvent) => { if (pantRef.current && !pantRef.current.contains(e.target as Node)) setPantAbierto(false); };
        const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setPantAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
    }, [pantAbierto]);

    // ── El detalle ──────────────────────────────────────────────────────
    const sel = selId ? reportes.find(r => r.id === selId) || null : null;
    const idx = sel ? filtrados.findIndex(r => r.id === sel.id) : -1;

    const abrir = useCallback((r: ReporteSistemas, desde?: HTMLElement | null) => {
        if (desde) filaQueAbrio.current = desde;
        setSelId(r.id);
        setNota(r.notaInterna || '');
        setCopiado(false);
        setVisor(false);
        setZoom(false);
        setPantAbierto(false);
        // El link queda en la URL: recargar o compartirlo abre el mismo.
        setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('id', r.id); return p; }, { replace: true });

        if (r.estado === 'nuevo') {
            gestionarReporte(r.id, 'visto').then(ok => {
                if (ok) cambiar(r.id, { estado: 'visto', vistoAt: new Date().toISOString(), vistoPor: miNombre });
            });
        }

        if (r.capturaPath) {
            setCaptura({ id: r.id, url: null, cargando: true });
            urlCapturaReporte(r.capturaPath).then(url => setCaptura(c => c && c.id === r.id ? { id: r.id, url, cargando: false } : c));
        } else {
            setCaptura(null);
        }
    }, [miNombre, setSearchParams]);

    const cerrar = useCallback(() => {
        setSelId(null);
        setVisor(false);
        setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('id'); return p; }, { replace: true });
        window.setTimeout(() => filaQueAbrio.current?.focus?.(), 0);
    }, [setSearchParams]);

    // ?id=<id>: el link del email y de la notificación.
    const idDeLaUrl = searchParams.get('id');
    useEffect(() => {
        if (!Array.isArray(lista) || !idDeLaUrl || idDeLaUrl === selId) return;
        const r = lista.find(x => x.id === idDeLaUrl);
        if (r) {
            // Que el reporte esté en la lista filtrada, para anterior/siguiente.
            setFiltro('todos'); setPant(null); setQ('');
            const pos = lista.indexOf(r);
            setPagina(Math.floor(pos / POR_PAGINA));
            abrir(r);
        } else {
            avisar('Ese reporte no existe o se borró');
            setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('id'); return p; }, { replace: true });
        }
    }, [lista, idDeLaUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    const ir = (d: -1 | 1) => {
        const otro = filtrados[idx + d];
        if (!otro) return;
        abrir(otro);
        setPagina(Math.floor((idx + d) / POR_PAGINA));
    };

    // Teclado: Escape cierra el visor o el detalle; el foco entra al panel.
    useEffect(() => {
        if (!sel) return;
        const t = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 0);
        const tecla = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (visor) setVisor(false); else cerrar();
        };
        document.addEventListener('keydown', tecla);
        return () => { window.clearTimeout(t); document.removeEventListener('keydown', tecla); };
    }, [sel?.id, visor, cerrar]); // eslint-disable-line react-hooks/exhaustive-deps

    // En el teléfono el detalle tapa todo: el fondo no scrollea detrás.
    useBloqueoDeFondo(!!sel && esMovil);

    const gestionar = async (r: ReporteSistemas, accion: AccionDeReporte) => {
        const ok = await gestionarReporte(r.id, accion, accion === 'nota' ? nota : undefined);
        if (!ok) { avisar('No se pudo guardar. Probá de nuevo.'); return; }
        const ahora = new Date().toISOString();
        if (accion === 'visto') cambiar(r.id, { estado: 'visto', vistoAt: ahora, vistoPor: miNombre });
        if (accion === 'resuelto') {
            cambiar(r.id, { estado: 'resuelto', resueltoAt: ahora, resueltoPor: miNombre, vistoAt: r.vistoAt || ahora, vistoPor: r.vistoPor || miNombre });
            avisar(`${r.codigo} marcado como resuelto`);
        }
        if (accion === 'reabrir') { cambiar(r.id, { estado: 'visto', reabiertoAt: ahora, reabiertoPor: miNombre }); avisar(`${r.codigo} volvió a abrirse`); }
        if (accion === 'nota') { cambiar(r.id, { notaInterna: nota.trim() || null, notaEditadaAt: ahora }); avisar('Nota guardada'); }
    };

    // ── Estados de la planilla ──────────────────────────────────────────
    const hayBusqueda = !!busqueda;
    const vacio = lista === 'error'
        ? { t: 'No pudimos cargar los reportes', s: 'Revisá la conexión y probá de nuevo.', cta: 'Reintentar', icono: 'error', alerta: true, go: cargar, oscuro: true }
        : Array.isArray(lista) && lista.length === 0
            ? { t: 'No hay reportes todavía', s: 'Cuando alguien reporte un problema desde Mi cuenta, va a aparecer acá.', icono: 'vacio' }
            : Array.isArray(lista) && filtrados.length === 0
                ? {
                    t: 'Ningún reporte coincide',
                    s: hayBusqueda ? `No encontramos nada con “${q.trim()}”. Probá con un código, un nombre u otra palabra.` : 'Probá con otro estado o pantalla.',
                    cta: 'Limpiar búsqueda', icono: 'busqueda', go: () => { setQ(''); setFiltro('todos'); setPant(null); },
                }
                : null;

    const filtros: { k: 'todos' | EstadoDeReporte; t: string; n?: number }[] = [
        { k: 'todos', t: 'Todos' }, { k: 'nuevo', t: 'Nuevos', n: nuevos }, { k: 'visto', t: 'Vistos' }, { k: 'resuelto', t: 'Resueltos' },
    ];

    const colorAvatar = (n: number) => `var(--r-av${n % 4})`;
    const sombra = { boxShadow: 'var(--r-shadow)' };

    // ── Historial del detalle ───────────────────────────────────────────
    const historial = sel ? [
        { t: 'Recibido', at: sel.createdAt },
        ...(sel.vistoAt ? [{ t: `Visto${sel.vistoPor ? ` por ${sel.vistoPor}` : ''}`, at: sel.vistoAt }] : []),
        ...(sel.resueltoAt ? [{ t: `Resuelto${sel.resueltoPor ? ` por ${sel.resueltoPor}` : ''}`, at: sel.resueltoAt }] : []),
        ...(sel.reabiertoAt ? [{ t: `Reabierto${sel.reabiertoPor ? ` por ${sel.reabiertoPor}` : ''}`, at: sel.reabiertoAt }] : []),
    ].sort((a, b) => a.at.localeCompare(b.at)) : [];

    const notaCambio = !!sel && nota.trim() !== (sel.notaInterna || '').trim();
    const rotulo = 'm-0 text-[12px] font-semibold tracking-[.07em]';
    const ROT: React.CSSProperties = { color: 'var(--r-m42)' };
    const waLink = sel ? linkDeWhatsApp(sel.telefono) : null;

    return (
        <div id="rep-sistemas">
            <style>{ESTILOS}</style>

            {/* Buscador y pantalla */}
            <div className="flex flex-wrap gap-2.5 items-center">
                <div className="flex-[1_1_280px] min-w-0 h-12 rounded-full flex items-center gap-2.5 pl-[18px] pr-1.5" style={{ background: 'var(--r-card)', ...sombra }}>
                    <span style={{ color: 'var(--r-m55)' }}><Svg grosor={2.2}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Svg></span>
                    <input
                        type="search"
                        value={q}
                        onChange={e => { setQ(e.target.value); setPagina(0); }}
                        aria-label="Buscar reportes"
                        placeholder="Buscar por código, nombre o texto"
                        className="flex-1 min-w-0 h-full text-[15px] font-medium"
                    />
                    {q && (
                        <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda"
                            className="w-9 h-9 flex-none border-0 rounded-full flex items-center justify-center cursor-pointer"
                            style={{ background: 'var(--r-chip)', color: 'var(--r-ink)' }}>
                            <Svg tam={12} grosor={2.6}><path d="M6 6l12 12M18 6L6 18" /></Svg>
                        </button>
                    )}
                </div>
                <div className="relative flex-none" ref={pantRef}>
                    <button
                        type="button"
                        onClick={() => setPantAbierto(v => !v)}
                        aria-expanded={pantAbierto}
                        aria-haspopup="listbox"
                        className="h-12 pl-[18px] pr-4 border-0 rounded-full flex items-center gap-2.5 text-[14.5px] font-semibold cursor-pointer whitespace-nowrap"
                        style={{ background: 'var(--r-card)', color: 'var(--r-ink)', ...sombra }}
                    >
                        <span className="text-[11px] font-bold tracking-[.07em]" style={ROT}>PANTALLA</span>
                        <span>{pant || 'Todas'}</span>
                        <Svg tam={13} grosor={2.4}><path d="M6 9l6 6 6-6" /></Svg>
                    </button>
                    {pantAbierto && (
                        <div role="listbox" aria-label="Pantalla" className={`absolute top-[54px] ${esMovil ? 'right-0' : 'left-0'} z-[15] w-[240px] rounded-[20px] p-1.5`}
                            style={{ background: 'var(--r-card)', boxShadow: '0 14px 40px rgba(0,0,0,.18)', animation: 'rpIn .18s ease both' }}>
                            {[null, ...pantallas].map(p => {
                                const on = pant === p;
                                return (
                                    <button key={p || 'todas'} type="button" role="option" aria-selected={on}
                                        onClick={() => { setPant(p); setPantAbierto(false); setPagina(0); }}
                                        className="rep-chip w-full h-11 px-3 border-0 rounded-[14px] flex items-center justify-between text-[14.5px] cursor-pointer"
                                        style={{ background: on ? 'var(--r-chip)' : 'transparent', color: 'var(--r-ink)', fontWeight: on ? 700 : 500 }}>
                                        <span>{p || 'Todas'}</span>
                                        {on && <Tilde tam={15} />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Estados */}
            <div role="tablist" aria-label="Estado" className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
                {filtros.map(f => {
                    const on = filtro === f.k;
                    return (
                        <button key={f.k} type="button" role="tab" aria-selected={on}
                            onClick={() => { setFiltro(f.k); setPagina(0); }}
                            className="h-11 px-4 flex-none border-0 rounded-full flex items-center gap-[7px] text-[14px] font-semibold cursor-pointer whitespace-nowrap"
                            style={{ background: on ? 'var(--r-ink)' : 'var(--r-card)', color: on ? 'var(--r-inv)' : 'var(--r-ink)' }}>
                            <span>{f.t}</span>
                            {!!f.n && <span className="text-[12.5px] font-bold" style={{ color: on ? 'var(--r-inv)' : 'var(--r-red)' }}>{f.n}</span>}
                        </button>
                    );
                })}
            </div>

            {lista === null && (
                <div aria-busy="true" aria-label="Cargando reportes" className="mt-4 rounded-[26px] py-2" style={{ background: 'var(--r-card)', ...sombra }}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-4 px-[22px] py-4" style={{ borderTop: i ? '1px solid var(--r-line)' : 0 }}>
                            <div className="rep-brillo w-[74px] h-3.5 rounded-[7px] flex-none" />
                            <div className="rep-brillo w-8 h-8 rounded-full flex-none" />
                            <div className="flex-1 flex flex-col gap-2"><div className="rep-brillo w-[45%] h-3.5 rounded-[7px]" /><div className="rep-brillo w-[70%] h-3 rounded-md" /></div>
                            <div className="rep-brillo w-[70px] h-[26px] rounded-full flex-none" />
                        </div>
                    ))}
                </div>
            )}

            {vacio && (
                <div role={vacio.alerta ? 'alert' : undefined} className="mt-4 rounded-[26px] px-6 py-14 flex flex-col items-center text-center"
                    style={{ background: 'var(--r-card)', ...sombra, animation: 'rpIn .3s ease both' }}>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--r-chip)', color: 'var(--r-m55)' }}>
                        {vacio.icono === 'vacio' && <Svg tam={34} grosor={1.7}><path d="M4 13l2.5-7h11L20 13v5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18z" /><path d="M4 13h4.5l1 2h5l1-2H20" /></Svg>}
                        {vacio.icono === 'busqueda' && <Svg tam={34} grosor={1.7}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4M8.5 11h5" /></Svg>}
                        {vacio.icono === 'error' && <Svg tam={34} grosor={1.7}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></Svg>}
                    </div>
                    <h3 className="mt-5 mb-0 text-[20px] font-semibold tracking-[-.02em]">{vacio.t}</h3>
                    <p className="mt-2 mb-0 max-w-[360px] text-[15px] leading-[1.5] [text-wrap:pretty]" style={{ color: 'var(--r-m55)' }}>{vacio.s}</p>
                    {vacio.cta && vacio.go && (
                        <button type="button" onClick={vacio.go} className="mt-[22px] h-12 px-6 border-0 rounded-full text-[15px] font-semibold cursor-pointer"
                            style={vacio.oscuro ? { background: 'var(--r-ink)', color: 'var(--r-inv)' } : { background: 'var(--r-chip)', color: 'var(--r-ink)' }}>
                            {vacio.cta}
                        </button>
                    )}
                </div>
            )}

            {/* La planilla (PC) */}
            {!vacio && Array.isArray(lista) && !esMovil && (
                <div role="table" aria-label="Reportes" className="mt-4 rounded-[26px] overflow-hidden" style={{ background: 'var(--r-card)', ...sombra }}>
                    <div role="row" className="grid gap-4 px-[22px] py-3.5 text-[11.5px] font-bold tracking-[.07em]"
                        style={{ gridTemplateColumns: 'var(--rep-cols)', ['--rep-cols' as string]: '110px minmax(0,2.2fr) minmax(0,1fr) 140px 120px 120px', borderBottom: '1px solid var(--r-line)', color: 'var(--r-m42)' }}>
                        <span role="columnheader">CÓDIGO</span><span role="columnheader">NOMBRE Y APELLIDO</span><span role="columnheader">PANTALLA</span>
                        <span role="columnheader">FECHA Y HORA</span><span role="columnheader">ESTADO</span><span role="columnheader"><span className="sr-only">Acciones</span></span>
                    </div>
                    {visibles.map((r, i) => {
                        const nu = r.estado === 'nuevo';
                        const tinta = nu ? 'var(--r-ink)' : 'var(--r-m62)';
                        return (
                            <div key={r.id} role="row" onClick={e => abrir(r, (e.currentTarget.querySelector('button') as HTMLElement) || null)}
                                className="rep-fila grid gap-4 items-center min-h-16 px-[22px] py-2 cursor-pointer"
                                style={{
                                    gridTemplateColumns: '110px minmax(0,2.2fr) minmax(0,1fr) 140px 120px 120px',
                                    borderTop: i ? '1px solid var(--r-line)' : 0,
                                    background: selId === r.id ? 'var(--r-sel)' : undefined,
                                    transition: 'background .15s', animation: `rpIn .3s ease both`, animationDelay: `${i * 35}ms`,
                                }}>
                                <span role="cell" className="rep-mono text-[13.5px] font-semibold" style={{ color: tinta }}>{r.codigo}</span>
                                <span role="cell" className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-8 h-8 flex-none rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: colorAvatar(r.numero) }}>{iniciales(r.nombre)}</span>
                                    <span className="min-w-0 flex flex-col">
                                        <span className="text-[14.5px] truncate" style={{ fontWeight: nu ? 700 : 500 }}>{r.nombre || 'Sin nombre'}</span>
                                        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--r-m55)' }}>{r.descripcion.replace(/\s+/g, ' ')}</span>
                                    </span>
                                </span>
                                <span role="cell" className="text-[14px]" style={{ fontWeight: nu ? 700 : 500, color: tinta }}>{r.pantalla || 'Sin pantalla'}</span>
                                <span role="cell" className="text-[14px] whitespace-nowrap" style={{ fontWeight: nu ? 700 : 500, color: tinta }}>{fechaCorta(r.createdAt)}</span>
                                <span role="cell"><Pastilla estado={r.estado} /></span>
                                <span role="cell" className="flex justify-end">
                                    <button type="button" onClick={e => { e.stopPropagation(); abrir(r, e.currentTarget); }}
                                        className="rep-chip h-10 px-3.5 border-0 rounded-full text-[13.5px] font-semibold cursor-pointer whitespace-nowrap"
                                        style={{ background: 'var(--r-chip)', color: 'var(--r-ink)' }}>
                                        Ver detalles
                                    </button>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Tarjetas (teléfono) */}
            {!vacio && Array.isArray(lista) && esMovil && (
                <div className="mt-3.5 flex flex-col gap-2.5">
                    {visibles.map((r, i) => {
                        const nu = r.estado === 'nuevo';
                        return (
                            <article key={r.id} className="rounded-[24px] px-4 pt-4 pb-3"
                                style={{ background: 'var(--r-card)', ...sombra, animation: 'rpIn .3s ease both', animationDelay: `${i * 35}ms` }}>
                                <div className="flex items-center justify-between gap-2.5">
                                    <span className="rep-mono text-[13.5px] font-semibold" style={{ color: nu ? 'var(--r-ink)' : 'var(--r-m62)' }}>{r.codigo}</span>
                                    <Pastilla estado={r.estado} />
                                </div>
                                <p className="mt-2.5 mb-0 text-[16px]" style={{ fontWeight: nu ? 700 : 500 }}>{r.nombre || 'Sin nombre'}</p>
                                <p className="mt-[3px] mb-0 text-[13.5px] font-medium" style={{ color: 'var(--r-m55)' }}>{r.pantalla || 'Sin pantalla'} · {fechaCorta(r.createdAt)}</p>
                                <p className="mt-2 mb-0 text-[14.5px] leading-[1.45] line-clamp-2" style={{ color: 'var(--r-m62)' }}>{r.descripcion.replace(/\s+/g, ' ')}</p>
                                <button type="button" onClick={e => abrir(r, e.currentTarget)}
                                    className="mt-2 -ml-3 h-11 px-3 border-0 bg-transparent flex items-center gap-1.5 text-[14.5px] font-bold cursor-pointer"
                                    style={{ color: 'var(--r-ink)' }}>
                                    Ver detalles <Svg tam={15} grosor={2.4}><path d="M9 6l6 6-6 6" /></Svg>
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* Paginación */}
            {!vacio && Array.isArray(lista) && filtrados.length > 0 && (
                <div className="mt-3.5 flex items-center justify-between gap-3">
                    <span className="text-[13.5px] font-medium" style={{ color: 'var(--r-m55)' }}>
                        {pag * POR_PAGINA + 1}–{Math.min(filtrados.length, (pag + 1) * POR_PAGINA)} de {filtrados.length}
                    </span>
                    <div className="flex gap-1.5">
                        <button type="button" onClick={() => pag > 0 && setPagina(pag - 1)} aria-label="Página anterior" aria-disabled={pag === 0}
                            className="w-11 h-11 border-0 rounded-full flex items-center justify-center cursor-pointer"
                            style={{ background: 'var(--r-card)', ...sombra, color: pag === 0 ? 'var(--r-m42)' : 'var(--r-ink)' }}>
                            <Svg grosor={2.4}><path d="M15 6l-6 6 6 6" /></Svg>
                        </button>
                        {Array.from({ length: paginas }, (_, i) => (
                            <button key={i} type="button" onClick={() => setPagina(i)} aria-current={i === pag ? 'page' : undefined}
                                className="w-11 h-11 border-0 rounded-full text-[14px] font-bold cursor-pointer"
                                style={{ background: i === pag ? 'var(--r-ink)' : 'var(--r-card)', color: i === pag ? 'var(--r-inv)' : 'var(--r-ink)', ...sombra }}>
                                {i + 1}
                            </button>
                        ))}
                        <button type="button" onClick={() => pag < paginas - 1 && setPagina(pag + 1)} aria-label="Página siguiente" aria-disabled={pag >= paginas - 1}
                            className="w-11 h-11 border-0 rounded-full flex items-center justify-center cursor-pointer"
                            style={{ background: 'var(--r-card)', ...sombra, color: pag >= paginas - 1 ? 'var(--r-m42)' : 'var(--r-ink)' }}>
                            <Svg grosor={2.4}><path d="M9 6l6 6-6 6" /></Svg>
                        </button>
                    </div>
                </div>
            )}

            {/* ── Detalle ─────────────────────────────────────────────── */}
            {sel && (
                <aside
                    ref={panelRef}
                    role="dialog"
                    aria-label={`Detalle del reporte ${sel.codigo}`}
                    tabIndex={-1}
                    className={`fixed right-0 bottom-0 flex flex-col outline-none ${esMovil ? 'top-0 left-0 z-[120]' : 'top-16 z-[60] w-[560px]'}`}
                    style={{ background: 'var(--r-card)', boxShadow: esMovil ? 'none' : '-12px 0 40px rgba(0,0,0,.10)', animation: 'rpSlide .32s cubic-bezier(.2,.8,.3,1) both' }}
                >
                    <div className="flex-none flex items-center gap-1.5 px-3.5 py-3" style={{ borderBottom: '1px solid var(--r-line)' }}>
                        <button type="button" onClick={cerrar} aria-label={esMovil ? 'Volver a la lista' : 'Cerrar detalle'}
                            className="w-11 h-11 border-0 rounded-full flex items-center justify-center cursor-pointer" style={{ background: 'var(--r-chip)', color: 'var(--r-ink)' }}>
                            {esMovil
                                ? <Svg tam={17} grosor={2.4}><path d="M15 6l-6 6 6 6" /></Svg>
                                : <Svg tam={15} grosor={2.4}><path d="M6 6l12 12M18 6L6 18" /></Svg>}
                        </button>
                        <span className="flex-1 pl-1.5 text-[13px] font-semibold" style={{ color: 'var(--r-m55)' }}>{idx >= 0 ? `${idx + 1} de ${filtrados.length}` : ''}</span>
                        <button type="button" onClick={() => ir(-1)} aria-label="Reporte anterior" aria-disabled={idx <= 0}
                            className="h-11 px-3.5 border-0 rounded-full flex items-center gap-1.5 text-[13.5px] font-semibold cursor-pointer"
                            style={{ background: 'var(--r-chip)', color: idx <= 0 ? 'var(--r-m42)' : 'var(--r-ink)' }}>
                            <Svg tam={15} grosor={2.4}><path d="M15 6l-6 6 6 6" /></Svg>{!esMovil && <span>Anterior</span>}
                        </button>
                        <button type="button" onClick={() => ir(1)} aria-label="Reporte siguiente" aria-disabled={idx < 0 || idx >= filtrados.length - 1}
                            className="h-11 px-3.5 border-0 rounded-full flex items-center gap-1.5 text-[13.5px] font-semibold cursor-pointer"
                            style={{ background: 'var(--r-chip)', color: idx < 0 || idx >= filtrados.length - 1 ? 'var(--r-m42)' : 'var(--r-ink)' }}>
                            {!esMovil && <span>Siguiente</span>}<Svg tam={15} grosor={2.4}><path d="M9 6l6 6-6 6" /></Svg>
                        </button>
                    </div>

                    <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${esMovil ? 'px-4 pt-5 pb-10' : 'px-7 pt-[26px] pb-10'}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <h2 className={`rep-mono m-0 font-semibold tracking-[-.02em] ${esMovil ? 'text-[28px]' : 'text-[34px]'}`}>{sel.codigo}</h2>
                            <Pastilla estado={sel.estado} grande />
                        </div>
                        <p className="mt-1.5 mb-0 text-[14.5px] font-medium" style={{ color: 'var(--r-m55)' }}>Recibido el {fechaLarga(sel.createdAt)}</p>

                        <p className={`${rotulo} mt-7 mb-2.5`} style={ROT}>QUIÉN LO ENVIÓ</p>
                        <div className="rounded-[22px] p-4" style={{ background: 'var(--r-chip)' }}>
                            <div className="flex items-center gap-3">
                                <span className="w-[46px] h-[46px] flex-none rounded-full flex items-center justify-center text-[15px] font-bold" style={{ background: colorAvatar(sel.numero) }}>{iniciales(sel.nombre)}</span>
                                <span className="min-w-0 flex flex-col gap-0.5">
                                    <span className="text-[16.5px] font-semibold">{sel.nombre || 'Sin nombre'}</span>
                                    <span className="text-[14px] font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--r-m62)' }}>{sel.email || 'Sin email'}</span>
                                    <span className="text-[14px] font-medium" style={{ color: sel.telefono ? 'var(--r-m62)' : 'var(--r-m42)' }}>{sel.telefono || 'Sin teléfono cargado'}</span>
                                </span>
                            </div>
                            <div className="mt-3.5 grid gap-2" style={{ gridTemplateColumns: waLink && !esMovil ? '1fr 1fr' : '1fr' }}>
                                {waLink && (
                                    <a href={waLink} target="_blank" rel="noopener noreferrer"
                                        className="h-[46px] rounded-full flex items-center justify-center gap-2 text-[14px] font-semibold no-underline"
                                        style={{ background: 'var(--r-card)', color: 'var(--r-ink)' }}>
                                        <Svg><path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.9-1z" /></Svg>Escribir por WhatsApp
                                    </a>
                                )}
                                {sel.email && (
                                    <button type="button" onClick={async () => { avisar(await copiar(sel.email!) ? 'Email copiado' : 'No se pudo copiar'); }}
                                        className="h-[46px] border-0 rounded-full flex items-center justify-center gap-2 text-[14px] font-semibold cursor-pointer"
                                        style={{ background: 'var(--r-card)', color: 'var(--r-ink)' }}>
                                        <Svg><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8" /></Svg>Copiar email
                                    </button>
                                )}
                            </div>
                        </div>

                        <p className={`${rotulo} mt-[26px] mb-2.5`} style={ROT}>QUÉ PASÓ</p>
                        <p className="m-0 text-[16px] leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]">{sel.descripcion}</p>

                        <p className={`${rotulo} mt-[26px] mb-2.5`} style={ROT}>DÓNDE</p>
                        <span className="h-9 px-3.5 rounded-full inline-flex items-center gap-2 text-[14.5px] font-semibold" style={{ background: 'var(--r-chip)' }}>
                            <Svg tam={15}><rect x="6.5" y="3" width="11" height="18" rx="3" /><path d="M11 18h2" /></Svg>{sel.pantalla || 'Sin pantalla'}
                        </span>

                        <p className={`${rotulo} mt-[26px] mb-2.5`} style={ROT}>CAPTURA</p>
                        {!sel.capturaPath ? (
                            <div className="h-16 rounded-[20px] flex items-center justify-center gap-2 text-[14.5px] font-medium"
                                style={{ border: '1.5px dashed var(--r-lineS)', color: 'var(--r-m55)' }}>
                                <Svg tam={17} grosor={1.9}><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="M3.5 15l4.5-4 4 3.5 3-2.5 5 4" /></Svg>No adjuntó captura
                            </div>
                        ) : captura?.id === sel.id && captura.cargando ? (
                            <div aria-busy="true" aria-label="Cargando la captura" className="rep-brillo h-[300px] rounded-[22px]" />
                        ) : captura?.id === sel.id && captura.url ? (
                            <button type="button" onClick={() => { setVisor(true); setZoom(false); }} aria-label="Ver la captura en pantalla completa"
                                className="relative w-full h-[300px] border-0 rounded-[22px] flex items-center justify-center cursor-zoom-in overflow-hidden p-0"
                                style={{ background: 'var(--r-chip)' }}>
                                <img src={captura.url} alt={`Captura del reporte ${sel.codigo}`} className="max-w-full max-h-full object-contain" />
                                <span className="absolute right-3 bottom-3 h-[34px] px-3 rounded-full flex items-center gap-1.5 text-[12.5px] font-semibold text-white" style={{ background: 'rgba(10,10,10,.78)' }}>
                                    <Svg tam={13} grosor={2.4}><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></Svg>Ampliar
                                </span>
                            </button>
                        ) : (
                            <div className="min-h-16 px-4 py-3.5 rounded-[20px] flex items-center gap-2.5 text-[14.5px] font-semibold" style={{ background: 'var(--r-ambBg)', color: 'var(--r-amb)' }}>
                                <Svg tam={18}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></Svg>No se pudo abrir la captura
                            </div>
                        )}

                        <div className="mt-[26px] mb-2.5 flex items-center justify-between gap-2.5">
                            <p className={rotulo} style={ROT}>DATOS TÉCNICOS</p>
                            <button type="button"
                                onClick={async () => { if (await copiar(textoDelReporte(sel))) { setCopiado(true); window.setTimeout(() => setCopiado(false), 2000); } else avisar('No se pudo copiar'); }}
                                className="h-10 px-3.5 border-0 rounded-full flex items-center gap-1.5 text-[13px] font-semibold cursor-pointer"
                                style={{ background: copiado ? 'var(--r-grnBg)' : 'var(--r-chip)', color: copiado ? 'var(--r-grn)' : 'var(--r-ink)', transition: 'background .2s' }}>
                                {copiado && <Tilde tam={14} />}<span>{copiado ? '¡Copiado!' : 'Copiar todo'}</span>
                            </button>
                        </div>
                        <div className="rep-mono rounded-[18px] px-4 py-3.5 flex flex-col gap-[7px] text-[12.5px] font-medium leading-[1.5]" style={{ background: 'var(--r-chip)' }}>
                            {[
                                ['Versión', sel.versionApp || '—'],
                                ['Dispositivo', sel.dispositivo || '—'],
                                ['Navegador', navegadorDe(sel.dispositivo)],
                                ['Código', sel.codigo],
                            ].map(([k, v]) => (
                                <div key={k} className="grid gap-2.5" style={{ gridTemplateColumns: '92px minmax(0,1fr)' }}>
                                    <span style={{ color: 'var(--r-m55)' }}>{k}</span><span className="[overflow-wrap:anywhere]">{v}</span>
                                </div>
                            ))}
                        </div>

                        <p className={`${rotulo} mt-7 mb-2.5`} style={ROT}>GESTIÓN</p>
                        <div className="grid gap-2" style={{ gridTemplateColumns: esMovil ? '1fr' : '1fr 1fr' }}>
                            {sel.estado === 'resuelto' ? (
                                <>
                                    <button type="button" aria-disabled="true" className="h-[50px] px-3.5 border-0 rounded-full flex items-center justify-center gap-2 text-[14.5px] font-semibold whitespace-nowrap cursor-default"
                                        style={{ background: 'var(--r-grnBg)', color: 'var(--r-grn)' }}>
                                        <Tilde />Resuelto
                                    </button>
                                    <button type="button" onClick={() => gestionar(sel, 'reabrir')}
                                        className="rep-chip h-[50px] px-3.5 border-0 rounded-full flex items-center justify-center gap-2 text-[14.5px] font-semibold whitespace-nowrap cursor-pointer active:scale-[.98]"
                                        style={{ background: 'var(--r-chip)', color: 'var(--r-ink)' }}>
                                        <Svg grosor={2.2}><path d="M9 7L4.5 11.5 9 16" /><path d="M5 11.5h9a5.5 5.5 0 010 11h-2" /></Svg>Volver a abrir
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" aria-disabled={sel.estado === 'visto'} onClick={() => sel.estado !== 'visto' && gestionar(sel, 'visto')}
                                        className={`h-[50px] px-3.5 border-0 rounded-full flex items-center justify-center gap-2 text-[14.5px] font-semibold whitespace-nowrap ${sel.estado === 'visto' ? 'cursor-default' : 'cursor-pointer active:scale-[.98]'}`}
                                        style={{ background: 'var(--r-chip)', color: sel.estado === 'visto' ? 'var(--r-m42)' : 'var(--r-ink)' }}>
                                        <Svg grosor={2.1}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></Svg>
                                        {sel.estado === 'visto' ? 'Visto' : 'Marcar como visto'}
                                    </button>
                                    <button type="button" onClick={() => gestionar(sel, 'resuelto')}
                                        className="h-[50px] px-3.5 border-0 rounded-full flex items-center justify-center gap-2 text-[14.5px] font-semibold whitespace-nowrap cursor-pointer active:scale-[.98]"
                                        style={{ background: 'var(--r-ink)', color: 'var(--r-inv)' }}>
                                        <Tilde />Marcar como resuelto
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="mt-3.5 rounded-[22px] p-3.5" style={{ background: 'var(--r-chip)' }}>
                            <div className="flex items-center justify-between gap-2 px-1">
                                <span className="flex items-center gap-[7px] text-[14px] font-semibold">
                                    <Svg tam={15} grosor={2.1}><rect x="5" y="10.5" width="14" height="10" rx="3" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></Svg>Nota interna
                                </span>
                                <span className="text-[12.5px] font-medium" style={{ color: 'var(--r-m55)' }}>
                                    {sel.notaEditadaAt ? `Editada ${fechaCorta(sel.notaEditadaAt)}` : 'Sin nota'}
                                </span>
                            </div>
                            <textarea
                                value={nota}
                                onChange={e => setNota(e.target.value)}
                                rows={3}
                                aria-label="Nota interna, solo la ve Sistemas"
                                placeholder="Solo la ve Sistemas. Qué revisaste, qué falta…"
                                className="rep-nota mt-2.5 w-full min-h-24 px-3.5 py-3 text-[15px] leading-[1.5] resize-y"
                            />
                            <div className="mt-2.5 flex justify-end">
                                <button type="button" aria-disabled={!notaCambio} onClick={() => notaCambio && gestionar(sel, 'nota')}
                                    className={`h-11 px-[18px] border-0 rounded-full text-[14px] font-semibold ${notaCambio ? 'cursor-pointer' : 'cursor-default'}`}
                                    style={{ background: notaCambio ? 'var(--r-ink)' : 'var(--r-card)', color: notaCambio ? 'var(--r-inv)' : 'var(--r-m42)' }}>
                                    Guardar nota
                                </button>
                            </div>
                        </div>

                        <p className={`${rotulo} mt-7 mb-3`} style={ROT}>HISTORIAL</p>
                        <ol className="m-0 p-0 list-none flex flex-col">
                            {historial.map((h, i) => (
                                <li key={h.t + h.at} className="flex gap-3" style={{ animation: 'rpIn .3s ease both' }}>
                                    <span className="flex flex-col items-center flex-none w-3">
                                        <span className="w-[9px] h-[9px] mt-[5px] rounded-full" style={{ background: i === historial.length - 1 ? 'var(--r-ink)' : 'var(--r-lineS)' }} />
                                        <span className="flex-1 w-[1.5px]" style={{ background: i < historial.length - 1 ? 'var(--r-lineS)' : 'transparent' }} />
                                    </span>
                                    <span className="pb-3.5 text-[14px] font-medium" style={{ color: 'var(--r-m62)' }}>
                                        <b className="font-semibold" style={{ color: 'var(--r-ink)' }}>{h.t}</b> · {fechaCorta(h.at)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </aside>
            )}

            {/* Visor de la captura */}
            {sel && visor && captura?.url && (
                <div role="dialog" aria-modal="true" aria-label="Captura en pantalla completa"
                    className="fixed inset-0 z-[140] flex flex-col" style={{ background: 'rgba(8,8,8,.94)', animation: 'rpFade .2s ease both' }}>
                    <div className="flex-none flex justify-between items-center px-4 py-3.5 text-white">
                        <span className="rep-mono text-[14px] font-semibold">{sel.codigo} · captura</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setZoom(z => !z)} aria-label={zoom ? 'Alejar' : 'Acercar'}
                                className="w-11 h-11 border-0 rounded-full flex items-center justify-center cursor-pointer text-white" style={{ background: 'rgba(255,255,255,.14)' }}>
                                <Svg tam={18} grosor={2.2}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4M8 11h6" />{!zoom && <path d="M11 8v6" />}</Svg>
                            </button>
                            <button type="button" onClick={() => setVisor(false)} aria-label="Cerrar captura" autoFocus
                                className="w-11 h-11 border-0 rounded-full flex items-center justify-center cursor-pointer text-white" style={{ background: 'rgba(255,255,255,.14)' }}>
                                <Svg tam={15} grosor={2.4}><path d="M6 6l12 12M18 6L6 18" /></Svg>
                            </button>
                        </div>
                    </div>
                    <div onClick={() => setZoom(z => !z)} className="flex-1 min-h-0 overflow-auto flex"
                        style={{ alignItems: 'safe center', justifyContent: 'safe center', cursor: zoom ? 'zoom-out' : 'zoom-in' } as React.CSSProperties}>
                        <img src={captura.url} alt={`Captura del reporte ${sel.codigo}`}
                            className="flex-none"
                            style={zoom
                                ? { width: 'auto', maxWidth: 'none', maxHeight: 'none' }
                                : { maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100dvh - 100px)', objectFit: 'contain' }} />
                    </div>
                </div>
            )}

            {aviso && (
                <div role="status" className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[150] max-w-[calc(100%-32px)] px-5 py-3.5 rounded-full text-[14.5px] font-semibold text-center"
                    style={{ background: 'var(--r-ink)', color: 'var(--r-inv)', boxShadow: '0 8px 24px rgba(0,0,0,.2)', animation: 'rpIn .25s ease both' }}>
                    {aviso}
                </div>
            )}
        </div>
    );
};

export default ReportesSistemas;
