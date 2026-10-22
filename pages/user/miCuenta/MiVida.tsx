import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseService } from '../../../services/supabaseService';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import { serviciosDe } from '../../../src/utils/rolesDeServicio';
import {
    detalleCompra, detalleInscripcion, misCompras, misGrupos, misInscripciones,
    type CompraPropia, type DetalleDeCompra, type DetalleDeInscripcion,
    type GrupoPropio, type InscripcionPropia,
} from '../../../services/miCuenta';
import {
    BotonPrimario, BotonSecundario, EncabezadoSubpagina, ESTILO_TARJETA,
    EsqueletoDeSeccion, Icono, ICONOS, Rotulo, TARJETA, Vacio,
} from '../../../components/miCuenta/piezas';

/**
 * "Mi vida en Origen" — design-claude/Mi Cuenta - Mi vida en Origen.dc.
 *
 * Cinco pantallas y dos detalles. Van juntas porque comparten la misma
 * estructura y los mismos datos.
 *
 * EL QR ES EL MISMO QUE EL DEL EMAIL. La edge function send-nocturna-entrada
 * codifica el id de la inscripción pelado (armado.ts, nivel M, margen 4), y
 * el escáner de la puerta acepta un UUID directo sin resolver nada. Acá se
 * usa exactamente eso: `value={id}`, `level="M"`. Si alguna vez cambia una
 * punta, tiene que cambiar la otra o la familia llega con un QR que no abre.
 */

// ── Pantalla completa, fondo blanco ─────────────────────────────────────

/**
 * El QR y el pedido se muestran a pantalla completa y SIEMPRE en blanco,
 * aunque la app esté en oscuro: un QR oscuro no lo lee ningún escáner, y un
 * voluntario leyendo un código a dos metros necesita el máximo contraste.
 * Se cierra con la X o deslizando hacia abajo, que es lo que la mano hace
 * sola cuando ya mostró lo que tenía que mostrar.
 */
const PantallaCompleta: React.FC<{
    abierta: boolean;
    onCerrar: () => void;
    etiqueta: string;
    children: React.ReactNode;
}> = ({ abierta, onCerrar, etiqueta, children }) => {
    const hoja = useRef<HTMLDivElement>(null);
    const inicio = useRef<number | null>(null);
    const recorrido = useRef(0);

    useBloqueoDeFondo(abierta);

    useEffect(() => {
        if (!abierta) return;
        const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('keydown', alEscape);
        return () => document.removeEventListener('keydown', alEscape);
    }, [abierta, onCerrar]);

    if (!abierta || typeof document === 'undefined') return null;

    const empezar = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        inicio.current = e.clientY;
        recorrido.current = 0;
    };
    const mover = (e: React.PointerEvent) => {
        if (inicio.current == null) return;
        const dy = Math.max(0, e.clientY - inicio.current);
        recorrido.current = dy;
        if (hoja.current) {
            hoja.current.style.transform = `translateY(${dy}px)`;
            hoja.current.style.opacity = String(1 - Math.min(dy / 500, .5));
        }
    };
    const soltar = () => {
        if (inicio.current == null) return;
        const dy = recorrido.current;
        inicio.current = null;
        if (hoja.current) {
            hoja.current.style.transition = 'transform .22s ease, opacity .22s ease';
            hoja.current.style.transform = dy > 120 ? 'translateY(100%)' : '';
            hoja.current.style.opacity = dy > 120 ? '0' : '1';
        }
        if (dy > 120) setTimeout(onCerrar, 200);
    };

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={etiqueta}
            className="fixed inset-0 z-[90] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,.55)' }}
            onClick={onCerrar}
        >
            <div
                ref={hoja}
                onClick={e => e.stopPropagation()}
                onPointerDown={empezar}
                onPointerMove={mover}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                className="relative flex h-full w-full flex-col items-center overflow-y-auto bg-white px-6 pb-10 pt-24 text-center md:h-auto md:max-h-[94%] md:w-[600px] md:rounded-[32px] md:px-10 md:pt-12"
                style={{ color: '#0a0a0a', touchAction: 'none' }}
            >
                <button
                    type="button"
                    onClick={onCerrar}
                    aria-label="Cerrar"
                    className="absolute right-4 top-12 flex h-11 w-11 items-center justify-center rounded-full border-0 md:top-4"
                    style={{ background: '#f2f2f0', color: '#0a0a0a' }}
                >
                    <Icono d={ICONOS.equis} tam={18} grosor={2.4} />
                </button>
                {children}
            </div>
        </div>,
        document.body,
    );
};

