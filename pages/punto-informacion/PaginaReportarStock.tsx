import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { ProductType, InfoPointProduct } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { puedeEntrarAlPunto } from '../../services/authUtils';
import useBloqueoDeFondo from '../../hooks/useBloqueoDeFondo';
import SinAcceso from '../../components/auth/SinAcceso';
import PanelGuardado, { EstadoGuardado } from '../../components/GCX/PanelGuardado';
import { Desplegable, CLASES, porTalle } from '../../components/info-point/DesplegableDelPunto';
import { registrarReporteStock, type ConteoDeProducto } from '../../services/reportesDeStock';
import {
    ArrowLeft, Loader2, PackageOpen, Minus, Plus, Trash2, X, AlertTriangle,
} from 'lucide-react';

/**
 * Reportar el stock.
 *
 * Es lo primero que se hace al llegar al stand: contar lo que hay. Antes se
 * contaba igual pero se mandaba por WhatsApp, y alguien lo pasaba después.
 *
 * Trabaja como la carga de varios movimientos —arranca vacía, se agrega un
 * talle por vez con la misma píldora, se guarda todo junto—, con dos
 * diferencias que son el punto de la función:
 *
 *   · Cada línea es sólo "cuántos hay". No hay entrada, salida ni ajuste:
 *     eso lo deduce la base comparando contra lo que tenía.
 *   · NO se muestra el stock del sistema en ningún lado de esta pantalla.
 *     Si uno ve "12" antes de contar, cuenta hasta 12. El número del sistema
 *     aparece recién al revisar, cuando el conteo ya está cerrado.
 *
 * Lo que no se anota vale 0. Esa es justamente la gracia —así se detecta lo
 * que falta— y por eso la revisión avisa tan fuerte lo que va a quedar en 0.
 */

const BORRADOR = 'punto-reportar-borrador';

interface Linea {
    code: string;
    cantidad: number;
}

type Respuesta = 'hay-ninguno' | 'no-conte';

/** "buzos talle 3" */
const enMinusculas = (p: InfoPointProduct) => `${p.type.toLowerCase()} talle ${p.size}`;

// ── Agregar un talle ────────────────────────────────────────────────────
/**
 * Primero remera o buzo, después el talle. Los que ya están en la lista se
 * ven, pero bloqueados: que desaparezcan haría dudar de si se agregaron.
 *
 * Acá NO va el stock al lado del talle, como sí va en movimientos: esta
 * pantalla se cuenta a ciegas.
 */
