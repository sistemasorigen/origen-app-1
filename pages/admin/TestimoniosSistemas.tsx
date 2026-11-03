import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    getTestimoniosAdmin, mensajeDeMotivo, resolverTestimonio,
    type AccionModeracion, type EstadoTestimonio, type TestimonioAdmin,
} from '../../services/testimonios';
import { cortar, hayQueCortar, linkDeTestimonio } from '../testimonios/piezas';
import { ModalConfirmacion, type PedidoConfirmacion } from './piezasAdmin';
import { sinAcentos } from './departamentos/piezas';

/**
 * /panel-admin?tab=testimonios — la moderación de los testimonios de los GCX.
 *
 * Vive adentro del layout de Administrador.tsx, como Reportes y como
 * Notificaciones: la cabecera y la navegación son las de ese layout, y esto
 * es el cuerpo. Todo lee de testimonios_admin_listar() y escribe con
 * testimonios_admin_resolver() (sql/testimonios_gcx.sql), que sólo responden
 * a SUPER_ADMIN; la ruta /panel-admin ya exige ese rol.
 *
 * ACÁ SE VE EL NOMBRE COMPLETO. En la página pública un menor de 18 se ve
 * "Nombre I."; Sistemas tiene que saber de quién es el testimonio que está
 * por borrar, así que la base le manda el nombre y el email enteros. Es la
 * única pantalla donde pasa.
 *
 * LO QUE SE PIDE UNA VEZ Y SE FILTRA ACÁ. La base manda hasta 500 y los
 * pedidos primero, con los contadores de TODA la tabla aparte. Los filtros y
 * el buscador trabajan sobre eso, sin volver a pedir, igual que Reportes: así
 * cambiar de filtro es instantáneo y los contadores no bailan. Si algún día
 * hay más de 500, se dice en pantalla en vez de mentir con el número.
 *
 * Después de cada acción la lista se vuelve a pedir entera: nada optimista.
 * Un testimonio eliminado ya no está, y el contador que vale es el de la base.
 */

const TOPE = 500;

const ESTILOS = `
#testimonios-admin {
  --t-card:#ffffff; --t-chip:#f2f2f0; --t-ink:#0a0a0a; --t-inv:#ffffff;
  --t-m62:rgba(0,0,0,.64); --t-m55:rgba(0,0,0,.56); --t-m42:rgba(0,0,0,.46);
  --t-line:rgba(0,0,0,.07); --t-shadow:0 1px 2px rgba(0,0,0,.04), 0 2px 10px rgba(0,0,0,.03);
  --t-red:#d93025; --t-redBg:#fdecea; --t-redInk:#a8231a;
  --t-grn:#118f46; --t-grnBg:#e7f4eb; --t-amb:#8a5200; --t-ambBg:#fdf1dc;
  --t-shim:#fafaf8;
  --t-av0:#e3ece5; --t-av1:#efe6dc; --t-av2:#e2e6ee; --t-av3:#efe2e8;
}
/* El buscador vive adentro de una pastilla que dibuja el recuadro. Los campos
   de #admin-general llevan fondo y borde con !important (index.html); con el
   id de la sección esta regla les gana, igual que en Notificaciones. */
#admin-general #testimonios-admin input[type="search"] {
  background: transparent !important; border: 0 !important; border-radius: 0 !important;
  box-shadow: none !important; outline: none !important; padding: 0 !important; color: #0a0a0a !important;
}
#testimonios-admin .tst-pastilla:focus-within { outline: 2px solid #0a0a0a; outline-offset: 2px; }
#testimonios-admin ::placeholder { color: var(--t-m42) !important; }
@keyframes tstaIn { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
@keyframes tstaShim { from { background-position:120% 0 } to { background-position:-120% 0 } }
@keyframes tstaMarca { 0%,70% { box-shadow: 0 0 0 2px #0a0a0a; background:#fdf6d8 } 100% { box-shadow: var(--t-shadow); background:#fff } }
#testimonios-admin .tst-brillo {
  background: linear-gradient(90deg, var(--t-chip) 30%, var(--t-shim) 50%, var(--t-chip) 70%);
  background-size: 300% 100%; animation: tstaShim 1.4s linear infinite;
}
#testimonios-admin .tst-marcado { animation: tstaMarca 3.2s ease both; }
@media (prefers-reduced-motion: reduce) {
  #testimonios-admin *, #testimonios-admin *::before, #testimonios-admin *::after { animation: none !important; transition: none !important; }
}
`;

