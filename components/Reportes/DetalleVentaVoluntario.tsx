import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Phone, X } from 'lucide-react';
import { C } from './PiezasTablero';
import HojaDetalle, { CamposDeFicha } from './HojaDetalle';
import { telParaLlamar, telParaWhatsApp, pesos } from '../../services/reportesPuntoInfo';
import {
    getDetalleVenta, getComprobanteVentaUrl, type DetalleDeVenta,
} from '../../services/ventasVoluntarios';
import { estadoDePedido, marcarVenta } from '../../services/miCuenta';

/**
 * La ficha de una compra de /voluntarios: quién compró, qué se llevó, cuánto
 * pagó y el comprobante de la transferencia.
 *
 * La abren TRES pantallas —la planilla de ventas, la novedad del tablero y el
 * historial de Movimientos del Punto—, así que vive acá y no adentro de
 * ninguna: es la misma ficha, y tiene que serlo. Mismo criterio que
 * HojaReporteStock.
 *
 * ── El comprobante ────────────────────────────────────────────────────
 * Lleva nombre, CBU y monto, así que el archivo vive en un bucket privado y
 * sólo se mira con una URL firmada que vence en 5 minutos. Esa URL se pide
 * AL TOCAR el botón y no al abrir la ficha: así no se emite un permiso de
 * lectura para cada venta que alguien ojea de paso, y el reloj de los 5
 * minutos empieza cuando de verdad se va a mirar.
 *
 * El path NUNCA se muestra: nombra la carpeta de quien compró.
 */

/** Lo que dice cada estado de la entrega, en la ficha. */
const ESTADO_LARGO: Record<string, string> = {
    Pagado: 'Pagado · todavía no está listo',
    Listo: 'Listo para retirar',
    Retirado: 'Retirado',
};

const VERDE_FONDO = '#eaf6ee';
const VERDE_TINTA = '#176639';

/** Un PDF no se puede dibujar en un <img>: se abre aparte. */
const esPdf = (path: string) => /\.pdf$/i.test(path || '');

