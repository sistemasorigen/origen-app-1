import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { C, Tarjeta, Esqueleto } from '../../components/Reportes/PiezasTablero';
import DetalleVentaVoluntario from '../../components/Reportes/DetalleVentaVoluntario';
import { descargarExcel } from './exportacion';
import { pesos, resumenDePrendas, type Rango, type ClaseDeProducto } from '../../services/reportesPuntoInfo';
import {
    getVentasVoluntarios, getDetalleVenta,
    type VentaDeVoluntario, type ItemDeVenta,
} from '../../services/ventasVoluntarios';

/**
 * La pestaña "Ventas por transferencia" del tablero del Punto.
 *
 * Cada fila es una compra hecha desde /voluntarios: quién, qué se llevó,
 * cuánto pagó. El detalle —con el comprobante— se abre en la misma ficha que
 * abren la novedad del tablero y el historial de Movimientos.
 *
 * Mismo armado que la planilla de solicitudes y que la de reportes de stock
 * (KPIs, paginado, Excel, vacío), porque es el mismo tablero y tiene que
 * leerse igual.
 *
 * El path del comprobante NO sale de acá: ni a la pantalla ni al Excel.
 * Nombra la carpeta de quien compró, y un Excel se reenvía.
 */

const POR_PAGINA = 8;
const VERDE_FONDO = '#eaf6ee';
const VERDE_TINTA = '#176639';

/** Las columnas de la compu. */
const GRILLA = 'minmax(0,1.1fr) minmax(0,1.3fr) minmax(0,1.1fr) minmax(0,.7fr) minmax(0,.7fr)';
const COLUMNAS = ['FECHA Y HORA', 'COMPRADOR', 'PRENDAS', 'TOTAL', 'CÓDIGO'];

const Kpi: React.FC<{ label: string; valor: string; nota: string }> = ({ label, valor, nota }) => (
    <Tarjeta className="p-[14px] md:px-[18px] md:py-4">
        <p className="m-0 text-[12.5px] leading-[1.35] font-semibold" style={{ color: C.apagado }}>{label}</p>
        <p className="mt-2.5 m-0 text-[26px] md:text-[30px] leading-none font-semibold tracking-[-.02em] tabular-nums" style={{ color: C.tinta }}>
            {valor}
        </p>
        <p className="mt-[9px] m-0 text-[12px] leading-[1.45] font-medium" style={{ color: C.apagado }}>{nota}</p>
    </Tarjeta>
);