// ── Helpers ─────────────────────────────────────────────────────────────

const pesos = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR');

const fechaLarga = (iso?: string | null) => {
    if (!iso) return '';
    try {
        const [y, m, d] = iso.split('-').map(Number);
        const f = d ? new Date(y, m - 1, d) : new Date(iso);
        return f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    } catch { return ''; }
};

const fechaCorta = (iso?: string | null) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
};

const horaCorta = (iso?: string | null) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
};

const pastilla = (fondo: string, tinta: string): React.CSSProperties => ({
    alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 26, marginTop: 6, padding: '0 10px', borderRadius: 999,
    background: fondo, color: tinta, fontSize: 12.5, fontWeight: 700,
});

const iniciales = (n: string) => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');

// ── Mis grupos ──────────────────────────────────────────────────────────

/**
 * Mis grupos: los GCX que esta persona DIRIGE.
 *
 * No es "los grupos a los que voy". Quien es miembro de seis grupos no
 * necesita una lista de seis tarjetas que no puede administrar; quien dirige
 * uno necesita entrar ahí rápido. Por eso la fila ni aparece en el índice si
 * no dirige ninguno, y acá se filtra por `loDirige` —que sale del grupo y no
 * del rol de la cuenta: se puede ser anfitrión de uno y miembro de otro—.
 *
 * El punto dice si la temporada sigue. Es lo primero que un anfitrión mira
 * cuando tiene dos grupos y uno ya terminó.
 */
export const MisGrupos: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [todos, setTodos] = useState<GrupoPropio[] | null>(null);

    useEffect(() => { if (user?.id) misGrupos(user.id).then(setTodos); }, [user?.id]);

    const grupos = todos === null ? null : todos.filter(g => g.loDirige);

    return (
        <>
            <EncabezadoSubpagina titulo="Mis grupos" onVolver={onVolver} />
            {grupos === null ? <EsqueletoDeSeccion filas={2} />
                : grupos.length === 0 ? (
                    <Vacio
                        icono={ICONOS.grupos}
                        titulo="No tenes ningun grupo a cargo"
                        detalle="Acá aparecen los GCX que dirigís como anfitrión o co-anfitrión."
                        accion={{ texto: 'Ver grupos', onClick: () => navigate('/gcx') }}
                    />
                ) : (
                    <div className="mt-6 flex flex-col gap-3">
                        {grupos.map(g => (
                            <button
                                key={g.grupoId}
                                type="button"
                                onClick={() => navigate(`/mis-grupos/${g.grupoId}`)}
                                className={`${TARJETA} flex w-full items-center gap-3.5 border-0 p-4 text-left`}
                                style={{ ...ESTILO_TARJETA, color: 'var(--mc-ink)', cursor: 'pointer' }}
                            >
                                <span className="flex h-16 w-16 flex-none items-center justify-center rounded-[18px]"
                                    style={{ background: 'var(--mc-chip)' }}>
                                    <Icono d={ICONOS.grupos} tam={28} grosor={1.6} />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-[16px] font-semibold leading-[1.3] tracking-[-.01em]">{g.nombre}</span>
                                    <span className="text-[13.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                                        {g.rol}{g.cuando ? ` · ${g.cuando}` : ''}
                                    </span>
                                    {/* Verde = la temporada sigue. Gris = terminó.
                                        El punto va junto al texto y no suelto: un
                                        color solo no se lee, y hay gente que no
                                        distingue verde de gris. */}
                                    <span style={g.termino
                                        ? pastilla('var(--mc-chip)', 'var(--mc-m66)')
                                        : pastilla('var(--mc-green-bg)', 'var(--mc-green-ink)')}>
                                        <span
                                            aria-hidden="true"
                                            className="h-2 w-2 flex-none rounded-full"
                                            style={{ background: g.termino ? 'var(--mc-m38)' : '#34c759' }}
                                        />
                                        {g.termino ? 'Terminó la temporada' : 'Temporada en curso'}
                                    </span>
                                </span>
                                <Icono d={ICONOS.flecha} tam={17} grosor={2} />
                            </button>
                        ))}
                    </div>
                )}
        </>
    );
};