// ── Formatos ────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** "22 oct 2026 · 11:05" */
const fecha = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()} · ${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`;
};

const NOMBRE_TEMPORADA: Record<string, string> = {
    S1: 'Primera temporada', S2: 'Segunda temporada', S3: 'Tercera temporada',
};

const iniciales = (nombre: string | null) =>
    (nombre || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** El color del avatar, estable por persona (su id, no la posición en la lista). */
const colorAvatar = (id: string) => {
    let n = 0;
    for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i)) % 4;
    return `var(--t-av${n})`;
};

const corazones = (n: number) => (n === 1 ? '1 corazón' : `${n} corazones`);

const PASTILLA: Record<EstadoTestimonio, { t: string; bg: string; ink: string; punto?: boolean }> = {
    eliminacion_solicitada: { t: 'Pidió eliminarlo', bg: 'var(--t-redBg)', ink: 'var(--t-redInk)', punto: true },
    publicado: { t: 'Publicado', bg: 'var(--t-grnBg)', ink: 'var(--t-grn)' },
    oculto: { t: 'Oculto', bg: 'var(--t-chip)', ink: 'var(--t-m62)' },
};

const Pastilla: React.FC<{ estado: EstadoTestimonio }> = ({ estado }) => {
    const p = PASTILLA[estado];
    return (
        <span
            className="inline-flex h-7 flex-none items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] text-[12.5px] font-bold"
            style={{ background: p.bg, color: p.ink }}
        >
            {p.punto && <span className="h-[7px] w-[7px] rounded-full" style={{ background: 'var(--t-red)' }} />}
            {p.t}
        </span>
    );
};

const Svg: React.FC<{ tam?: number; grosor?: number; children: React.ReactNode }> = ({ tam = 16, grosor = 2, children }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>{children}</svg>
);

const Corazon: React.FC = () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flex: 'none' }}>
        <path d="M12 20s-7.2-4.3-7.2-9.2A4.3 4.3 0 0112 8.4a4.3 4.3 0 017.2 2.4C19.2 15.7 12 20 12 20z" />
    </svg>
);

/** El texto largo se pliega: un testimonio de 1000 caracteres tapa la lista. */
const LARGO_PLEGADO = 300;

const Texto: React.FC<{ texto: string }> = ({ texto }) => {
    const [abierto, setAbierto] = useState(false);
    const largo = hayQueCortar(texto, LARGO_PLEGADO);
    return (
        <div className="mt-3 rounded-[18px] px-4 py-3.5" style={{ background: 'var(--t-chip)' }}>
            <p className="m-0 whitespace-pre-line text-[14.5px] font-medium leading-[1.55]" style={{ color: 'var(--t-ink)' }}>
                {largo && !abierto ? cortar(texto, LARGO_PLEGADO) : texto}
            </p>
            {largo && (
                <button
                    type="button"
                    onClick={() => setAbierto(v => !v)}
                    aria-expanded={abierto}
                    className="mt-2 h-9 border-0 bg-transparent p-0 text-[13.5px] font-bold"
                    style={{ color: 'var(--t-ink)' }}
                >
                    {abierto ? 'Ver menos' : 'Ver completo'}
                </button>
            )}
        </div>
    );
};

const Dato: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
    <p className="m-0 text-[13px] font-medium leading-[1.5]" style={{ color: 'var(--t-m62)' }}>
        <span className="font-bold" style={{ color: 'var(--t-m42)' }}>{rotulo} </span>
        {children}
    </p>
);

type Filtro = 'pedidos' | 'publicados' | 'ocultos' | 'todos';

const ESTADO_DEL_FILTRO: Record<Filtro, EstadoTestimonio | null> = {
    pedidos: 'eliminacion_solicitada',
    publicados: 'publicado',
    ocultos: 'oculto',
    todos: null,
};

// ════════════════════════════════════════════════════════════════════════

interface Props {
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
    /** Para la pastilla de la navegación: cuántos pedidos hay sin resolver. */
    onResumen?: (pedidos: number) => void;
}

const TestimoniosSistemas: React.FC<Props> = ({ avisar, onResumen }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [lista, setLista] = useState<TestimonioAdmin[] | null | 'error'>(null);
    const [cantidades, setCantidades] = useState({ publicado: 0, eliminacionSolicitada: 0, oculto: 0 });
    const [q, setQ] = useState('');
    const [filtro, setFiltro] = useState<Filtro | null>(null);
    const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
    const [marcado, setMarcado] = useState<string | null>(null);
    const yaUbicó = useRef(false);

    const cargar = useCallback(async () => {
        setLista(null);
        const r = await getTestimoniosAdmin({ limite: TOPE });
        if (!r.ok) { setLista('error'); return; }
        setLista(r.testimonios);
        setCantidades(r.cantidades);
        onResumen?.(r.cantidades.eliminacionSolicitada);
    }, [onResumen]);

    useEffect(() => { void cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // El filtro de entrada: "Pedidos de eliminación" si hay alguno, y si no,
    // "Publicados". Se decide una sola vez, con la primera respuesta: después
    // de resolver el último pedido la pantalla no se mueve sola.
    useEffect(() => {
        if (filtro !== null || !Array.isArray(lista)) return;
        setFiltro(cantidades.eliminacionSolicitada > 0 ? 'pedidos' : 'publicados');
    }, [lista, cantidades.eliminacionSolicitada, filtro]);

    // ?tab=testimonios&id=… : el link de la alerta. Se resalta y se deja a la
    // vista, aunque el filtro de entrada no lo mostrara.
    const idDeLaUrl = searchParams.get('id');
    useEffect(() => {
        if (!Array.isArray(lista) || !idDeLaUrl || yaUbicó.current) return;
        yaUbicó.current = true;
        if (!lista.some(t => t.id === idDeLaUrl)) {
            avisar('Ese testimonio ya no está: se eliminó.', 'error');
            setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('id'); return p; }, { replace: true });
            return;
        }
        setFiltro('todos');
        setQ('');
        setMarcado(idDeLaUrl);
        window.setTimeout(() => {
            document.getElementById(`tst-${idDeLaUrl}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 60);
        window.setTimeout(() => setMarcado(null), 3400);
    }, [lista, idDeLaUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    const todos = Array.isArray(lista) ? lista : [];
    const busqueda = sinAcentos(q);
    const visibles = useMemo(() => {
        const estado = ESTADO_DEL_FILTRO[filtro ?? 'todos'];
        return todos.filter(t =>
            (!estado || t.estado === estado)
            && (!busqueda
                || sinAcentos(t.autor.nombre || '').includes(busqueda)
                || sinAcentos(t.autor.email || '').includes(busqueda)
                || sinAcentos(t.grupo.nombre).includes(busqueda)
                || sinAcentos(t.texto).includes(busqueda)));
    }, [lista, filtro, busqueda]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Las acciones ────────────────────────────────────────────────────
    const resolver = async (t: TestimonioAdmin, accion: AccionModeracion) => {
        const r = await resolverTestimonio(t.id, accion);
        if (!r.ok) { avisar(mensajeDeMotivo(r), 'error'); return; }
        const quien = t.autor.nombre || 'la persona';
        avisar(accion === 'eliminar' ? `Se eliminó el testimonio de ${quien}.`
            : accion === 'rechazar' ? `El testimonio de ${quien} sigue publicado.`
                : accion === 'ocultar' ? `Se ocultó el testimonio de ${quien}.`
                    : `El testimonio de ${quien} volvió a verse.`);
        await cargar();
    };

    const pedirRechazar = (t: TestimonioAdmin): PedidoConfirmacion => ({
        tipo: 'control',
        rotulo: 'Pedido de eliminación',
        titulo: '¿Rechazar el pedido?',
        texto: 'Vuelve a publicarse tal cual. A la persona le llega un aviso.',
        detalleTitulo: t.autor.nombre || 'Sin nombre',
        detalle: `${t.grupo.nombre} · ${corazones(t.corazones)}`,
        etiquetaBoton: 'Rechazar el pedido',
        onConfirmar: () => { void resolver(t, 'rechazar'); },
    });

    const pedirEliminar = (t: TestimonioAdmin): PedidoConfirmacion => ({
        tipo: 'destructivo',
        titulo: '¿Eliminar el testimonio?',
        texto: `Se borra para siempre, con sus ${corazones(t.corazones)}. A la persona le llega un aviso. No se puede deshacer.`,
        detalleTitulo: t.autor.nombre || 'Sin nombre',
        detalle: `${t.grupo.nombre} · ${NOMBRE_TEMPORADA[t.temporada] || t.temporada} · ${t.anio}`,
        etiquetaBoton: 'Eliminar',
        onConfirmar: () => { void resolver(t, 'eliminar'); },
        // La salida suave: desde el modal de eliminar se puede pasar a
        // rechazar, con su propia confirmación, sin volver a buscar la tarjeta.
        secundaria: {
            etiqueta: 'Rechazar el pedido en vez de eliminar',
            onClick: () => setConfirmacion(pedirRechazar(t)),
        },
    });

    const pedirOcultar = (t: TestimonioAdmin): PedidoConfirmacion => ({
        tipo: 'control',
        rotulo: 'Testimonio publicado',
        titulo: '¿Ocultar el testimonio?',
        texto: 'Deja de verse en la página de testimonios. La persona lo sigue viendo en Mis testimonios.',
        detalleTitulo: t.autor.nombre || 'Sin nombre',
        detalle: `${t.grupo.nombre} · ${corazones(t.corazones)}`,
        etiquetaBoton: 'Ocultar',
        onConfirmar: () => { void resolver(t, 'ocultar'); },
    });

    const pedirMostrar = (t: TestimonioAdmin): PedidoConfirmacion => ({
        tipo: 'control',
        rotulo: 'Testimonio oculto',
        titulo: '¿Mostrar el testimonio?',
        texto: 'Vuelve a la página de testimonios.',
        detalleTitulo: t.autor.nombre || 'Sin nombre',
        detalle: `${t.grupo.nombre} · ${corazones(t.corazones)}`,
        etiquetaBoton: 'Mostrar',
        onConfirmar: () => { void resolver(t, 'mostrar'); },
    });

    // ── Estados vacíos ──────────────────────────────────────────────────
    const hayBusqueda = !!q.trim();
    const vacio = lista === 'error'
        ? {
            t: 'No pudimos cargar los testimonios',
            s: 'Revisá la conexión y probá de nuevo.',
            cta: 'Reintentar', icono: 'error' as const, alerta: true, oscuro: true, go: () => { void cargar(); },
        }
        : Array.isArray(lista) && lista.length === 0
            ? {
                t: 'Todavía no hay testimonios',
                s: 'Cuando alguien cuente lo que vivió en su GCX, va a aparecer acá.',
                icono: 'vacio' as const,
            }
            : Array.isArray(lista) && visibles.length === 0
                ? hayBusqueda
                    ? {
                        t: 'Ningún testimonio coincide',
                        s: `No encontramos nada con “${q.trim()}”. Probá con un nombre, un GCX o una palabra del texto.`,
                        cta: 'Limpiar búsqueda', icono: 'busqueda' as const, go: () => { setQ(''); setFiltro('todos'); },
                    }
                    : {
                        t: filtro === 'pedidos' ? 'No hay pedidos de eliminación'
                            : filtro === 'ocultos' ? 'No hay testimonios ocultos'
                                : 'No hay testimonios publicados',
                        s: filtro === 'pedidos'
                            ? 'Cuando alguien pida eliminar su testimonio, lo vas a ver acá y te va a llegar un aviso.'
                            : filtro === 'ocultos'
                                ? 'Los que ocultes de la página de testimonios aparecen acá.'
                                : 'Los testimonios publicados aparecen acá.',
                        icono: 'vacio' as const,
                    }
                : null;

    const FILTROS: { k: Filtro; t: string; n?: number }[] = [
        { k: 'pedidos', t: 'Pedidos de eliminación', n: cantidades.eliminacionSolicitada },
        { k: 'publicados', t: 'Publicados' },
        { k: 'ocultos', t: 'Ocultos' },
        { k: 'todos', t: 'Todos' },
    ];

    const CONTADORES: { t: string; n: number; rojo?: boolean }[] = [
        { t: 'Pedidos de eliminación', n: cantidades.eliminacionSolicitada, rojo: cantidades.eliminacionSolicitada > 0 },
        { t: 'Publicados', n: cantidades.publicado },
        { t: 'Ocultos', n: cantidades.oculto },
    ];

    const sombra = { boxShadow: 'var(--t-shadow)' };
    const botonChip = 'flex h-11 flex-none items-center gap-2 rounded-full border-0 px-4 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2';

    return (
        <div id="testimonios-admin">
            <style>{ESTILOS}</style>

            {/* Contadores */}
            <div className="grid grid-cols-3 gap-2 md:gap-2.5">
                {CONTADORES.map(c => (
                    <div key={c.t} className="rounded-[20px] px-3.5 py-3 md:px-[18px] md:py-4" style={{ background: 'var(--t-card)', ...sombra }}>
                        <p className="m-0 text-[26px] font-semibold leading-none tracking-[-.02em] md:text-[30px]"
                            style={{ color: c.rojo ? 'var(--t-redInk)' : 'var(--t-ink)' }}>
                            {c.n}
                        </p>
                        <p className="mt-1.5 mb-0 text-[11.5px] font-semibold leading-[1.3] md:text-[12.5px]" style={{ color: 'var(--t-m55)' }}>
                            {c.t}
                        </p>
                    </div>
                ))}
            </div>

            {/* Buscador */}
            <div className="tst-pastilla mt-3 flex h-12 items-center gap-2.5 rounded-full pl-[18px] pr-1.5"
                style={{ background: 'var(--t-card)', ...sombra }}>
                <span style={{ color: 'var(--t-m55)' }}><Svg grosor={2.2}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Svg></span>
                <input
                    type="search"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    aria-label="Buscar testimonios"
                    placeholder="Buscar por persona, GCX o texto"
                    className="h-full min-w-0 flex-1 text-[15px] font-medium"
                />
                {q && (
                    <button type="button" onClick={() => setQ('')} aria-label="Borrar búsqueda"
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-0"
                        style={{ background: 'var(--t-chip)', color: 'var(--t-ink)' }}>
                        <Svg tam={12} grosor={2.6}><path d="M6 6l12 12M18 6L6 18" /></Svg>
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div role="tablist" aria-label="Qué testimonios" className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
                {FILTROS.map(f => {
                    const on = filtro === f.k;
                    return (
                        <button key={f.k} type="button" role="tab" aria-selected={on} onClick={() => setFiltro(f.k)}
                            className={`${botonChip} whitespace-nowrap`}
                            style={{ background: on ? 'var(--t-ink)' : 'var(--t-card)', color: on ? 'var(--t-inv)' : 'var(--t-ink)', ...sombra }}>
                            <span>{f.t}</span>
                            {!!f.n && <span className="text-[12.5px] font-bold" style={{ color: on ? 'var(--t-inv)' : 'var(--t-red)' }}>{f.n}</span>}
                        </button>
                    );
                })}
            </div>

            {lista === null && (
                <div aria-busy="true" aria-label="Cargando testimonios" className="mt-3.5 flex flex-col gap-2.5">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="rounded-[24px] p-4" style={{ background: 'var(--t-card)', ...sombra }}>
                            <div className="flex items-center gap-3">
                                <div className="tst-brillo h-10 w-10 flex-none rounded-full" />
                                <div className="flex flex-1 flex-col gap-2">
                                    <div className="tst-brillo h-3.5 w-[42%] rounded-[7px]" />
                                    <div className="tst-brillo h-3 w-[62%] rounded-md" />
                                </div>
                                <div className="tst-brillo h-7 w-[86px] flex-none rounded-full" />
                            </div>
                            <div className="tst-brillo mt-3.5 h-[72px] rounded-[18px]" />
                        </div>
                    ))}
                </div>
            )}

            {vacio && (
                <div role={vacio.alerta ? 'alert' : undefined}
                    className="mt-3.5 flex flex-col items-center rounded-[26px] px-6 py-14 text-center"
                    style={{ background: 'var(--t-card)', ...sombra, animation: 'tstaIn .3s ease both' }}>
                    <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'var(--t-chip)', color: 'var(--t-m55)' }}>
                        {vacio.icono === 'vacio' && <Svg tam={34} grosor={1.7}><path d="M4.5 5h15v11H10l-5.5 4z" /><path d="M8 9h8M8 12.5h5" /></Svg>}
                        {vacio.icono === 'busqueda' && <Svg tam={34} grosor={1.7}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4M8.5 11h5" /></Svg>}
                        {vacio.icono === 'error' && <Svg tam={34} grosor={1.7}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></Svg>}
                    </div>
                    <h3 className="mt-5 mb-0 text-[20px] font-semibold tracking-[-.02em]">{vacio.t}</h3>
                    <p className="mt-2 mb-0 max-w-[380px] text-[15px] leading-[1.5] [text-wrap:pretty]" style={{ color: 'var(--t-m55)' }}>{vacio.s}</p>
                    {vacio.cta && vacio.go && (
                        <button type="button" onClick={vacio.go} className="mt-[22px] h-12 rounded-full border-0 px-6 text-[15px] font-semibold"
                            style={vacio.oscuro ? { background: 'var(--t-ink)', color: 'var(--t-inv)' } : { background: 'var(--t-chip)', color: 'var(--t-ink)' }}>
                            {vacio.cta}
                        </button>
                    )}
                </div>
            )}

            {/* Las tarjetas */}
            {!vacio && Array.isArray(lista) && (
                <>
                    <p className="mt-3.5 mb-0 text-[13.5px] font-medium" style={{ color: 'var(--t-m55)' }}>
                        {visibles.length === 1 ? '1 testimonio' : `${visibles.length} testimonios`}
                        {lista.length >= TOPE && ` · se traen los ${TOPE} más recientes`}
                    </p>
                    <div className="mt-2.5 flex flex-col gap-2.5">
                        {visibles.map((t, i) => {
                            const pedido = t.estado === 'eliminacion_solicitada';
                            return (
                                <article
                                    key={t.id}
                                    id={`tst-${t.id}`}
                                    className={`rounded-[24px] p-4 md:px-[18px] ${marcado === t.id ? 'tst-marcado' : ''}`}
                                    style={{
                                        background: 'var(--t-card)', ...sombra,
                                        animation: marcado === t.id ? undefined : 'tstaIn .3s ease both',
                                        animationDelay: marcado === t.id ? undefined : `${Math.min(i, 8) * 35}ms`,
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-2.5">
                                        <span className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                                                style={{ background: colorAvatar(t.autor.id) }}>
                                                {iniciales(t.autor.nombre)}
                                            </span>
                                            <span className="flex min-w-0 flex-col gap-0.5">
                                                <span className="text-[15.5px] font-semibold leading-[1.3]">{t.autor.nombre || 'Sin nombre'}</span>
                                                <span className="text-[13px] font-medium leading-[1.35] [overflow-wrap:anywhere]" style={{ color: 'var(--t-m55)' }}>
                                                    {t.autor.email || 'Sin email'}
                                                </span>
                                            </span>
                                        </span>
                                        <Pastilla estado={t.estado} />
                                    </div>

                                    <p className="mt-2.5 mb-0 text-[14px] font-semibold leading-[1.4]">{t.grupo.nombre}</p>
                                    <p className="mt-0.5 mb-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-medium" style={{ color: 'var(--t-m55)' }}>
                                        <span>{NOMBRE_TEMPORADA[t.temporada] || t.temporada} · {t.anio}</span>
                                        <span aria-hidden="true">·</span>
                                        <span>{fecha(t.creado)}</span>
                                        <span aria-hidden="true">·</span>
                                        <span className="inline-flex items-center gap-1"><Corazon />{corazones(t.corazones)}</span>
                                    </p>

                                    <Texto texto={t.texto} />

                                    {pedido && (
                                        <div className="mt-3 rounded-[18px] px-4 py-3.5" style={{ background: 'var(--t-redBg)' }}>
                                            <p className="m-0 text-[12px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--t-redInk)' }}>
                                                Pidió que lo eliminen
                                            </p>
                                            <p className="mt-1.5 mb-0 text-[13.5px] font-medium leading-[1.55]" style={{ color: 'var(--t-m62)' }}>
                                                {fecha(t.eliminacionPedida)}
                                            </p>
                                            <p className="mt-1.5 mb-0 whitespace-pre-line text-[14px] font-medium leading-[1.55]" style={{ color: 'var(--t-ink)' }}>
                                                {t.eliminacionMotivo || 'Sin motivo: no escribió nada.'}
                                            </p>
                                        </div>
                                    )}

                                    {!pedido && t.decision && (
                                        <p className="mt-3 mb-0 text-[13px] font-medium leading-[1.5]" style={{ color: 'var(--t-m55)' }}>
                                            {t.decision === 'pedido_rechazado' ? 'Pedido rechazado'
                                                : t.decision === 'oculto' ? 'Ocultado' : 'Vuelto a mostrar'}
                                            {t.decididoPor ? ` por ${t.decididoPor}` : ''} · {fecha(t.decidido)}
                                        </p>
                                    )}

                                    <div className="mt-3.5 flex flex-wrap gap-2">
                                        {pedido && (
                                            <>
                                                <button type="button" onClick={() => setConfirmacion(pedirEliminar(t))} className={botonChip}
                                                    style={{ background: 'var(--t-red)', color: '#fff' }}>
                                                    <Svg tam={15} grosor={2.2}><path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" /></Svg>
                                                    Eliminar
                                                </button>
                                                <button type="button" onClick={() => setConfirmacion(pedirRechazar(t))} className={botonChip}
                                                    style={{ background: 'var(--t-chip)', color: 'var(--t-ink)' }}>
                                                    Rechazar el pedido
                                                </button>
                                            </>
                                        )}
                                        {t.estado === 'publicado' && (
                                            <button type="button" onClick={() => setConfirmacion(pedirOcultar(t))} className={botonChip}
                                                style={{ background: 'var(--t-chip)', color: 'var(--t-ink)' }}>
                                                <Svg tam={15} grosor={2}><path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8" /><path d="M6.5 6.6C4.6 7.9 3.2 9.8 2.5 12c1.4 4 5.2 6.5 9.5 6.5 1.5 0 2.9-.3 4.2-.9M9.9 5.7c.7-.1 1.4-.2 2.1-.2 4.3 0 8.1 2.5 9.5 6.5-.5 1.4-1.3 2.7-2.3 3.8" /></Svg>
                                                Ocultar
                                            </button>
                                        )}
                                        {t.estado === 'oculto' && (
                                            <button type="button" onClick={() => setConfirmacion(pedirMostrar(t))} className={botonChip}
                                                style={{ background: 'var(--t-ink)', color: 'var(--t-inv)' }}>
                                                <Svg tam={15} grosor={2}><path d="M2.5 12C3.9 8 7.7 5.5 12 5.5s8.1 2.5 9.5 6.5c-1.4 4-5.2 6.5-9.5 6.5S3.9 16 2.5 12z" /><circle cx="12" cy="12" r="2.5" /></Svg>
                                                Mostrar
                                            </button>
                                        )}
                                        {t.estado === 'publicado' && (
                                            <a
                                                href={linkDeTestimonio(t.grupo.id, t.id)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`${botonChip} no-underline`}
                                                style={{ background: 'var(--t-chip)', color: 'var(--t-ink)' }}
                                            >
                                                Ver en la página
                                                <Svg tam={14} grosor={2.2}><path d="M8 16L16.5 7.5M9.5 7.5h7v7" /></Svg>
                                            </a>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </>
            )}

            <ModalConfirmacion pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </div>
    );
};

export default TestimoniosSistemas;
