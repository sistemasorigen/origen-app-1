import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { C, Tarjeta, Esqueleto } from '../../components/Reportes/PiezasTablero';
import HojaReporteStock from '../../components/Reportes/HojaReporteStock';
import { descargarExcel } from './exportacion';
import type { Rango } from '../audiencia/SelectorDeRango';
import {
    getReportesDeStock, getItemsDeReportes, type ReporteDeStock,
} from '../../services/reportesDeStock';

/**
 * La pestaña "Reportes de stock" del tablero del Punto.
 *
 * Cada fila es un conteo del stand: quién lo hizo, cuándo, cuántas unidades
 * contó y qué cambió. El detalle —talle por talle— se abre en la misma ficha
 * que usa la novedad "Nuevo reporte de stock" del Resumen.
 *
 * Mismo armado que la planilla de solicitudes (pestañas, paginado, Excel,
 * vacío), porque es la misma pantalla y tiene que leerse igual.
 */

const POR_PAGINA = 8;
const VERDE_TINTA = '#176639';
const AMBAR_TINTA = '#8a5a12';

/** Las columnas de la compu. */
const GRILLA = 'minmax(0,1.15fr) minmax(0,1.25fr) minmax(0,.8fr) minmax(0,.7fr) minmax(0,.7fr) minmax(0,.7fr)';
const COLUMNAS = ['FECHA Y HORA', 'REPORTÓ', 'UNIDADES CONTADAS', 'INGRESOS', 'FALTANTES', 'CAMBIOS'];

const Kpi: React.FC<{ label: string; valor: number; nota: string }> = ({ label, valor, nota }) => (
    <Tarjeta className="p-[14px] md:px-[18px] md:py-4">
        <p className="m-0 text-[12.5px] leading-[1.35] font-semibold" style={{ color: C.apagado }}>{label}</p>
        <p className="mt-2.5 m-0 text-[26px] md:text-[30px] leading-none font-semibold tracking-[-.02em] tabular-nums" style={{ color: C.tinta }}>
            {valor}
        </p>
        <p className="mt-[9px] m-0 text-[12px] leading-[1.45] font-medium" style={{ color: C.apagado }}>{nota}</p>
    </Tarjeta>
);