const SelectorDeTalle: React.FC<{
    productos: InfoPointProduct[];
    yaEnLaLista: string[];
    abierta: string | null;
    onAbrir: (clave: string | null) => void;
    onAgregar: (code: string) => void;
}> = ({ productos, yaEnLaLista, abierta, onAbrir, onAgregar }) => {
    const sinMovimiento = useReducedMotion();
    const [abiertoElCuadro, setAbiertoElCuadro] = useState(false);
    const [clase, setClase] = useState<ProductType | null>(null);
    const [talle, setTalle] = useState<string | null>(null);

    const clasesConProductos = CLASES.filter(c => productos.some(p => p.type === c));
    const talles = productos.filter(p => p.type === clase).sort(porTalle);
    const elegido = talles.find(p => p.size === talle);
    const listo = !!clase && !!elegido && !yaEnLaLista.includes(elegido.code);

    const cerrarTodo = () => {
        setAbiertoElCuadro(false);
        setClase(null);
        setTalle(null);
        onAbrir(null);
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <button
                type="button"
                aria-expanded={abiertoElCuadro}
                onClick={() => { if (abiertoElCuadro) cerrarTodo(); else setAbiertoElCuadro(true); }}
                className="w-full h-14 px-5 flex items-center gap-2.5 text-[15px] font-semibold text-black hover:bg-slate-50 transition-colors"
            >
                <Plus className={`w-4 h-4 shrink-0 transition-transform duration-200 ${abiertoElCuadro ? 'rotate-45' : ''}`} />
                Agregar talle
            </button>

            <AnimatePresence initial={false}>
                {abiertoElCuadro && (
                    <motion.div
                        initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={sinMovimiento ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: sinMovimiento ? 0 : 0.18, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-3 border-t border-slate-100">
                            <Desplegable
                                etiqueta="Remeras o buzos"
                                vacio="Remeras o buzos"
                                valor={clase}
                                opciones={clasesConProductos.map(c => ({ valor: c }))}
                                abierto={abierta === 'nuevo-clase'}
                                onAbrir={a => onAbrir(a ? 'nuevo-clase' : null)}
                                onElegir={v => { setClase(v as ProductType); setTalle(null); onAbrir(null); }}
                            />

                            <Desplegable
                                etiqueta="Talle"
                                vacio="Talle"
                                valor={talle}
                                opciones={talles.map(p => ({
                                    valor: p.size,
                                    etiqueta: `Talle ${p.size}`,
                                    bloqueada: yaEnLaLista.includes(p.code),
                                    nota: yaEnLaLista.includes(p.code) ? 'ya está en la lista' : undefined,
                                }))}
                                abierto={abierta === 'nuevo-talle'}
                                onAbrir={a => onAbrir(a ? 'nuevo-talle' : null)}
                                onElegir={v => { setTalle(v); onAbrir(null); }}
                            />

                            <button
                                type="button"
                                disabled={!listo}
                                onClick={() => { if (elegido) { onAgregar(elegido.code); cerrarTodo(); } }}
                                className="w-full h-12 bg-black text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:bg-black disabled:active:scale-100"
                            >
                                Confirmar
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Una línea del conteo ────────────────────────────────────────────────
const FichaDeConteo: React.FC<{
    producto: InfoPointProduct;
    cantidad: number;
    onCantidad: (cantidad: number) => void;
    onQuitar: () => void;
}> = ({ producto, cantidad, onCantidad, onQuitar }) => {
    const alEscribir = (texto: string) => {
        const n = parseInt(texto.replace(/[^0-9]/g, ''), 10);
        if (Number.isNaN(n)) return;
        onCantidad(n);
    };

    return (
        <li
            aria-label={producto.name}
            className="p-4 bg-white transition-colors md:rounded-xl md:border md:border-slate-300"
        >
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-[15px] text-black truncate">{producto.type}</h3>
                    <span className="shrink-0 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                        Talle {producto.size}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onQuitar}
                    aria-label={`Quitar ${producto.name} del conteo`}
                    className="shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex items-stretch h-12 w-full rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                    type="button"
                    onClick={() => onCantidad(Math.max(1, cantidad - 1))}
                    disabled={cantidad <= 1}
                    aria-label={`Uno menos en ${producto.name}`}
                    className="w-14 shrink-0 flex items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50 disabled:text-slate-200 disabled:hover:bg-transparent transition-colors"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <input
                    type="number"
                    inputMode="numeric"
                    value={cantidad}
                    min={1}
                    max={9999}
                    onChange={e => alEscribir(e.target.value)}
                    onBlur={() => onCantidad(Math.min(9999, Math.max(1, cantidad)))}
                    aria-label={`Cuántos hay de ${producto.name}`}
                    className="flex-1 min-w-0 h-full text-center tabular-nums text-2xl font-semibold"
                />
                <button
                    type="button"
                    onClick={() => onCantidad(Math.min(9999, cantidad + 1))}
                    disabled={cantidad >= 9999}
                    aria-label={`Uno más en ${producto.name}`}
                    className="w-14 shrink-0 flex items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50 disabled:text-slate-200 disabled:hover:bg-transparent transition-colors"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </li>
    );
};

// ── La pantalla ─────────────────────────────────────────────────────────
const ReportarStockContent: React.FC = () => {
    const navigate = useNavigate();
    const sinMovimiento = useReducedMotion();
    const { products, isLoading, refreshData, registrarEnBitacora, showNotification } = useStore();

    const [lineas, setLineas] = useState<Linea[]>(() => {
        // El borrador: si la app se cerró sin querer, el conteo sigue acá.
        try {
            const guardado = sessionStorage.getItem(BORRADOR);
            const leido = guardado ? JSON.parse(guardado) : null;
            return Array.isArray(leido) ? leido.filter(l => l && typeof l.code === 'string') : [];
        } catch { return []; }
    });
    const [abierta, setAbierta] = useState<string | null>(null);
    const [revisando, setRevisando] = useState(false);
    const [refrescando, setRefrescando] = useState(false);
    const [respuestas, setRespuestas] = useState<Partial<Record<ProductType, Respuesta>>>({});
    const [confirmoTodoEnCero, setConfirmoTodoEnCero] = useState(false);
    /** Se genera al abrir la revisión y se reusa en los reintentos. */
    const [idReporte, setIdReporte] = useState<string | null>(null);
    const [estadoEnvio, setEstadoEnvio] = useState<EstadoGuardado>('cerrado');
    /** Los totales que devolvió la base: son los de verdad, no el pronóstico. */
    const [totalesEnviados, setTotalesEnviados] = useState<{ ingresos: number; faltantes: number } | null>(null);
    const [mensajeError, setMensajeError] = useState<string>('');

    useBloqueoDeFondo(revisando);

    useEffect(() => {
        try { sessionStorage.setItem(BORRADOR, JSON.stringify(lineas)); } catch { /* sin lugar: se sigue igual */ }
    }, [lineas]);

    const porCodigo = useMemo(() => {
        const mapa: Record<string, InfoPointProduct> = {};
        products.forEach(p => { mapa[p.code] = p; });
        return mapa;
    }, [products]);

    const enOrden = useMemo(
        () => [...lineas].sort((a, b) => {
            const pa = porCodigo[a.code];
            const pb = porCodigo[b.code];
            if (!pa || !pb) return 0;
            return porTalle(pa, pb);
        }),
        [lineas, porCodigo],
    );

    const unidades = lineas.reduce((n, l) => n + l.cantidad, 0);
    const hayInventario = products.length > 0;

    // ── La revisión ─────────────────────────────────────────────────────
    const contadoPorCodigo = useMemo(() => {
        const mapa: Record<string, number> = {};
        lineas.forEach(l => { mapa[l.code] = l.cantidad; });
        return mapa;
    }, [lineas]);

    const grupos = useMemo(() => CLASES.map(clase => {
        const filas = products
            .filter(p => p.type === clase)
            .sort(porTalle)
            .map(p => {
                const antes = p.stock ?? 0;
                const contado = contadoPorCodigo[p.code] ?? 0;
                return { producto: p, antes, contado, diferencia: contado - antes };
            });
        return {
            clase,
            // Primero lo que cambia: es lo que hay que mirar.
            filas: [...filas].sort((a, b) => (a.diferencia === 0 ? 1 : 0) - (b.diferencia === 0 ? 1 : 0)),
            hay: filas.length > 0,
            tieneStock: filas.some(f => f.antes > 0),
            todoEnCero: filas.every(f => f.contado === 0),
            omitido: respuestas[clase] === 'no-conte',
        };
    }), [products, contadoPorCodigo, respuestas]);

    const tiposOmitidos = grupos.filter(g => g.omitido).map(g => g.clase);
    const activos = grupos.filter(g => g.hay && !g.omitido);
    /** Los tipos que van a quedar enteros en 0 y hoy tienen stock: hay que preguntar. */
    const porPreguntar = grupos.filter(g => g.hay && g.todoEnCero && g.tieneStock && !respuestas[g.clase]);
    const quedanEnCero = activos.flatMap(g => g.filas.filter(f => f.contado === 0 && f.antes > 0));
    const todoOmitido = grupos.filter(g => g.hay).every(g => g.omitido);

    const totales = useMemo(() => {
        const filas = activos.flatMap(g => g.filas);
        return {
            ingresos: filas.filter(f => f.diferencia > 0).reduce((n, f) => n + f.diferencia, 0),
            faltantes: filas.filter(f => f.diferencia < 0).reduce((n, f) => n - f.diferencia, 0),
            sinCambios: filas.filter(f => f.diferencia === 0).length,
        };
    }, [activos]);

    /** Nada contado y algo que perder: hace falta decir que sí a propósito. */
    const dejaTodoEnCero = activos.length > 0 && activos.every(g => g.todoEnCero) && activos.some(g => g.tieneStock);
    const puedeEnviar = !todoOmitido
        && porPreguntar.length === 0
        && (!dejaTodoEnCero || confirmoTodoEnCero)
        && estadoEnvio === 'cerrado';

    const abrirRevision = async () => {
        setRespuestas({});
        setConfirmoTodoEnCero(false);
        setIdReporte(safeUUID());
        setTotalesEnviados(null);
        setRevisando(true);
        // El "antes" se compara contra lo último que hay, no contra lo que
        // estaba cargado cuando se abrió la pantalla.
        setRefrescando(true);
        try { await refreshData(); } finally { setRefrescando(false); }
    };

    const enviar = async () => {
        if (!idReporte) return;
        const conteo: ConteoDeProducto[] = lineas
            .filter(l => {
                const p = porCodigo[l.code];
                return p && !tiposOmitidos.includes(p.type);
            })
            .map(l => ({ code: l.code, cantidad: l.cantidad }));

        setEstadoEnvio('guardando');
        const r = await registrarReporteStock({ id: idReporte, conteo, tiposOmitidos });

        // Sin strictNullChecks, `if (!r.ok)` no angosta el tipo: se pregunta
        // por la propiedad, igual que en la carga de varios movimientos.
        if ('motivo' in r) {
            setMensajeError(
                r.motivo === 'sin_permiso' ? 'No tenés permiso para reportar el stock.'
                    : r.motivo === 'conteo_invalido' ? (r.detalle || 'Revisá las cantidades y probá de nuevo.')
                        : 'Se cortó la conexión. Tu conteo sigue acá: probá de nuevo.',
            );
            setEstadoEnvio('error');
            return;
        }

        setTotalesEnviados(r.totales);
        registrarEnBitacora(
            'Reportar Stock',
            `${conteo.length} talles contados · ${totales.ingresos} ingresos · ${totales.faltantes} faltantes`
            + (tiposOmitidos.length ? ` · sin contar: ${tiposOmitidos.join(', ')}` : ''),
        );

        try { sessionStorage.removeItem(BORRADOR); } catch { /* ya está */ }
        setLineas([]);
        setEstadoEnvio('listo');
        await refreshData();
        if (r.repetido) showNotification('Ese reporte ya estaba cargado.');
    };

    const terminar = () => {
        setEstadoEnvio('cerrado');
        setRevisando(false);
        navigate('/punto-de-informacion?view=MOVEMENTS');
    };

    // Después del tilde, la pantalla sigue sola.
    useEffect(() => {
        if (estadoEnvio !== 'listo') return;
        const t = setTimeout(terminar, 1200);
        return () => clearTimeout(t);
    }, [estadoEnvio]);

    return (
        <div id="punto-lote" className="min-h-screen bg-slate-50">
            <div className="w-full max-w-4xl mx-auto p-4 md:p-8 pb-36">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=PANEL')}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Punto de Información
                </button>

                <h1 className="text-[26px] font-bold tracking-tight text-black leading-none">Reportar stock</h1>
                <p className="text-sm text-slate-500 leading-relaxed mt-2 max-w-prose">
                    Anotá lo que hay de cada talle. Lo que no anotes cuenta como 0.
                </p>

                {isLoading && !hayInventario && (
                    <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Cargando inventario</span>
                    </div>
                )}

                {!isLoading && !hayInventario && (
                    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white border border-dashed border-slate-300 rounded-xl mt-6">
                        <PackageOpen className="w-12 h-12 text-slate-300 mb-3" />
                        <h2 className="text-lg font-bold tracking-tight text-black">Todavía no hay productos</h2>
                        <p className="text-sm text-slate-500 leading-relaxed mt-1.5 mb-6 max-w-xs">
                            Creá una remera o un buzo y después volvé a contar.
                        </p>
                        <button
                            onClick={() => navigate('/punto-de-informacion?view=NEW_PRODUCT')}
                            className="px-5 py-3.5 bg-black text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all"
                        >
                            Crear producto
                        </button>
                    </div>
                )}

                {hayInventario && (
                    <div className="mt-6">
                        <SelectorDeTalle
                            productos={products}
                            yaEnLaLista={lineas.map(l => l.code)}
                            abierta={abierta}
                            onAbrir={setAbierta}
                            onAgregar={code => setLineas(prev => (
                                prev.some(l => l.code === code) ? prev : [...prev, { code, cantidad: 1 }]
                            ))}
                        />
                    </div>
                )}

                {enOrden.length > 0 && (
                    <ul className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-0 md:rounded-none md:shadow-none md:overflow-visible md:divide-y-0 md:grid md:grid-cols-2 md:items-start md:gap-4">
                        {enOrden.map(linea => porCodigo[linea.code] && (
                            <FichaDeConteo
                                key={linea.code}
                                producto={porCodigo[linea.code]}
                                cantidad={linea.cantidad}
                                onCantidad={cantidad => setLineas(prev => prev.map(l => (l.code === linea.code ? { ...l, cantidad } : l)))}
                                onQuitar={() => {
                                    setLineas(prev => prev.filter(l => l.code !== linea.code));
                                    setAbierta(null);
                                }}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* La barra de abajo, igual que en movimientos: por un portal, que
                el contenedor de la app tiene un transform y rompe los fixed. */}
            {createPortal(
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)]">
                    <div className="w-full max-w-4xl mx-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-bold tracking-tight text-black leading-tight tabular-nums">
                                {lineas.length === 0 ? 'Ningún talle anotado' : (
                                    `${lineas.length === 1 ? '1 talle anotado' : `${lineas.length} talles anotados`} · ${unidades === 1 ? '1 unidad' : `${unidades} unidades`}`
                                )}
                            </p>
                            {lineas.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setLineas([]); setAbierta(null); }}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-400 hover:text-red-600 transition-colors mt-0.5"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Vaciar
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={abrirRevision}
                            disabled={!hayInventario}
                            className="shrink-0 px-6 py-3.5 bg-black text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:bg-black disabled:active:scale-100"
                        >
                            Revisar
                        </button>
                    </div>
                </div>,
                document.body,
            )}

            {/* ── Revisar: hoja desde abajo en el teléfono, modal en la compu ── */}
            {createPortal(
                <AnimatePresence>
                    {revisando && (
                        <motion.div
                            className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/50"
                            initial={sinMovimiento ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={sinMovimiento ? { opacity: 0 } : { opacity: 0 }}
                            onClick={() => { if (estadoEnvio === 'cerrado') setRevisando(false); }}
                        >
                            <motion.div
                                role="dialog"
                                aria-modal="true"
                                aria-label="Revisar el reporte"
                                onClick={e => e.stopPropagation()}
                                className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl shadow-xl max-h-[92vh] md:max-h-[88vh] flex flex-col"
                                initial={sinMovimiento ? false : { y: 24, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={sinMovimiento ? { opacity: 0 } : { y: 24, opacity: 0 }}
                                transition={{ duration: sinMovimiento ? 0 : 0.2, ease: 'easeOut' }}
                            >
                                <header className="contenido-del-overlay shrink-0 px-5 pt-4 pb-3 border-b border-slate-100">
                                    <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mb-3 md:hidden" />
                                    <h2 className="text-[19px] font-bold tracking-tight text-black">Revisá el reporte</h2>
                                    <p className="text-[13px] text-slate-500 mt-1">
                                        Así va a quedar el inventario cuando lo envíes.
                                    </p>
                                </header>

                                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
                                    {refrescando ? (
                                        <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span className="text-sm font-medium">Buscando el stock de ahora</span>
                                        </div>
                                    ) : (
                                        <>
                                            {grupos.filter(g => g.hay).map(g => (
                                                <section key={g.clase}>
                                                    <h3 className="text-[13px] font-semibold text-slate-500 mb-2">{g.clase}</h3>

                                                    {g.omitido ? (
                                                        <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500">
                                                            No se cuenta en este reporte.
                                                        </p>
                                                    ) : (
                                                        <ul className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                                                            {g.filas.map(f => (
                                                                <li key={f.producto.code} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                                                                    <span className="w-16 shrink-0 font-semibold text-black">Talle {f.producto.size}</span>
                                                                    <span className="flex-1 tabular-nums text-slate-500">
                                                                        {f.antes} <span className="text-slate-300">→</span>{' '}
                                                                        <span className="font-semibold text-black">{f.contado}</span>
                                                                    </span>
                                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${f.diferencia > 0 ? 'bg-emerald-50 text-emerald-700'
                                                                        : f.diferencia < 0 ? 'bg-amber-50 text-amber-700'
                                                                            : 'bg-slate-100 text-slate-400'
                                                                        }`}>
                                                                        {f.diferencia > 0 ? `+${f.diferencia}` : f.diferencia < 0 ? `−${-f.diferencia}` : '='}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </section>
                                            ))}

                                            {/* La pregunta que evita el accidente: un tipo entero en 0
                                                casi siempre es "no lo conté", no "no hay ninguno". */}
                                            {porPreguntar.map(g => (
                                                <div key={g.clase} className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                                                    <p className="text-sm font-semibold text-amber-900">
                                                        ¿No hay ningún {g.clase === ProductType.REMERA ? 'remera' : 'buzo'}, o no los contaste?
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setRespuestas(r => ({ ...r, [g.clase]: 'hay-ninguno' }))}
                                                            className="h-11 rounded-full bg-white border border-amber-300 text-[13px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                                                        >
                                                            No hay ninguno
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setRespuestas(r => ({ ...r, [g.clase]: 'no-conte' }))}
                                                            className="h-11 rounded-full bg-amber-900 text-white text-[13px] font-semibold hover:bg-amber-800 transition-colors"
                                                        >
                                                            No los conté
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {quedanEnCero.length > 0 && (
                                                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
                                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
                                                    <p className="text-[13px] leading-relaxed text-amber-900">
                                                        <span className="font-semibold">Quedan en 0:</span>{' '}
                                                        {quedanEnCero.map(f => `${enMinusculas(f.producto)} (tenía ${f.antes})`).join(', ')}.
                                                    </p>
                                                </div>
                                            )}

                                            {dejaTodoEnCero && (
                                                <label className="rounded-xl bg-red-50 border border-red-200 p-4 flex gap-3 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={confirmoTodoEnCero}
                                                        onChange={e => setConfirmoTodoEnCero(e.target.checked)}
                                                        className="mt-0.5 w-4 h-4 shrink-0 accent-red-700"
                                                    />
                                                    <span className="text-[13px] leading-relaxed text-red-900">
                                                        <span className="font-semibold">Vas a dejar todo el inventario en 0.</span>{' '}
                                                        Marcá esta casilla si es así.
                                                    </span>
                                                </label>
                                            )}

                                            {todoOmitido && (
                                                <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500">
                                                    No queda nada para reportar: dijiste que no contaste ninguno de los dos.
                                                </p>
                                            )}

                                            <p className="text-[13px] text-slate-500 tabular-nums">
                                                {totales.ingresos} ingresos · {totales.faltantes} faltantes · {totales.sinCambios} sin cambios
                                            </p>
                                        </>
                                    )}
                                </div>

                                <footer className="shrink-0 px-5 py-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRevisando(false)}
                                        className="h-12 rounded-full bg-slate-100 text-black text-sm font-semibold hover:bg-slate-200 active:scale-[0.99] transition-all"
                                    >
                                        Volver a contar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={enviar}
                                        disabled={!puedeEnviar || refrescando}
                                        className="h-12 rounded-full bg-black text-white text-sm font-semibold hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:bg-black disabled:active:scale-100"
                                    >
                                        Enviar reporte
                                    </button>
                                </footer>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body,
            )}

            <PanelGuardado
                estado={estadoEnvio}
                titulo="Reporte enviado"
                textoGuardando="Enviando el reporte…"
                detalle={`${(totalesEnviados || totales).ingresos} ingresos · ${(totalesEnviados || totales).faltantes} faltantes`}
                mensajeError={mensajeError}
                onReintentar={enviar}
                onCerrar={() => (estadoEnvio === 'listo' ? terminar() : setEstadoEnvio('cerrado'))}
            />
        </div>
    );
};

/**
 * Mismo envoltorio y mismo portero que las otras páginas sueltas del Punto:
 * se llega por link, sin pasar por el panel, así que el permiso del panel no
 * la cubre. Mientras el perfil está en camino no se decide nada.
 */
const PaginaReportarStock: React.FC = () => {
    const { user, isLoadingSession, isLoadingProfile } = useAuth();

    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Cargando</span>
            </div>
        );
    }
    if (!puedeEntrarAlPunto(user)) return <SinAcceso />;

    return (
        <AppProvider currentUser={user}>
            <ReportarStockContent />
        </AppProvider>
    );
};

export default PaginaReportarStock;