const VentasVoluntarios: React.FC<{ rango: Rango; esMovil: boolean }> = ({ rango, esMovil }) => {
    const [ventas, setVentas] = useState<VentaDeVoluntario[] | null>(null);
    const [cargando, setCargando] = useState(true);
    const [falla, setFalla] = useState(false);
    const [pagina, setPagina] = useState(0);
    const [abierta, setAbierta] = useState<string | null>(null);
    /** Las prendas de cada venta, para la columna angosta. Se piden una vez. */
    const [prendas, setPrendas] = useState<Map<string, ItemDeVenta[]>>(new Map());

    const pedir = useCallback(async () => {
        setCargando(true);
        setFalla(false);
        const lista = await getVentasVoluntarios(rango);
        if (!lista) setFalla(true); else setVentas(lista);
        setCargando(false);
    }, [rango]);

    useEffect(() => { pedir(); }, [pedir]);
    useEffect(() => { setPagina(0); }, [rango.desde, rango.hasta]);

    const lista = ventas || [];
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    const pag = Math.min(pagina, paginas - 1);
    const visibles = lista.slice(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA);

    /**
     * Las prendas de las ventas que se están viendo.
     *
     * Se piden por página y no de una: con un período largo serían cientos de
     * consultas para llenar una columna que casi nadie mira entera.
     */
    useEffect(() => {
        let cancelado = false;
        const faltan = visibles.filter(v => !prendas.has(v.id)).map(v => v.id);
        if (faltan.length === 0) return;
        Promise.all(faltan.map(id => getDetalleVenta(id))).then(ds => {
            if (cancelado) return;
            setPrendas(previo => {
                const nuevo = new Map(previo);
                ds.forEach(d => { if (d) nuevo.set(d.venta.id, d.items); });
                return nuevo;
            });
        });
        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibles.map(v => v.id).join(',')]);

    /** "2 remeras, 1 buzo" — por prenda, que es lo que se escanea en la fila. */
    const textoPrendas = (id: string): string => {
        const items = prendas.get(id);
        if (!items) return '…';
        return resumenDePrendas(
            items.map(i => ({ producto: (i.tipo as ClaseDeProducto) || null, cantidad: i.cantidad })),
            ', ',
        );
    };

    const totales = useMemo(() => ({
        ventas: lista.length,
        unidades: lista.reduce((n, v) => n + v.unidades, 0),
        plata: lista.reduce((n, v) => n + v.total, 0),
    }), [lista]);

    const bajarExcel = async () => {
        if (lista.length === 0) return;
        // Las prendas de TODAS, no sólo las de la página que se está viendo.
        const detalles = await Promise.all(lista.map(v => getDetalleVenta(v.id)));

        descargarExcel(
            [
                {
                    nombre: 'Ventas',
                    filas: lista.map(v => ({
                        'FECHA': v.fechaTexto,
                        'HORA': v.hora,
                        'CÓDIGO': v.codigo,
                        'NOMBRE': v.nombre || '',
                        'APELLIDO': v.apellido || '',
                        'TELÉFONO': v.telefono || '',
                        'EMAIL': v.email || '',
                        'UNIDADES': v.unidades,
                        'TOTAL': v.total,
                    })),
                },
                {
                    nombre: 'Prendas',
                    filas: detalles.flatMap(d => (d ? d.items.map(i => ({
                        'CÓDIGO': d.venta.codigo,
                        'FECHA': d.venta.fechaTexto,
                        'PRENDA': i.tipo === 'Buzos' ? 'Buzo' : 'Remera',
                        'TALLE': i.talle || '',
                        'CANTIDAD': i.cantidad,
                        'PRECIO UNITARIO': i.precioUnitario,
                        'SUBTOTAL': i.subtotal,
                    })) : [])),
                },
            ],
            `Reportes-Punto-Ventas-${rango.desde}-a-${rango.hasta}.xlsx`,
        );
    };

    // ── Estados ─────────────────────────────────────────────────────────
    if (falla) {
        return (
            <Tarjeta className="mt-6 px-6 py-11 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#fdecea' }}>
                    <AlertCircle className="w-[22px] h-[22px]" style={{ color: '#b42318' }} />
                </div>
                <p className="mt-4 m-0 text-[16px] font-semibold" style={{ color: C.tinta }}>No pudimos cargar las ventas</p>
                <p className="mt-2 m-0 max-w-[380px] text-[13px] leading-[1.6]" style={{ color: C.apagado }}>
                    Revisá tu conexión e intentá de nuevo. No se perdió nada: esta pantalla sólo lee.
                </p>
                <button type="button" onClick={pedir}
                    className="h-11 px-5 mt-[18px] rounded-[10px] text-sm font-semibold"
                    style={{ background: C.tinta, color: '#fff' }}>
                    Reintentar
                </button>
            </Tarjeta>
        );
    }

    if (cargando && !ventas) {
        return (
            <div aria-busy="true" className="mt-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[0, 1, 2].map(i => (
                        <Tarjeta key={i} className="p-[14px] md:px-[18px] md:py-4">
                            <Esqueleto alto={12} ancho="70%" />
                            <div className="mt-3"><Esqueleto alto={26} ancho="46%" /></div>
                            <div className="mt-3"><Esqueleto alto={11} ancho="60%" /></div>
                        </Tarjeta>
                    ))}
                </div>
                <Tarjeta className="mt-5 px-5 py-[18px]">
                    <Esqueleto alto={14} ancho="190px" />
                    <div className="mt-4 flex flex-col gap-2.5">
                        {[0, 1, 2, 3, 4, 5].map(i => <Esqueleto key={i} alto={44} />)}
                    </div>
                </Tarjeta>
            </div>
        );
    }

    return (
        <>
            {/* ── Lo que se vendió por transferencia ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
                <Kpi
                    label="Ventas"
                    valor={String(totales.ventas)}
                    nota={totales.ventas === 1 ? 'Una compra en el período' : 'Compras en el período'}
                />
                <Kpi
                    label="Unidades vendidas"
                    valor={String(totales.unidades)}
                    nota="Remeras y buzos, juntos"
                />
                <Kpi
                    label="Recaudado por transferencia"
                    valor={pesos(totales.plata)}
                    nota="Según el precio del momento de cada compra"
                />
            </div>

            <Tarjeta className="mt-5 overflow-hidden">
                <div className="px-5 pt-[18px] pb-4 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Ventas por transferencia</p>
                        <p className="mt-1 m-0 text-[12.5px]" style={{ color: C.tenue }}>
                            Compras hechas desde /voluntarios, de la más nueva a la más vieja
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={bajarExcel}
                        disabled={lista.length === 0}
                        aria-label="Descargar en Excel"
                        className="h-11 md:h-[38px] px-3.5 shrink-0 rounded-[10px] inline-flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40"
                        style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                    >
                        <Download className="w-[15px] h-[15px]" />
                        Excel
                    </button>
                </div>

                {lista.length > 0 ? (
                    <>
                        {!esMovil && (
                            <>
                                <div
                                    className="grid gap-3 px-5 py-2.5"
                                    style={{ gridTemplateColumns: GRILLA, background: C.fondo, borderTop: `1px solid ${C.bordeSuave}`, borderBottom: `1px solid ${C.bordeSuave}` }}
                                >
                                    {COLUMNAS.map(c => (
                                        <span key={c} className="text-[11px] font-semibold tracking-[.04em] truncate" style={{ color: C.apagado }}>
                                            {c}
                                        </span>
                                    ))}
                                </div>
                                {visibles.map(v => (
                                    <div
                                        key={v.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setAbierta(v.id)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierta(v.id); }
                                        }}
                                        aria-label={`Ver la venta ${v.codigo}`}
                                        className="grid gap-3 items-center px-5 py-[11px] cursor-pointer hover:bg-slate-50"
                                        style={{ gridTemplateColumns: GRILLA, borderBottom: '1px solid #f2f3f5' }}
                                    >
                                        <div className="min-w-0">
                                            <p className="m-0 text-[13px] font-semibold truncate" style={{ color: C.tinta }}>{v.fechaTexto}</p>
                                            <p className="mt-0.5 m-0 text-[12px] tabular-nums" style={{ color: C.tenue }}>{v.hora}</p>
                                        </div>
                                        <p className="m-0 text-[13px] font-semibold truncate" style={{ color: C.tinta }}>
                                            {v.nombreCompleto || '—'}
                                        </p>
                                        <p className="m-0 text-[13px] truncate" style={{ color: C.medio }}>{textoPrendas(v.id)}</p>
                                        <p className="m-0 text-[13px] font-semibold tabular-nums" style={{ color: C.tinta }}>{pesos(v.total)}</p>
                                        <span
                                            className="justify-self-start inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold whitespace-nowrap"
                                            style={{ background: VERDE_FONDO, color: VERDE_TINTA }}
                                        >
                                            {v.codigo}
                                        </span>
                                    </div>
                                ))}
                            </>
                        )}

                        {esMovil && visibles.map(v => (
                            <div
                                key={v.id}
                                className="flex items-center gap-3 pl-5 pr-4 py-3"
                                style={{ borderTop: `1px solid ${C.bordeSuave}` }}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="m-0 text-[14.5px] font-semibold truncate" style={{ color: C.tinta }}>
                                        {v.nombreCompleto || v.codigo}
                                    </p>
                                    <p className="mt-0.5 m-0 text-[12.5px] tabular-nums" style={{ color: C.tenue }}>
                                        {v.fechaTexto} · {v.hora} · {pesos(v.total)}
                                    </p>
                                </div>
                                {/* El rótulo nombra la venta: ocho "Ver detalles" iguales
                                    no le sirven a nadie que navegue por teclado. */}
                                <button
                                    type="button"
                                    onClick={() => setAbierta(v.id)}
                                    aria-label={`Ver la venta ${v.codigo}`}
                                    className="shrink-0 h-11 px-3.5 rounded-[10px] text-[13px] font-semibold"
                                    style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.tinta }}
                                >
                                    Ver detalles
                                </button>
                            </div>
                        ))}

                        <div
                            className="flex items-center justify-between gap-2.5 pl-5 pr-4 py-2.5"
                            style={{ borderTop: `1px solid ${C.bordeSuave}`, background: '#fcfcfd' }}
                        >
                            <span className="text-[12.5px] tabular-nums" style={{ color: C.apagado }}>
                                {pag * POR_PAGINA + 1}–{pag * POR_PAGINA + visibles.length} de {lista.length}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setPagina(p => Math.max(0, p - 1))}
                                    disabled={pag === 0}
                                    aria-label="Página anterior"
                                    className="w-11 h-11 md:w-[38px] md:h-[38px] rounded-[10px] flex items-center justify-center disabled:opacity-40"
                                    style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                >
                                    <ChevronLeft className="w-[15px] h-[15px]" />
                                </button>
                                {!esMovil && Array.from({ length: paginas }, (_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setPagina(i)}
                                        aria-label={`Página ${i + 1}`}
                                        aria-current={i === pag ? 'page' : undefined}
                                        className="min-w-[38px] h-[38px] px-2 rounded-[10px] text-[13px] font-semibold tabular-nums"
                                        style={i === pag
                                            ? { background: C.tinta, border: `1px solid ${C.tinta}`, color: '#fff' }
                                            : { background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setPagina(p => Math.min(paginas - 1, p + 1))}
                                    disabled={pag >= paginas - 1}
                                    aria-label="Página siguiente"
                                    className="w-11 h-11 md:w-[38px] md:h-[38px] rounded-[10px] flex items-center justify-center disabled:opacity-40"
                                    style={{ background: '#fff', border: `1px solid ${C.borde}`, color: C.medio }}
                                >
                                    <ChevronRight className="w-[15px] h-[15px]" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="mx-5 mb-[18px] px-5 py-[34px] rounded-xl flex flex-col items-center text-center" style={{ background: C.fondo }}>
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.medio }}>
                            No hubo ventas por transferencia en este período.
                        </p>
                        <p className="mt-1.5 m-0 max-w-[360px] text-[13px] leading-[1.55]" style={{ color: C.apagado }}>
                            Elegí otro período en el calendario de arriba.
                        </p>
                    </div>
                )}

                <p className="m-0 px-5 pt-3 pb-3.5 text-[12px] leading-[1.5]" style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.apagado }}>
                    Cada compra descontó su stock en el momento. Tocá una para ver el
                    comprobante de la transferencia. Es solo de lectura.
                </p>
            </Tarjeta>

            <DetalleVentaVoluntario ventaId={abierta} onCerrar={() => setAbierta(null)} />
        </>
    );
};

export default VentasVoluntarios;
