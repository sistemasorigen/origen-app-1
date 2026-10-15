import React, { useEffect, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { C } from './PiezasTablero';
import HojaDetalle, { CamposDeFicha } from './HojaDetalle';
import {
    getDetalleReporteStock, type DetalleDeReporte, type ItemDeReporte,
} from '../../services/reportesDeStock';

/**
 * La ficha de un reporte de stock: qué se contó, contra qué estaba y qué
 * cambió.
 *
 * La abre la planilla de "Reportes de stock" y también la novedad "Nuevo
 * reporte de stock" del tablero, así que vive acá y no adentro de ninguna de
 * las dos: es la misma ficha, y tiene que serlo.
 *
 * Se apoya en HojaDetalle, que ya resuelve lo difícil: panel desde abajo en
 * el teléfono con arrastre para cerrar, modal en la compu, Escape, foco y
 * prefers-reduced-motion.
 */

const VERDE_FONDO = '#eaf6ee';
const VERDE_TINTA = '#176639';
const AMBAR_FONDO = '#fbf0e2';
const AMBAR_TINTA = '#8a5a12';

/** "No se contaron los buzos" */
const textoOmitidos = (tipos: string[]) => {
    if (tipos.length === 0) return null;
    const nombres = tipos.map(t => t.toLowerCase());
    const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} ni ${nombres[nombres.length - 1]}`;
    return `No se contaron ${lista === nombres[0] ? `los ${lista}` : lista}`;
};

const Diferencia: React.FC<{ item: ItemDeReporte }> = ({ item }) => {
    if (item.diferencia === 0) {
        return <span className="text-[12px] font-semibold" style={{ color: C.tenue }}>Sin cambios</span>;
    }
    const suma = item.diferencia > 0;
    return (
        <span
            className="inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold tabular-nums whitespace-nowrap"
            style={suma
                ? { background: VERDE_FONDO, color: VERDE_TINTA }
                : { background: AMBAR_FONDO, color: AMBAR_TINTA }}
        >
            {suma ? `+${item.diferencia} Ingreso` : `−${-item.diferencia} Faltante`}
        </span>
    );
};

const FilaDeTalle: React.FC<{ item: ItemDeReporte; apagada?: boolean }> = ({ item, apagada }) => (
    <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{ borderTop: `1px solid ${C.bordeSuave}` }}
    >
        <span className="w-[72px] shrink-0 text-[13px] font-semibold" style={{ color: apagada ? C.apagado : C.tinta }}>
            Talle {item.talle}
        </span>
        <span className="flex-1 text-[13px] tabular-nums" style={{ color: C.apagado }}>
            {item.antes} <span style={{ color: C.tenue }}>→</span>{' '}
            <span className="font-semibold" style={{ color: apagada ? C.apagado : C.tinta }}>{item.contado}</span>
        </span>
        <Diferencia item={item} />
    </div>
);

const HojaReporteStock: React.FC<{
    /** El reporte a mostrar. Null = cerrada. */
    reporteId: string | null;
    onCerrar: () => void;
}> = ({ reporteId, onCerrar }) => {
    const [detalle, setDetalle] = useState<DetalleDeReporte | null>(null);
    const [cargando, setCargando] = useState(false);
    const [falla, setFalla] = useState(false);
    /** Los talles que no cambiaron van plegados: son los que no se miran. */
    const [verSinCambios, setVerSinCambios] = useState(false);

    useEffect(() => {
        let cancelado = false;
        if (!reporteId) { setDetalle(null); setFalla(false); return; }
        setCargando(true);
        setFalla(false);
        setVerSinCambios(false);
        getDetalleReporteStock(reporteId).then(d => {
            if (cancelado) return;
            if (d) setDetalle(d); else setFalla(true);
            setCargando(false);
        });
        return () => { cancelado = true; };
    }, [reporteId]);

    const r = detalle?.reporte;
    const omitidos = r ? textoOmitidos(r.tiposOmitidos) : null;

    // Remeras y buzos, cada uno con los suyos (ya vienen ordenados).
    const tipos = Array.from(new Set((detalle?.items || []).map(i => i.tipo || ''))).filter(Boolean);

    return (
        <HojaDetalle
            abierta={!!reporteId}
            onCerrar={onCerrar}
            sub="Reporte de stock"
            titulo={r?.autor ? `Reportó ${r.autor}` : 'Reporte de stock'}
        >
            {cargando && (
                <div className="flex items-center justify-center gap-2 py-10" style={{ color: C.tenue }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Buscando el reporte</span>
                </div>
            )}

            {falla && (
                <p className="py-8 text-center text-[13px]" style={{ color: C.apagado }}>
                    No pudimos abrir este reporte. Probá de nuevo.
                </p>
            )}

            {r && !cargando && (
                <>
                    <CamposDeFicha
                        campos={[
                            { rotulo: 'Cuándo', valor: `${r.fechaTexto} · ${r.hora}` },
                            { rotulo: 'Unidades contadas', valor: String(r.unidades) },
                            { rotulo: 'Ingresos', valor: `+${r.ingresos}` },
                            { rotulo: 'Faltantes', valor: `−${r.faltantes}` },
                            { rotulo: 'Talles sin cambios', valor: String(r.sinCambios) },
                        ]}
                    />

                    {omitidos && (
                        <p
                            className="mt-3.5 px-4 py-3 rounded-xl text-[13px] leading-relaxed"
                            style={{ background: AMBAR_FONDO, color: AMBAR_TINTA }}
                        >
                            {omitidos}.
                        </p>
                    )}

                    {tipos.map(tipo => {
                        const items = (detalle?.items || []).filter(i => i.tipo === tipo);
                        const cambiaron = items.filter(i => i.diferencia !== 0);
                        const iguales = items.filter(i => i.diferencia === 0);
                        return (
                            <section key={tipo} className="mt-4">
                                <h3 className="m-0 mb-2 text-[13px] font-semibold" style={{ color: C.apagado }}>{tipo}</h3>
                                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.borde}` }}>
                                    {cambiaron.map(i => <FilaDeTalle key={i.productCode || i.talle} item={i} />)}

                                    {iguales.length > 0 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setVerSinCambios(v => !v)}
                                                aria-expanded={verSinCambios}
                                                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] font-semibold"
                                                style={{ borderTop: `1px solid ${C.bordeSuave}`, background: C.fondo, color: C.apagado }}
                                            >
                                                Sin cambios ({iguales.length})
                                                <ChevronDown
                                                    className={`w-4 h-4 transition-transform duration-200 ${verSinCambios ? 'rotate-180' : ''}`}
                                                />
                                            </button>
                                            {verSinCambios && iguales.map(i => (
                                                <FilaDeTalle key={i.productCode || i.talle} item={i} apagada />
                                            ))}
                                        </>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </>
            )}
        </HojaDetalle>
    );
};

export default HojaReporteStock;