const DetalleVentaVoluntario: React.FC<{
    /** La venta a mostrar. Null = cerrada. */
    ventaId: string | null;
    onCerrar: () => void;
}> = ({ ventaId, onCerrar }) => {
    const [detalle, setDetalle] = useState<DetalleDeVenta | null>(null);
    const [cargando, setCargando] = useState(false);
    const [falla, setFalla] = useState(false);

    const [urlComprobante, setUrlComprobante] = useState<string | null>(null);
    const [buscandoUrl, setBuscandoUrl] = useState(false);
    const [fallaUrl, setFallaUrl] = useState(false);
    /** El comprobante a pantalla completa, para leer el monto. */
    const [ampliado, setAmpliado] = useState(false);

    /** La entrega: marcar listo o retirado, con su confirmacion. */
    const [marcando, setMarcando] = useState(false);
    const [aConfirmar, setAConfirmar] = useState<null | 'lista' | 'retirada'>(null);
    const [fallaMarcar, setFallaMarcar] = useState<string | null>(null);

    useEffect(() => {
        let cancelado = false;
        // Al cambiar de venta se olvida el comprobante anterior: una URL
        // firmada es de ESE archivo y de nadie más.
        setUrlComprobante(null);
        setFallaUrl(false);
        setAmpliado(false);

        if (!ventaId) { setDetalle(null); setFalla(false); return; }
        setCargando(true);
        setFalla(false);
        getDetalleVenta(ventaId).then(d => {
            if (cancelado) return;
            if (d) setDetalle(d); else setFalla(true);
            setCargando(false);
        });
        return () => { cancelado = true; };
    }, [ventaId]);

    // Escape cierra primero la ampliación y recién después la ficha.
    useEffect(() => {
        if (!ampliado) return;
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopPropagation(); setAmpliado(false); }
        };
        window.addEventListener('keydown', alTeclear, true);
        return () => window.removeEventListener('keydown', alTeclear, true);
    }, [ampliado]);

    const v = detalle?.venta;
    const pdf = v ? esPdf(v.comprobantePath) : false;
    const telLlamar = v ? telParaLlamar(v.telefono) : null;
    const telWhatsApp = v ? telParaWhatsApp(v.telefono) : null;

    const verComprobante = async () => {
        if (!v || buscandoUrl) return;
        setBuscandoUrl(true);
        setFallaUrl(false);
        const url = await getComprobanteVentaUrl(v.comprobantePath);
        setBuscandoUrl(false);
        if (!url) { setFallaUrl(true); return; }
        setUrlComprobante(url);
        // El PDF no se dibuja acá adentro: se abre en otra pestaña.
        if (pdf) window.open(url, '_blank', 'noopener,noreferrer');
    };

    const chip: React.CSSProperties = {
        height: 40, padding: '0 14px', borderRadius: 10,
        background: '#fff', border: `1px solid ${C.borde}`, color: C.tinta,
    };

    return (
        <>
            <HojaDetalle
                abierta={!!ventaId}
                onCerrar={onCerrar}
                sub="Venta por transferencia"
                titulo={v?.codigo || 'Venta por transferencia'}
            >
                {cargando && (
                    <div className="flex items-center justify-center gap-2 py-10" style={{ color: C.tenue }}>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Buscando la venta</span>
                    </div>
                )}

                {falla && (
                    <p className="py-8 text-center text-[13px]" style={{ color: C.apagado }}>
                        No pudimos abrir esta venta. Probá de nuevo.
                    </p>
                )}

                {v && !cargando && (
                    <>
                        <p className="mt-1.5 m-0 text-[13px]" style={{ color: C.apagado }}>
                            {v.fechaTexto} · {v.hora}
                        </p>

                        {/* ── Quién compró ── */}
                        <h3 className="mt-5 mb-0 text-[13px] font-semibold" style={{ color: C.apagado }}>Comprador</h3>
                        <CamposDeFicha
                            campos={[
                                { rotulo: 'Nombre', valor: v.nombre || '—' },
                                { rotulo: 'Apellido', valor: v.apellido || '—' },
                                { rotulo: 'Teléfono', valor: v.telefono || '—' },
                                { rotulo: 'Email', valor: v.email || '—' },
                            ]}
                        />

                        {(telLlamar || telWhatsApp) && (
                            <div className={`grid gap-2.5 mt-3.5 ${telLlamar && telWhatsApp ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {telLlamar && (
                                    <a
                                        href={telLlamar}
                                        className="h-12 rounded-[10px] flex items-center justify-center gap-2 text-[14.5px] font-semibold"
                                        style={{ background: C.tinta, color: '#fff' }}
                                    >
                                        <Phone className="w-4 h-4" />
                                        Llamar
                                    </a>
                                )}
                                {telWhatsApp && (
                                    <a
                                        href={telWhatsApp}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-12 rounded-[10px] flex items-center justify-center gap-2 text-[14.5px] font-semibold"
                                        style={{ background: '#f1f2f4', color: C.tinta }}
                                    >
                                        WhatsApp
                                    </a>
                                )}
                            </div>
                        )}

                        {/* ── Qué se llevó ── */}
                        <h3 className="mt-5 mb-2 text-[13px] font-semibold" style={{ color: C.apagado }}>Prendas</h3>
                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.borde}` }}>
                            {detalle.items.map(i => (
                                <div
                                    key={i.code}
                                    className="flex items-center gap-3 px-4 py-2.5"
                                    style={{ borderTop: `1px solid ${C.bordeSuave}` }}
                                >
                                    <span className="flex-1 min-w-0 text-[13px] font-semibold" style={{ color: C.tinta }}>
                                        {i.cantidad} × {i.tipo === 'Buzos' ? 'Buzo' : 'Remera'} · Talle {i.talle}
                                    </span>
                                    <span className="shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: C.medio }}>
                                        {pesos(i.subtotal)}
                                    </span>
                                </div>
                            ))}
                            <div
                                className="flex items-center gap-3 px-4 py-3"
                                style={{ borderTop: `1px solid ${C.bordeSuave}`, background: C.fondo }}
                            >
                                <span className="flex-1 text-[13px] font-semibold" style={{ color: C.apagado }}>
                                    Total · {v.unidades === 1 ? '1 unidad' : `${v.unidades} unidades`}
                                </span>
                                <span
                                    className="inline-flex items-center h-6 px-2.5 rounded-full text-[12.5px] font-semibold tabular-nums"
                                    style={{ background: VERDE_FONDO, color: VERDE_TINTA }}
                                >
                                    {pesos(v.total)}
                                </span>
                            </div>
                        </div>

                        {/* ── El comprobante ── */}
                        <h3 className="mt-5 mb-2 text-[13px] font-semibold" style={{ color: C.apagado }}>Comprobante</h3>

                        {urlComprobante && !pdf ? (
                            <>
                                {/* Alto fijo y la imagen entera adentro: un
                                    comprobante es alto y angosto, y a tamaño
                                    completo empuja el total y el código fuera
                                    de la pantalla justo cuando se los compara. */}
                                <button
                                    type="button"
                                    onClick={() => setAmpliado(true)}
                                    aria-label="Ver el comprobante más grande"
                                    className="block w-full h-[240px] rounded-xl overflow-hidden cursor-zoom-in"
                                    style={{ background: C.fondo, border: `1px solid ${C.borde}` }}
                                >
                                    <img
                                        src={urlComprobante}
                                        alt="Comprobante de la transferencia"
                                        className="w-full h-full object-contain"
                                    />
                                </button>
                                <p className="mt-2 m-0 text-[12px]" style={{ color: C.tenue }}>
                                    Tocalo para verlo más grande. El enlace vence en 5 minutos.
                                </p>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={verComprobante}
                                    disabled={buscandoUrl}
                                    className="w-full h-12 rounded-[10px] inline-flex items-center justify-center gap-2 text-[14.5px] font-semibold disabled:opacity-50"
                                    style={{ background: '#f1f2f4', color: C.tinta }}
                                >
                                    {buscandoUrl
                                        ? <><Loader2 className="w-4 h-4 animate-spin" />Abriendo…</>
                                        : pdf
                                            ? <><ExternalLink className="w-4 h-4" />Abrir el PDF</>
                                            : 'Ver comprobante'}
                                </button>
                                {pdf && !fallaUrl && (
                                    <p className="mt-2 m-0 text-[12px]" style={{ color: C.tenue }}>
                                        Se abre en otra pestaña.
                                    </p>
                                )}
                            </>
                        )}

                        {fallaUrl && (
                            <p role="alert" className="mt-2 m-0 text-[13px] font-medium" style={{ color: '#b42318' }}>
                                No se pudo abrir el comprobante. Probá de nuevo.
                            </p>
                        )}

                        {/* ── La entrega ──
                            Al marcar listo, la BASE le manda la notificación a
                            quien compró. Si la persona que mira no atiende el
                            Punto, la RPC contesta 'sin_permiso' y se dice: los
                            botones no se esconden antes de tiempo porque el rol
                            del Punto se otorga de varias formas y adivinarlo
                            acá sería tener dos reglas distintas. */}
                        <h3 className="mt-5 mb-2 text-[13px] font-semibold" style={{ color: C.apagado }}>Entrega</h3>

                        <div
                            className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
                            style={{ background: C.fondo, border: `1px solid ${C.borde}` }}
                        >
                            <span className="flex-1 text-[13.5px] font-semibold" style={{ color: C.tinta }}>
                                {ESTADO_LARGO[estadoDePedido(v.listaAt, v.retiradaAt)]}
                            </span>
                            {v.retiradaAt && (
                                <span className="text-[12.5px]" style={{ color: C.apagado }}>
                                    {new Date(v.retiradaAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                </span>
                            )}
                        </div>

                        {!v.retiradaAt && (
                            <div
                                className="grid gap-2.5 mt-2.5"
                                style={{ gridTemplateColumns: v.listaAt ? '1fr' : '1fr 1fr' }}
                            >
                                {!v.listaAt && (
                                    <button
                                        type="button"
                                        onClick={() => { setFallaMarcar(null); setAConfirmar('lista'); }}
                                        disabled={marcando}
                                        className="h-12 rounded-[10px] text-[14.5px] font-semibold disabled:opacity-50"
                                        style={{ background: '#f1f2f4', color: C.tinta }}
                                    >
                                        Marcar listo
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { setFallaMarcar(null); setAConfirmar('retirada'); }}
                                    disabled={marcando}
                                    className="h-12 rounded-[10px] text-[14.5px] font-semibold disabled:opacity-50"
                                    style={{ background: C.tinta, color: '#fff' }}
                                >
                                    Marcar retirado
                                </button>
                            </div>
                        )}

                        {fallaMarcar && (
                            <p role="alert" className="mt-2 m-0 text-[13px] font-medium" style={{ color: '#b42318' }}>
                                {fallaMarcar}
                            </p>
                        )}
                    </>
                )}
            </HojaDetalle>

            {/* ── Confirmar la entrega ──
                Marcar retirado le avisa a quien compró y no se deshace desde
                acá, así que se pregunta antes. */}
            {aConfirmar && v && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Confirmar la entrega"
                    className="fixed inset-0 z-[140] flex items-center justify-center p-4"
                    style={{ background: 'rgba(15,23,42,.5)' }}
                    onClick={() => setAConfirmar(null)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-[380px] rounded-2xl bg-white p-5"
                        style={{ boxShadow: '0 24px 60px rgba(0,0,0,.22)' }}
                    >
                        <p className="m-0 text-[17px] font-semibold" style={{ color: C.tinta }}>
                            {aConfirmar === 'lista'
                                ? '¿Marcar ' + v.codigo + ' como listo?'
                                : '¿Entregaste ' + v.codigo + '?'}
                        </p>
                        <p className="mt-2 m-0 text-[14px] leading-[1.45]" style={{ color: C.apagado }}>
                            {aConfirmar === 'lista'
                                ? 'Le va a llegar un aviso a quien compró para que lo venga a buscar.'
                                : 'Queda registrado que se lo llevaron.'}
                        </p>
                        <div className="grid grid-cols-2 gap-2.5 mt-4">
                            <button
                                type="button"
                                onClick={() => setAConfirmar(null)}
                                className="h-12 rounded-[10px] text-[14.5px] font-semibold"
                                style={{ background: '#f1f2f4', color: C.tinta }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={marcando}
                                onClick={async () => {
                                    const que = aConfirmar;
                                    setMarcando(true);
                                    const r = await marcarVenta(v.id, que);
                                    setMarcando(false);
                                    setAConfirmar(null);
                                    if (!r.ok) {
                                        setFallaMarcar(r.motivo === 'sin_permiso'
                                            ? 'No tenés permiso para marcar entregas.'
                                            : 'No se pudo marcar. Probá de nuevo.');
                                        return;
                                    }
                                    const nuevo = await getDetalleVenta(v.id);
                                    if (nuevo) setDetalle(nuevo);
                                }}
                                className="h-12 rounded-[10px] text-[14.5px] font-semibold disabled:opacity-50"
                                style={{ background: C.tinta, color: '#fff' }}
                            >
                                {marcando ? 'Guardando…' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── El comprobante, a pantalla completa ── */}
            {ampliado && urlComprobante && !pdf && (
                <div
                    role="dialog"
                    aria-label="Comprobante de la transferencia"
                    onClick={() => setAmpliado(false)}
                    className="fixed inset-0 z-[130] flex items-center justify-center p-4 cursor-zoom-out"
                    style={{ background: 'rgba(15,23,42,.88)' }}
                >
                    <button
                        type="button"
                        onClick={() => setAmpliado(false)}
                        aria-label="Cerrar"
                        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}
                    >
                        <X className="w-4 h-4" strokeWidth={2.4} />
                    </button>
                    <img
                        src={urlComprobante}
                        alt="Comprobante de la transferencia"
                        className="max-w-full max-h-full object-contain"
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
};

export default DetalleVentaVoluntario;