// ── Historial de grupos ─────────────────────────────────────────────────

export const Historial: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<any[] | null>(null);

    useEffect(() => {
        if (user?.id) supabaseService.getMiHistorialDeGrupos(user.id).then(setItems);
    }, [user?.id]);

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const vigente = (fin?: string) => {
        if (!fin) return true;
        const [y, m, d] = fin.split('-').map(Number);
        return new Date(y, m - 1, d) >= hoy;
    };

    // Por temporada, que es como la gente recuerda su paso por los grupos.
    const porTemporada = (items || []).reduce((mapa: Record<string, any[]>, it) => {
        const anio = (it.startDate || '').slice(0, 4) || 'Sin fecha';
        (mapa[anio] = mapa[anio] || []).push(it);
        return mapa;
    }, {});
    const anios = Object.keys(porTemporada).sort().reverse();

    return (
        <>
            <EncabezadoSubpagina titulo="Historial de grupos" onVolver={onVolver} />
            {items === null ? <EsqueletoDeSeccion filas={3} />
                : items.length === 0 ? (
                    <Vacio
                        icono={ICONOS.historial}
                        titulo="Acá vas a ver tu historia en los grupos"
                        detalle="Cuando termine tu primera temporada en un GCX, va a aparecer en esta lista."
                    />
                ) : anios.map(anio => (
                    <div key={anio}>
                        <Rotulo className="mb-2.5 ml-1.5 mt-6">{anio}</Rotulo>
                        <div className={`${TARJETA} px-4 py-1.5`} style={ESTILO_TARJETA}>
                            {porTemporada[anio].map((it: any, i: number) => (
                                <div key={it.registrationId} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 py-3.5"
                                    style={{ borderTop: i ? '1px solid var(--mc-line)' : '0' }}>
                                    <div className="flex justify-center pt-1.5">
                                        <span className="h-2.5 w-2.5 rounded-full"
                                            style={vigente(it.endDate)
                                                ? { background: '#34c759', boxShadow: '0 0 0 4px var(--mc-green-bg)' }
                                                : { background: 'var(--mc-m38)' }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="m-0 text-[15px] font-semibold leading-[1.3]">{it.groupName}</p>
                                        <p className="mb-0 mt-1 text-[13.5px] font-medium leading-[1.4]" style={{ color: 'var(--mc-m50)' }}>
                                            {it.esPareja ? 'Inscripción compartida' : 'Miembro'}
                                            {it.meetingDay ? ` · ${it.meetingDay}` : ''}
                                        </p>
                                        <p className="mb-0 mt-1.5 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                                            {vigente(it.endDate) ? 'En curso' : 'Terminó la temporada'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
        </>
    );
};

// ── Mis compras ─────────────────────────────────────────────────────────

const PASTILLA_PEDIDO = (estado: string) => estado === 'Listo'
    ? pastilla('var(--mc-green-bg)', 'var(--mc-green-ink)')
    : estado === 'Pagado'
        ? pastilla('var(--mc-chip)', 'var(--mc-m66)')
        : { ...pastilla('transparent', 'var(--mc-m50)'), boxShadow: 'inset 0 0 0 1px var(--mc-line)' };

const TEXTO_PEDIDO: Record<string, string> = {
    Pagado: 'Pagado', Listo: 'Listo para retirar', Retirado: 'Retirado',
};

export const MisCompras: React.FC<{ onVolver?: () => void; onAbrir: (id: string) => void }> = ({ onVolver, onAbrir }) => {
    const navigate = useNavigate();
    const [compras, setCompras] = useState<CompraPropia[] | null>(null);
    useEffect(() => { misCompras().then(setCompras); }, []);

    return (
        <>
            <EncabezadoSubpagina titulo="Mis compras" onVolver={onVolver} />
            {compras === null ? <EsqueletoDeSeccion filas={2} />
                : compras.length === 0 ? (
                    <Vacio
                        icono={ICONOS.bolsa}
                        titulo="Todavía no compraste nada"
                        detalle="Las remeras y los buzos de voluntarios se compran desde la app."
                        accion={{ texto: 'Ver remeras y buzos', onClick: () => navigate('/voluntarios') }}
                    />
                ) : (
                    <div className="mt-6 flex flex-col gap-3">
                        {compras.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => onAbrir(c.id)}
                                className={`${TARJETA} flex w-full items-center gap-3.5 border-0 p-4 text-left`}
                                style={{ ...ESTILO_TARJETA, color: 'var(--mc-ink)', cursor: 'pointer' }}
                            >
                                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full"
                                    style={{ background: 'var(--mc-chip)' }}>
                                    <Icono d={ICONOS.bolsa} tam={22} />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="text-[16px] font-semibold tracking-[.03em]">{c.codigo}</span>
                                    <span className="text-[13.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                                        {fechaCorta(c.createdAt)} · {c.unidades} {c.unidades === 1 ? 'prenda' : 'prendas'} · {pesos(c.total)}
                                    </span>
                                    <span style={PASTILLA_PEDIDO(c.estado)}>{TEXTO_PEDIDO[c.estado]}</span>
                                </span>
                                <Icono d={ICONOS.flecha} tam={17} grosor={2} />
                            </button>
                        ))}
                    </div>
                )}
        </>
    );
};

export const DetalleCompra: React.FC<{ id: string; onVolver: () => void }> = ({ id, onVolver }) => {
    const [d, setD] = useState<DetalleDeCompra | null>(null);
    const [mostrar, setMostrar] = useState(false);
    useEffect(() => { detalleCompra(id).then(setD); }, [id]);

    if (!d) return (<><EncabezadoSubpagina titulo="Detalle del pedido" onVolver={onVolver} /><EsqueletoDeSeccion filas={2} /></>);

    const paso = d.estado === 'Retirado' ? 2 : d.estado === 'Listo' ? 1 : 0;
    const ayuda = d.estado === 'Pagado'
        ? 'Estamos preparando tu pedido. Te avisamos cuando esté listo.'
        : d.estado === 'Listo'
            ? 'Retiralo en el Punto de Información, los domingos después de cada reunión.'
            : `Retiraste este pedido el ${fechaCorta(d.retiradaAt)}.`;

    return (
        <>
            <EncabezadoSubpagina titulo="Detalle del pedido" onVolver={onVolver} />

            <div className={`${TARJETA} mt-[22px]`} style={ESTILO_TARJETA}>
                <div className="px-[22px] pb-4 pt-[22px]">
                    <Rotulo className="!text-[12px]">PEDIDO N.º</Rotulo>
                    <p className="mb-0 mt-1.5 text-[32px] font-semibold leading-none tracking-[.04em]">{d.codigo}</p>
                </div>
                <div className="mx-[18px] h-0" style={{ borderTop: '2px dashed var(--mc-dash)' }} />
                <div className="px-[22px] pb-7 pt-4">
                    {d.lineas.map(l => (
                        <div key={`${l.nombre}-${l.talle}`} className="flex items-baseline gap-2 py-1.5">
                            <span className="min-w-0 flex-1 text-[14.5px] font-semibold leading-[1.4]">
                                {l.cantidad} × {l.nombre}{l.talle ? ` · Talle ${l.talle}` : ''}
                            </span>
                            <span className="flex-none text-[14.5px] font-semibold tabular-nums">{pesos(l.subtotal)}</span>
                        </div>
                    ))}
                    <div className="mt-2.5 flex items-baseline gap-2 pt-3" style={{ borderTop: '1px solid var(--mc-line)' }}>
                        <span className="flex-1 text-[16px] font-bold">Total</span>
                        <span className="text-[18px] font-bold tabular-nums">{pesos(d.total)}</span>
                    </div>
                    <p className="mb-0 mt-2.5 text-[14px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                        Transferencia · {fechaCorta(d.createdAt)}
                    </p>
                    <p className="mb-0 mt-1 text-[14px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                        Comprobante enviado ✓
                    </p>
                </div>
            </div>

            <div className={`${TARJETA} mt-3.5 px-[18px] pb-4 pt-[18px]`} style={ESTILO_TARJETA}>
                <Rotulo className="!text-[12px]">ESTADO</Rotulo>
                <div className="mt-3.5 grid grid-cols-3">
                    {['Pagado', 'Listo', 'Retirado'].map((p, i) => (
                        <div key={p} className="relative flex flex-col items-center gap-2 text-center">
                            {i > 0 && (
                                <span className="absolute right-1/2 top-3 h-0.5 w-full"
                                    style={{ background: i <= paso ? 'var(--mc-ink)' : 'var(--mc-dash)' }} />
                            )}
                            <span className="relative z-[1] flex h-[26px] w-[26px] items-center justify-center rounded-full"
                                style={{
                                    background: i <= paso ? 'var(--mc-ink)' : 'var(--mc-card)',
                                    color: 'var(--mc-card)',
                                    boxShadow: `inset 0 0 0 2px ${i <= paso ? 'var(--mc-ink)' : 'var(--mc-dash)'}`,
                                }}>
                                {i <= paso && <Icono d={ICONOS.tilde} tam={13} grosor={3.2} />}
                            </span>
                            <span className="text-[13px]"
                                style={{ fontWeight: i === paso ? 700 : 600, color: i <= paso ? 'var(--mc-ink)' : 'var(--mc-m50)' }}>
                                {p}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="mb-0 mt-3.5 text-center text-[14px] font-medium leading-[1.45] text-pretty" style={{ color: 'var(--mc-m66)' }}>
                    {ayuda}
                </p>
            </div>

            {d.estado !== 'Retirado' && (
                <BotonPrimario ancho onClick={() => setMostrar(true)} className="mt-4">Mostrar en el Punto</BotonPrimario>
            )}

            <PantallaCompleta abierta={mostrar} onCerrar={() => setMostrar(false)} etiqueta="Pedido para mostrar en el Punto">
                <p className="m-0 text-[14px] font-bold tracking-[.08em]">PEDIDO N.º</p>
                <p className="mb-0 mt-2 text-[54px] font-bold leading-none tracking-[.04em]">{d.codigo}</p>
                <p className="mt-3.5 inline-flex h-9 items-center rounded-full px-4 text-[15px] font-bold"
                    style={{ background: '#0a0a0a', color: '#fff' }}>
                    {TEXTO_PEDIDO[d.estado]}
                </p>
                <div className="mt-7 w-full" style={{ borderTop: '3px solid #0a0a0a' }}>
                    {d.lineas.map(l => (
                        <div key={`${l.nombre}-${l.talle}`} className="py-4 text-left text-[20px] font-bold leading-[1.3]"
                            style={{ borderBottom: '1.5px solid rgba(0,0,0,.14)' }}>
                            {l.cantidad} {l.nombre}{l.talle ? ` · talle ${l.talle}` : ''}
                        </div>
                    ))}
                </div>
                <div className="flex w-full items-baseline gap-3 pt-4">
                    <span className="flex-1 text-left text-[20px] font-bold">Total pagado</span>
                    <span className="text-[24px] font-bold tabular-nums">{pesos(d.total)}</span>
                </div>
            </PantallaCompleta>
        </>
    );
};

// ── Mis inscripciones ───────────────────────────────────────────────────

const PASTILLA_EVENTO = (estado: string | null) => estado === 'hoy'
    ? pastilla('var(--mc-green-bg)', 'var(--mc-green-ink)')
    : estado === 'proximo'
        ? pastilla('var(--mc-chip)', 'var(--mc-ink)')
        : { ...pastilla('transparent', 'var(--mc-m50)'), boxShadow: 'inset 0 0 0 1px var(--mc-line)' };

const TEXTO_EVENTO: Record<string, string> = { proximo: 'Próximo', hoy: 'Hoy', pasado: 'Ya pasó' };

export const MisInscripciones: React.FC<{ onVolver?: () => void; onAbrir: (id: string) => void }> = ({ onVolver, onAbrir }) => {
    const navigate = useNavigate();
    const [lista, setLista] = useState<InscripcionPropia[] | null>(null);
    useEffect(() => { misInscripciones().then(setLista); }, []);

    return (
        <>
            <EncabezadoSubpagina titulo="Mis inscripciones" onVolver={onVolver} />
            {lista === null ? <EsqueletoDeSeccion filas={2} />
                : lista.length === 0 ? (
                    <Vacio
                        icono={ICONOS.entrada}
                        titulo="No tenés inscripciones a eventos"
                        detalle="Cuando inscribas a alguien a un evento, la entrada aparece acá."
                        accion={{ texto: 'Ver eventos', onClick: () => navigate('/eventos') }}
                    />
                ) : (
                    <div className="mt-6 flex flex-col gap-3">
                        {lista.map(i => {
                            const f = i.fecha ? i.fecha.split('-') : null;
                            return (
                                <button
                                    key={i.id}
                                    type="button"
                                    onClick={() => onAbrir(i.id)}
                                    className={`${TARJETA} flex w-full items-center gap-3.5 border-0 p-4 text-left`}
                                    style={{ ...ESTILO_TARJETA, color: 'var(--mc-ink)', cursor: 'pointer' }}
                                >
                                    <span className="flex w-14 flex-none flex-col items-center rounded-[16px] py-2 leading-none"
                                        style={{ background: 'var(--mc-chip)' }}>
                                        <span className="text-[11px] font-bold tracking-[.07em]" style={{ color: 'var(--mc-m50)' }}>
                                            {f ? new Date(+f[0], +f[1] - 1, +f[2]).toLocaleDateString('es-AR', { weekday: 'short' }).slice(0, 3).toUpperCase() : '—'}
                                        </span>
                                        <span className="mt-1 text-[22px] font-bold tracking-[-.02em]">{f ? f[2] : '·'}</span>
                                        <span className="mt-0.5 text-[11px] font-bold tracking-[.07em]" style={{ color: 'var(--mc-m50)' }}>
                                            {f ? new Date(+f[0], +f[1] - 1, +f[2]).toLocaleDateString('es-AR', { month: 'short' }).slice(0, 3).toUpperCase() : ''}
                                        </span>
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="text-[16px] font-semibold leading-[1.3]">{i.evento}</span>
                                        <span className="text-[13.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                                            {fechaLarga(i.fecha)}{i.hora ? ` · ${i.hora}` : ''} · {i.adolescentes} {i.adolescentes === 1 ? 'adolescente' : 'adolescentes'}
                                        </span>
                                        <span style={PASTILLA_EVENTO(i.estado)}>{i.estado ? TEXTO_EVENTO[i.estado] : 'Sin fecha'}</span>
                                    </span>
                                    <Icono d={ICONOS.flecha} tam={17} grosor={2} />
                                </button>
                            );
                        })}
                    </div>
                )}
        </>
    );
};

export const DetalleInscripcion: React.FC<{ id: string; onVolver: () => void }> = ({ id, onVolver }) => {
    const navigate = useNavigate();
    const [d, setD] = useState<DetalleDeInscripcion | null>(null);
    const [noExiste, setNoExiste] = useState(false);
    const [qr, setQr] = useState(false);

    useEffect(() => {
        detalleInscripcion(id).then(r => { if (r.ok) setD(r.datos!); else setNoExiste(true); });
    }, [id]);

    if (noExiste) {
        return (
            <>
                <EncabezadoSubpagina titulo="Inscripción" onVolver={onVolver} />
                <Vacio icono={ICONOS.entrada} titulo="No encontramos esa inscripción"
                    detalle="Puede que ya no exista, o que sea de otra cuenta." />
            </>
        );
    }
    if (!d) return (<><EncabezadoSubpagina titulo="Inscripción" onVolver={onVolver} /><EsqueletoDeSeccion filas={2} /></>);

    const yaPaso = d.estado === 'pasado';
    const faltan = d.faltaTelefonoDelAdulto || d.jovenesSinTelefono.length > 0;
    const queFalta = d.faltaTelefonoDelAdulto
        ? 'Falta tu teléfono.'
        : `Falta el teléfono de ${d.jovenesSinTelefono.join(', ')}.`;

    return (
        <>
            <EncabezadoSubpagina titulo={d.evento} onVolver={onVolver} />

            <div className="mt-[22px]">
                <span style={PASTILLA_EVENTO(d.estado)}>{d.estado ? TEXTO_EVENTO[d.estado] : 'Sin fecha'}</span>
                <p className="mb-0 mt-2.5 text-[16px] font-semibold leading-[1.45]">
                    {fechaLarga(d.fecha)}{d.hora ? ` · ${d.hora}` : ''}
                </p>
                <p className="mb-0 mt-0.5 text-[15px] font-medium leading-[1.45]" style={{ color: 'var(--mc-m50)' }}>
                    Origen Iglesia · Av. Eva Perón 3932
                </p>
            </div>

            <div className={`${TARJETA} mt-[18px] px-5 py-[22px] text-center`}
                style={{ ...ESTILO_TARJETA, boxShadow: 'var(--mc-shadow), inset 0 0 0 2px var(--mc-dash)' }}>
                <Rotulo className="!text-[12px]">CÓDIGO DE ENTRADA</Rotulo>
                <p className="mb-0 mt-2 text-[40px] font-bold leading-[1.05] tracking-[.14em]">{d.codigoEntrada}</p>
            </div>

            {faltan && !yaPaso && (
                <div className="mt-3.5 flex items-start gap-3 rounded-[22px] p-4" style={{ background: 'var(--mc-amber-bg)' }}>
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                        style={{ background: 'var(--mc-amber-ink)', color: 'var(--mc-amber-bg)' }}>!</span>
                    <div className="min-w-0 flex-1">
                        <p className="mb-0 mt-0.5 text-[15px] font-bold" style={{ color: 'var(--mc-amber-ink)' }}>Te falta un dato</p>
                        <p className="mb-0 mt-1 text-[14px] font-medium leading-[1.45]" style={{ color: 'var(--mc-amber-ink)' }}>{queFalta}</p>
                        <button
                            type="button"
                            onClick={() => navigate(`/nocturna-entrada?codigo=${encodeURIComponent(d.codigoEntrada)}`)}
                            className="mt-3 min-h-[44px] rounded-full border-0 px-[18px] text-[14.5px] font-bold"
                            style={{ background: 'var(--mc-amber-ink)', color: 'var(--mc-amber-bg)', cursor: 'pointer' }}
                        >
                            Completar
                        </button>
                    </div>
                </div>
            )}

            <Rotulo className="mb-2.5 ml-1.5 mt-6">ADULTO RESPONSABLE</Rotulo>
            <div className={`${TARJETA} flex min-h-[64px] items-center gap-3.5 px-4 py-3`} style={ESTILO_TARJETA}>
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[14px] font-semibold"
                    style={{ background: 'var(--mc-chip)' }}>{iniciales(d.adulto)}</span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold">{d.adulto}</span>
            </div>

            <Rotulo className="mb-2.5 ml-1.5 mt-6">ADOLESCENTES</Rotulo>
            <div className={TARJETA} style={ESTILO_TARJETA}>
                {d.jovenes.map((j, i) => {
                    const estado = j.retiradoAt ? `Se retiró ${horaCorta(j.retiradoAt)}`
                        : j.acreditadoAt ? `Adentro desde ${horaCorta(j.acreditadoAt)}`
                            : j.ausenteAt ? 'No vino' : '';
                    return (
                        <div key={`${j.nombre}-${i}`} className="flex min-h-[64px] items-center gap-3.5 px-4 py-3"
                            style={{ borderTop: i ? '1px solid var(--mc-line)' : '0' }}>
                            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[14px] font-semibold"
                                style={{ background: 'var(--mc-chip)' }}>{iniciales(j.nombre)}</span>
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="text-[15px] font-semibold">{j.nombre}</span>
                                <span className="text-[13.5px] font-medium leading-[1.4]" style={{ color: 'var(--mc-m50)' }}>
                                    {j.retira ? `Otra persona: ${j.retira}` : j.retiroTipo === 'solo' ? 'Se retira solo/a' : 'Lo retira el adulto'}
                                </span>
                            </span>
                            {estado && (
                                <span className="max-w-[46%] flex-none rounded-xl px-2.5 py-1.5 text-right text-[12.5px] font-bold leading-[1.3]"
                                    style={j.retiradoAt || j.acreditadoAt
                                        ? { background: 'var(--mc-green-bg)', color: 'var(--mc-green-ink)' }
                                        : { background: 'var(--mc-chip)', color: 'var(--mc-m66)' }}>
                                    {estado}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {!yaPaso ? (
                <BotonPrimario ancho onClick={() => setQr(true)} className="mt-5 gap-2.5">
                    <Icono d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" tam={20} grosor={1.8} />
                    Mostrar QR
                </BotonPrimario>
            ) : (
                <p className="mb-0 mt-5 text-center text-[14.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                    Este evento ya pasó. Gracias por sumarte.
                </p>
            )}

            {/* El QR SIEMPRE sobre blanco: uno oscuro no lo lee ningún escáner. */}
            <PantallaCompleta abierta={qr} onCerrar={() => setQr(false)} etiqueta="QR de tu entrada">
                <p className="m-0 text-[13px] font-semibold tracking-[.07em]" style={{ color: 'rgba(0,0,0,.55)' }}>
                    {fechaLarga(d.fecha).toUpperCase()}{d.hora ? ` · ${d.hora}` : ''}
                </p>
                <p className="mb-0 mt-1.5 text-[26px] font-semibold leading-[1.15] tracking-[-.025em]">{d.evento}</p>
                <div className="mt-7" role="img" aria-label={`Código QR de la entrada ${d.codigoEntrada}`}>
                    <QRCodeSVG value={d.id} size={300} level="M" bgColor="#ffffff" fgColor="#000000" />
                </div>
                <p className="mb-0 mt-[22px] text-[34px] font-bold leading-none tracking-[.16em]">{d.codigoEntrada}</p>
                <p className="mb-0 mt-2.5 text-[14.5px] font-medium" style={{ color: 'rgba(0,0,0,.6)' }}>
                    {d.adulto} · {d.jovenes.length} {d.jovenes.length === 1 ? 'adolescente' : 'adolescentes'}
                </p>
                <p className="mb-0 mt-7 flex items-center gap-2 text-[13.5px] font-semibold" style={{ color: 'rgba(0,0,0,.6)' }}>
                    <Icono d="M12 8a4 4 0 100 8 4 4 0 000-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" tam={16} grosor={2} />
                    Subí el brillo de la pantalla
                </p>
            </PantallaCompleta>
        </>
    );
};

// ── Dónde sirvo ─────────────────────────────────────────────────────────

export const DondeSirvo: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const servicios = serviciosDe(user as any);

    return (
        <>
            <EncabezadoSubpagina titulo="Dónde sirvo" onVolver={onVolver} />
            {servicios.length === 0 ? (
                <Vacio
                    icono={ICONOS.servir}
                    titulo="Todavía no servís en ningún área"
                    detalle="Hay lugar en recepción, alabanza, niños, técnica y más."
                    accion={{ texto: '¿Querés sumarte?', onClick: () => navigate('/voluntarios') }}
                />
            ) : (
                <div className="mt-6 flex flex-col gap-3">
                    {servicios.map(s => (
                        <div key={s.clave} className={`${TARJETA} p-[18px]`} style={ESTILO_TARJETA}>
                            <div className="flex items-start gap-3.5">
                                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full"
                                    style={{ background: 'var(--mc-chip)' }}>
                                    <Icono d={ICONOS[s.icono] || ICONOS.servir} tam={22} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="mb-0 mt-0.5 text-[16px] font-semibold leading-[1.3] text-pretty">{s.nombre}</p>
                                </div>
                            </div>
                            {s.ruta && (
                                <BotonSecundario ancho onClick={() => navigate(s.ruta!)} className="mt-4 min-h-[48px]">
                                    Ir al panel
                                </BotonSecundario>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};