const ReportesDeStock: React.FC<{ rango: Rango; esMovil: boolean }> = ({ rango, esMovil }) => {
    const [reportes, setReportes] = useState<ReporteDeStock[] | null>(null);
    const [cargando, setCargando] = useState(true);
    const [falla, setFalla] = useState(false);
    const [pagina, setPagina] = useState(0);
    const [abierto, setAbierto] = useState<string | null>(null);

    const pedir = useCallback(async () => {
        setCargando(true);
        setFalla(false);
        const lista = await getReportesDeStock(rango);
        if (!lista) setFalla(true); else setReportes(lista);
        setCargando(false);
    }, [rango]);

    useEffect(() => { pedir(); }, [pedir]);
    useEffect(() => { setPagina(0); }, [rango.desde, rango.hasta]);

    const lista = reportes || [];
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    const pag = Math.min(pagina, paginas - 1);
    const visibles = lista.slice(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA);

    const totales = useMemo(() => ({
        reportes: lista.length,
        ingresos: lista.reduce((n, r) => n + r.ingresos, 0),
        faltantes: lista.reduce((n, r) => n + r.faltantes, 0),
    }), [lista]);

    const bajarExcel = async () => {
        if (lista.length === 0) return;
        const items = await getItemsDeReportes(lista.map(r => r.id));
        const porId = new Map(lista.map(r => [r.id, r]));
        descargarExcel(
            [
                {
                    nombre: 'Reportes',
                    filas: lista.map(r => ({
                        'Fecha': r.fechaTexto,
                        'Hora': r.hora,
                        'Reportó': r.autor || '',
                        'Unidades contadas': r.unidades,
                        'Ingresos': r.ingresos,
                        'Faltantes': r.faltantes,
                        'Cambios': r.cambios,
                        'Sin cambios': r.sinCambios,
                        'No se contaron': r.tiposOmitidos.join(', '),
                    })),
                },
                {
                    nombre: 'Detalle por talle',
                    filas: (items || []).map(i => {
                        const r = porId.get(i.reportId);
                        return {
                            'Fecha': r ? r.fechaTexto : '',
                            'Hora': r ? r.hora : '',
                            'Reportó': r ? (r.autor || '') : '',
                            'Producto': i.tipo || '',
                            'Talle': i.talle || '',
                            'Antes': i.antes,
                            'Contado': i.contado,
                            'Diferencia': i.diferencia,
                        };
                    }),
                },
            ],
            `Reportes-Punto-Stock-${rango.desde}-a-${rango.hasta}.xlsx`,
        );
    };

    if (falla) {
        return (
            <Tarjeta className="mt-6 px-6 py-11 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#fdecea' }}>
                    <AlertCircle className="w-[22px] h-[22px]" style={{ color: '#b42318' }} />
                </div>
                <p className="mt-4 m-0 text-[16px] font-semibold" style={{ color: C.tinta }}>No pudimos cargar los reportes de stock</p>
                <p className="mt-2 m-0 max-w-[380px] text-[13px] leading-[1.6]" style={{ color: C.apagado }}>
                    Revisá tu conexión e intentá de nuevo. No se perdió nada: esta pantalla sólo lee.
                </p>
                <button
                    type="button" onClick={pedir}
                    className="h-11 px-5 mt-[18px] rounded-[10px] text-sm font-semibold"
                    style={{ background: C.tinta, color: '#fff' }}
                >
                    Reintentar
                </button>
            </Tarjeta>
        );
    }

    if (cargando && !reportes) {
        return (
            <div aria-busy="true" className="mt-6">
                <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map(i => (
                        <Tarjeta key={i} className="p-[14px] md:px-[18px] md:py-4">
                            <Esqueleto alto={12} ancho="70%" />
                            <div className="mt-3"><Esqueleto alto={26} ancho="40%" /></div>
                            <div className="mt-3"><Esqueleto alto={11} ancho="80%" /></div>
                        </Tarjeta>
                    ))}
                </div>
                <Tarjeta className="mt-5 px-5 py-[18px]">
                    <Esqueleto alto={14} ancho="180px" />
                    <div className="mt-4 flex flex-col gap-2.5">
                        {[0, 1, 2, 3, 4].map(i => <Esqueleto key={i} alto={44} />)}
                    </div>
                </Tarjeta>
            </div>
        );
    }

    return (
        <>
            {/* ── Tres números del período ── */}
            <div className="grid grid-cols-3 gap-3 mt-6">
                <Kpi label="Reportes enviados" valor={totales.reportes} nota="Conteos del stand en el período" />
                <Kpi label="Unidades que ingresaron por reporte" valor={totales.ingresos} nota="Aparecieron al contar" />
                <Kpi label="Unidades faltantes" valor={totales.faltantes} nota="Estaban cargadas y no se encontraron" />
            </div>

            {/* ── La planilla ── */}
            <Tarjeta className="mt-5 overflow-hidden">
                <div className="px-5 pt-[18px] pb-4 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.tinta }}>Reportes de stock</p>
                        <p className="mt-1 m-0 text-[12.5px]" style={{ color: C.tenue }}>Del más nuevo al más viejo</p>
                    </div>
                    <button
                        type="button"
                        onClick={bajarExcel}
                        disabled={lista.length === 0}
                        aria-label="Descargar en Excel"
                        className="shrink-0 h-11 md:h-[38px] px-3.5 rounded-[10px] inline-flex items-center gap-2 text-[13px] font-semibold disabled:opacity-40"
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
                                        <span key={c} className="text-[11px] font-semibold tracking-[.04em] truncate" style={{ color: C.apagado }}>{c}</span>
                                    ))}
                                </div>
                                {visibles.map(r => (
                                    <div
                                        key={r.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setAbierto(r.id)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAbierto(r.id); }
                                        }}
                                        aria-label={`Ver el reporte de ${r.fechaTexto} ${r.hora}`}
                                        className="grid gap-3 items-center px-5 py-[11px] cursor-pointer hover:bg-slate-50"
                                        style={{ gridTemplateColumns: GRILLA, borderBottom: `1px solid #f2f3f5` }}
                                    >
                                        <div className="min-w-0">
                                            <p className="m-0 text-[13px] font-semibold truncate" style={{ color: C.tinta }}>{r.fechaTexto}</p>
                                            <p className="mt-0.5 m-0 text-[12px]" style={{ color: C.tenue }}>{r.hora}</p>
                                        </div>
                                        <p className="m-0 text-[13px] font-medium truncate" style={{ color: C.medio }}>{r.autor || '—'}</p>
                                        <p className="m-0 text-[13px] tabular-nums" style={{ color: C.medio }}>{r.unidades}</p>
                                        <p className="m-0 text-[13px] font-semibold tabular-nums" style={{ color: r.ingresos > 0 ? VERDE_TINTA : C.tenue }}>
                                            {r.ingresos > 0 ? `+${r.ingresos}` : '—'}
                                        </p>
                                        <p className="m-0 text-[13px] font-semibold tabular-nums" style={{ color: r.faltantes > 0 ? AMBAR_TINTA : C.tenue }}>
                                            {r.faltantes > 0 ? `−${r.faltantes}` : '—'}
                                        </p>
                                        <p className="m-0 text-[13px] tabular-nums" style={{ color: C.medio }}>{r.cambios}</p>
                                    </div>
                                ))}
                            </>
                        )}

                        {esMovil && visibles.map(r => (
                            <div
                                key={r.id}
                                className="flex items-center gap-3 pl-5 pr-4 py-3"
                                style={{ borderTop: `1px solid ${C.bordeSuave}` }}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="m-0 text-[14.5px] font-semibold truncate" style={{ color: C.tinta }}>
                                        {r.fechaTexto} · {r.hora}
                                    </p>
                                    <p className="mt-0.5 m-0 text-[12.5px] truncate" style={{ color: C.tenue }}>
                                        {r.autor || 'Sin nombre'}
                                    </p>
                                    <p className="mt-1 m-0 text-[13px] font-semibold tabular-nums">
                                        <span style={{ color: r.ingresos > 0 ? VERDE_TINTA : C.tenue }}>+{r.ingresos}</span>
                                        <span style={{ color: C.tenue }}> · </span>
                                        <span style={{ color: r.faltantes > 0 ? AMBAR_TINTA : C.tenue }}>−{r.faltantes}</span>
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAbierto(r.id)}
                                    aria-label={`Ver el reporte de ${r.fechaTexto} ${r.hora}`}
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
                        <p className="m-0 text-[15px] font-semibold" style={{ color: C.medio }}>No hubo reportes de stock en este período.</p>
                        <p className="mt-1.5 m-0 max-w-[360px] text-[13px] leading-[1.55]" style={{ color: C.apagado }}>
                            Elegí otro período en el calendario de arriba.
                        </p>
                    </div>
                )}

                <p className="m-0 px-5 pt-3 pb-3.5 text-[12px] leading-[1.5]" style={{ borderTop: `1px solid ${C.bordeSuave}`, color: C.apagado }}>
                    Cada reporte es un conteo del stand. El stock quedó como dice la columna "contado". Es solo de lectura.
                </p>
            </Tarjeta>

            <HojaReporteStock reporteId={abierto} onCerrar={() => setAbierto(null)} />
        </>
    );
};

export default ReportesDeStock;
