import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { MovementType, ProductType, InfoPointProduct, Movement } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { ArrowLeft, Loader2, PackageOpen, Minus, Plus, Trash2, ChevronDown, Check } from 'lucide-react';

/**
 * Cargar varios movimientos de una vez.
 *
 * Quien la usa está parado detrás del mostrador después de una reunión, con el
 * teléfono en una mano y una pila de remeras en la otra. Por eso la pantalla ES
 * el inventario: no se busca un producto y después se lo agrega a una lista
 * —dos pasos—, se recorre lo que hay y se toca lo que se movió. El mismo toque
 * que dice "esta cambió" dice también qué le pasó.
 *
 * El alta de a uno (PaginaNuevoMovimiento) queda como está: sigue siendo el
 * camino corto cuando es un solo talle.
 */

type MedioDePago = 'Efectivo' | 'Mercado Pago';

/** Lo que se le cargó a un producto en esta vuelta. */
interface Linea {
    tipo: MovementType;
    cantidad: number;
    /** Sólo en las salidas: cada venta se cobra como se cobra. */
    pago?: MedioDePago;
}

/**
 * Los límites de cada tipo, que son la regla de la casa:
 *
 *   · Entrada suma: desde 1 para arriba.
 *   · Salida sólo descuenta: se escribe en negativo, desde -1 para abajo, y
 *     nunca más de lo que hay en stock.
 *   · Ajuste no suma ni resta: deja el stock EN ese número, y el 0 es "no queda
 *     ninguna". Arranca en lo que el sistema cree tener, así que cualquier
 *     cambio es a propósito.
 */
const limites = (tipo: MovementType, stock: number) => {
    if (tipo === MovementType.IN) return { min: 1, max: 9999, inicial: 1 };
    if (tipo === MovementType.OUT) return { min: -Math.max(stock, 1), max: -1, inicial: -1 };
    return { min: 0, max: 9999, inicial: stock };
};

/** Cómo queda el stock si se guarda esta línea. */
const stockResultante = (stock: number, linea: Linea): number => {
    if (linea.tipo === MovementType.IN) return stock + linea.cantidad;
    // En una salida la cantidad ya viene en negativo.
    if (linea.tipo === MovementType.OUT) return Math.max(0, stock + linea.cantidad);
    return linea.cantidad;
};

/**
 * Verde entra, rojo sale, ámbar corrige: los mismos tres colores que usan los
 * iconos del historial, para que signifiquen lo mismo en todo el módulo.
 */
const COLORES: Record<string, { relleno: string; marco: string; texto: string }> = {
    [MovementType.IN]: { relleno: 'bg-emerald-600', marco: 'border-emerald-500', texto: 'text-emerald-700' },
    [MovementType.OUT]: { relleno: 'bg-red-600', marco: 'border-red-500', texto: 'text-red-700' },
    [MovementType.ADJUST]: { relleno: 'bg-amber-500', marco: 'border-amber-500', texto: 'text-amber-700' },
};

const TIPOS = [MovementType.IN, MovementType.OUT, MovementType.ADJUST];
const PAGOS: MedioDePago[] = ['Efectivo', 'Mercado Pago'];

/**
 * El selector de acción: una sola píldora que se despliega.
 *
 * Cerrada dice que falta elegir; abierta muestra las tres acciones, cada una
 * con el punto de su color. Ya elegida, la píldora se llena con ese color, así
 * la lista entera se lee de un vistazo: verde entra, rojo sale, ámbar corrige.
 *
 * Se despliega hacia abajo empujando la ficha, no flotando por encima: la
 * lista del teléfono recorta lo que se salga, y un menú flotante cerca del
 * borde de la pantalla se va de cuadro.
 */
const SelectorDeAccion: React.FC<{
    producto: InfoPointProduct;
    tipo: MovementType | null;
    agotado: boolean;
    abierto: boolean;
    onAbrir: (abierto: boolean) => void;
    onElegir: (tipo: MovementType) => void;
    onQuitar: () => void;
}> = ({ producto, tipo, agotado, abierto, onAbrir, onElegir, onQuitar }) => {
    const sinMovimiento = useReducedMotion();
    const color = tipo ? COLORES[tipo] : null;

    return (
        <div onKeyDown={e => { if (e.key === 'Escape') onAbrir(false); }}>
            <button
                type="button"
                aria-expanded={abierto}
                aria-haspopup="true"
                onClick={() => onAbrir(!abierto)}
                className={`w-full h-12 px-4 flex items-center justify-between gap-2 rounded-xl border text-xs font-bold uppercase tracking-tight transition-colors ${color
                    ? `${color.relleno} border-transparent text-white`
                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300'
                    }`}
            >
                <span className="truncate">{tipo || 'Seleccione una acción'}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
                {abierto && (
                    <motion.div
                        initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={sinMovimiento ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: sinMovimiento ? 0 : 0.18, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        <div
                            role="group"
                            aria-label={`Acciones para ${producto.name}`}
                            className="mt-1.5 rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100"
                        >
                            {TIPOS.map(t => {
                                const bloqueada = t === MovementType.OUT && agotado;
                                const elegida = tipo === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        disabled={bloqueada}
                                        aria-pressed={elegida}
                                        onClick={() => onElegir(t)}
                                        className={`w-full h-12 px-4 flex items-center gap-3 text-left text-xs font-bold uppercase tracking-tight transition-colors ${bloqueada
                                            ? 'text-slate-300 cursor-not-allowed'
                                            : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                    >
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${COLORES[t].relleno} ${bloqueada ? 'opacity-25' : ''}`} />
                                        <span className="flex-1 truncate">{t}</span>
                                        {bloqueada && (
                                            <span className="shrink-0 text-[10px] font-medium normal-case tracking-normal text-slate-400">
                                                Sin stock para descontar
                                            </span>
                                        )}
                                        {elegida && <Check className="w-4 h-4 shrink-0 text-slate-400" />}
                                    </button>
                                );
                            })}

                            {/* La salida de emergencia de un toque mal dado. */}
                            {tipo && (
                                <button
                                    type="button"
                                    onClick={onQuitar}
                                    className="w-full h-12 px-4 flex items-center gap-3 text-left text-xs font-bold uppercase tracking-tight text-slate-400 hover:text-red-600 hover:bg-slate-50 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                    Quitar de la carga
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface Opcion {
    valor: string;
    /** Clases del bloque lleno cuando esta opción está elegida. */
    relleno: string;
    bloqueada?: boolean;
}

/**
 * Una barra de estado: varias respuestas en una sola pieza, con la elegida
 * llena de color.
 *
 * No son botones sueltos, a propósito. Tres botones dicen "tres cosas que
 * podés hacer"; una barra dice "una sola decisión, elegí cuál", que es lo que
 * de verdad es. Las separaciones van por debajo del relleno, así la barra se
 * lee como un objeto entero y no como botones pegados.
 */
const BarraDeEstado: React.FC<{
    opciones: Opcion[];
    valor: string | null;
    onElegir: (valor: string) => void;
    /** Único por barra: es lo que hace que el relleno se deslice. */
    idGrupo: string;
    etiqueta: string;
    compacta?: boolean;
}> = ({ opciones, valor, onElegir, idGrupo, etiqueta, compacta }) => {
    const sinMovimiento = useReducedMotion();

    return (
        <div
            role="group"
            aria-label={etiqueta}
            className={`relative grid rounded-xl border border-slate-200 bg-slate-50 overflow-hidden ${compacta ? 'h-10' : 'h-12'}`}
            style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
        >
            {opciones.slice(1).map((o, i) => (
                <span
                    key={`sep-${o.valor}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-2 w-px bg-slate-200"
                    style={{ left: `${((i + 1) / opciones.length) * 100}%` }}
                />
            ))}

            {opciones.map(o => {
                const elegida = valor === o.valor;
                return (
                    <button
                        key={o.valor}
                        type="button"
                        disabled={o.bloqueada}
                        aria-pressed={elegida}
                        onClick={() => onElegir(o.valor)}
                        className={`relative h-full px-1 text-xs font-bold uppercase tracking-tight transition-colors ${elegida
                            ? 'text-white'
                            : o.bloqueada
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                    >
                        {elegida && (
                            <motion.span
                                layoutId={`barra-${idGrupo}`}
                                aria-hidden="true"
                                className={`absolute inset-0 ${o.relleno}`}
                                transition={sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
                            />
                        )}
                        <span className="relative z-10">{o.valor}</span>
                    </button>
                );
            })}
        </div>
    );
};

// ── Una ficha del inventario ────────────────────────────────────────────
const FilaProducto: React.FC<{
    producto: InfoPointProduct;
    linea?: Linea;
    abierto: boolean;
    onAbrir: (abierto: boolean) => void;
    onTipo: (tipo: MovementType) => void;
    onCantidad: (cantidad: number) => void;
    onPago: (pago: MedioDePago) => void;
    onQuitar: () => void;
}> = ({ producto, linea, abierto, onAbrir, onTipo, onCantidad, onPago, onQuitar }) => {
    const sinMovimiento = useReducedMotion();
    const stock = producto.stock ?? 0;
    const agotado = stock <= 0;
    const lim = linea ? limites(linea.tipo, stock) : null;
    const queda = linea ? stockResultante(stock, linea) : stock;
    const color = linea ? COLORES[linea.tipo] : null;
    const esSalida = linea && linea.tipo === MovementType.OUT;

    // El signo lo pone el tipo, no el dedo: en una salida alcanza con teclear
    // el número y sale en negativo solo.
    const alEscribir = (texto: string) => {
        const n = parseInt(texto.replace(/[^0-9]/g, ''), 10);
        if (Number.isNaN(n)) return;
        onCantidad(linea.tipo === MovementType.OUT ? -n : n);
    };

    const acomodar = () => {
        if (!linea || !lim) return;
        onCantidad(Math.min(lim.max, Math.max(lim.min, linea.cantidad)));
    };

    return (
        <li
            aria-label={producto.name}
            className={`p-4 bg-white transition-colors md:rounded-xl md:border ${color ? `${color.marco} md:border-2` : 'md:border-slate-200'}`}
        >
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-black text-sm uppercase tracking-tight text-slate-900 truncate">{producto.type}</h3>
                    <span className="shrink-0 text-[10px] text-slate-500 font-bold uppercase tracking-wide bg-slate-100 px-1.5 py-px rounded border border-slate-200">
                        Talle {producto.size}
                    </span>
                </div>
                <p className="shrink-0 text-right">
                    <span className="font-mono tabular-nums font-black text-base text-slate-900">{stock}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1.5">en stock</span>
                </p>
            </div>

            <SelectorDeAccion
                producto={producto}
                tipo={linea ? linea.tipo : null}
                agotado={agotado}
                abierto={abierto}
                onAbrir={onAbrir}
                onElegir={onTipo}
                onQuitar={onQuitar}
            />

            <AnimatePresence initial={false}>
                {linea && lim && (
                    <motion.div
                        initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={sinMovimiento ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: sinMovimiento ? 0 : 0.18, ease: 'easeOut' }}
                        className="overflow-hidden"
                    >
                        {/* El contador ocupa todo el ancho: el número es lo que
                            más se mira y lo que más se equivoca. */}
                        <div className="flex items-stretch h-12 w-full mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
                            <button
                                type="button"
                                onClick={() => onCantidad(Math.max(lim.min, linea.cantidad - 1))}
                                disabled={linea.cantidad <= lim.min}
                                aria-label={`Uno menos en ${producto.name}`}
                                className="w-14 shrink-0 flex items-center justify-center border-r border-slate-200 text-slate-600 hover:bg-slate-50 disabled:text-slate-200 disabled:hover:bg-transparent transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <input
                                type="number"
                                inputMode="numeric"
                                value={linea.cantidad}
                                min={lim.min}
                                max={lim.max}
                                onChange={e => alEscribir(e.target.value)}
                                onBlur={acomodar}
                                aria-label={`Cantidad para ${producto.name}`}
                                className="flex-1 min-w-0 h-full text-center font-mono tabular-nums text-2xl font-black"
                            />
                            <button
                                type="button"
                                onClick={() => onCantidad(Math.min(lim.max, linea.cantidad + 1))}
                                disabled={linea.cantidad >= lim.max}
                                aria-label={`Uno más en ${producto.name}`}
                                className="w-14 shrink-0 flex items-center justify-center border-l border-slate-200 text-slate-600 hover:bg-slate-50 disabled:text-slate-200 disabled:hover:bg-transparent transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* La consecuencia no es un dato más que cargar: va
                            chica, abajo y sin marco. */}
                        <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
                            Queda en <span className={`font-bold ${color ? color.texto : ''}`}>{queda}</span>
                            {linea.tipo === MovementType.ADJUST && queda === stock && ', igual que ahora'}
                        </p>

                        {/* Cada venta se cobra como se cobra: el medio de pago
                            viaja con la salida, no con la carga entera. */}
                        {esSalida && (
                            <div className="mt-2">
                                <BarraDeEstado
                                    compacta
                                    idGrupo={`${producto.code}-pago`}
                                    etiqueta={`Cómo pagaron ${producto.name}`}
                                    valor={linea.pago || 'Efectivo'}
                                    onElegir={valor => onPago(valor as MedioDePago)}
                                    opciones={PAGOS.map(p => ({ valor: p, relleno: 'bg-slate-900' }))}
                                />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
};

// ── La pantalla ─────────────────────────────────────────────────────────
const MovimientosVariosContent: React.FC = () => {
    const navigate = useNavigate();
    const { products, addMovements, showNotification, isLoading } = useStore();
    const [lineas, setLineas] = useState<Record<string, Linea>>({});
    const [filtro, setFiltro] = useState<'ALL' | ProductType>('ALL');
    const [guardando, setGuardando] = useState(false);
    // Qué píldora está desplegada. Una sola a la vez: abrir otra cierra la
    // anterior, que es lo que uno espera y evita una pantalla llena de menús.
    const [abierta, setAbierta] = useState<string | null>(null);

    const visibles = useMemo(
        () => products.filter(p => filtro === 'ALL' || p.type === filtro),
        [products, filtro],
    );

    const elegidos = Object.keys(lineas).length;

    const cambiarTipo = (p: InfoPointProduct, tipo: MovementType) => {
        setLineas(prev => {
            // Si ya era ésa, no se pisa la cantidad que venía cargada.
            if (prev[p.code] && prev[p.code].tipo === tipo) return prev;
            return {
                ...prev,
                [p.code]: {
                    tipo,
                    cantidad: limites(tipo, p.stock ?? 0).inicial,
                    // Casi siempre pagan en efectivo: queda elegido y se
                    // cambia sólo cuando no fue así.
                    pago: tipo === MovementType.OUT ? 'Efectivo' : undefined,
                },
            };
        });
        setAbierta(null);
    };

    const quitar = (code: string) => {
        setLineas(prev => {
            const copia = { ...prev };
            delete copia[code];
            return copia;
        });
        setAbierta(null);
    };

    const cambiarCantidad = (code: string, cantidad: number) => {
        setLineas(prev => (prev[code] ? { ...prev, [code]: { ...prev[code], cantidad } } : prev));
    };

    const cambiarPago = (code: string, pago: MedioDePago) => {
        setLineas(prev => (prev[code] ? { ...prev, [code]: { ...prev[code], pago } } : prev));
    };

    const guardar = async () => {
        const movimientos: Movement[] = Object.keys(lineas).map(code => {
            const p = products.find(x => x.code === code);
            const linea = lineas[code];
            return {
                id: safeUUID(),
                productCode: code,
                productName: p ? p.name : code,
                type: linea.tipo,
                // En pantalla una salida se escribe en negativo, porque es lo
                // que hace. En la base todas las cantidades son positivas y el
                // signo lo da el tipo: así las guardó siempre el alta de a uno
                // y así las lee el historial.
                quantity: Math.abs(linea.cantidad),
                date: new Date().toISOString(),
                paymentMethod: linea.tipo === MovementType.OUT ? (linea.pago || 'Efectivo') : undefined,
            };
        });

        setGuardando(true);
        try {
            const resultado = await addMovements(movimientos);

            // Sin strictNullChecks, `if (!resultado.ok)` no angosta el tipo.
            if ('motivo' in resultado && resultado.motivo === 'alta') {
                showNotification('No se pudo guardar la carga. No se tocó ningún stock: probá de nuevo.', 'error');
                return;
            }
            if ('motivo' in resultado) {
                showNotification(
                    `Se guardaron los movimientos, pero el stock de ${resultado.sinStock.join(', ')} quedó sin actualizar. Revisalo en Inventario.`,
                    'error',
                );
                navigate('/punto-de-informacion?view=INVENTORY');
                return;
            }

            showNotification(movimientos.length === 1 ? '1 movimiento guardado' : `${movimientos.length} movimientos guardados`);
            navigate('/punto-de-informacion?view=MOVEMENTS');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div id="punto-lote" className="min-h-screen bg-slate-50 flex flex-col">
            <div className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=MOVEMENTS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Movimientos
                </button>

                <h1 className="font-black text-xl text-slate-900 uppercase tracking-tight">Varios productos</h1>
                <p className="text-sm font-medium text-slate-500 mt-1.5 max-w-prose">
                    Tocá qué pasó con cada talle que se movió. Se guardan todos juntos.
                </p>

                {products.length > 0 && (
                    <div className="flex gap-2 mt-6 mb-4">
                        {([['ALL', 'Todo'], [ProductType.REMERA, 'Remeras'], [ProductType.BUZO, 'Buzos']] as const).map(([valor, etiqueta]) => (
                            <button
                                key={valor}
                                type="button"
                                onClick={() => setFiltro(valor as 'ALL' | ProductType)}
                                aria-pressed={filtro === valor}
                                className={`min-h-[40px] px-4 text-xs font-bold uppercase tracking-widest rounded-lg border transition-colors ${filtro === valor
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                {etiqueta}
                            </button>
                        ))}
                    </div>
                )}

                {isLoading && products.length === 0 && (
                    <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-bold uppercase tracking-widest">Cargando inventario</span>
                    </div>
                )}

                {!isLoading && products.length === 0 && (
                    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white border border-dashed border-slate-300 rounded-xl mt-6">
                        <PackageOpen className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Todavía no hay productos</p>
                        <p className="text-sm font-medium text-slate-500 mt-2 mb-5">Creá una remera o un buzo y después volvé a cargar el movimiento.</p>
                        <button
                            onClick={() => navigate('/punto-de-informacion?view=NEW_PRODUCT')}
                            className="px-5 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            Crear producto
                        </button>
                    </div>
                )}

                {/* En el teléfono es una lista corrida; en pantalla grande, dos
                    columnas de fichas. */}
                {visibles.length > 0 && (
                    <ul className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-0 md:rounded-none md:shadow-none md:overflow-visible md:divide-y-0 md:grid md:grid-cols-2 md:items-start md:gap-4">
                        {visibles.map(p => (
                            <FilaProducto
                                key={p.code}
                                producto={p}
                                linea={lineas[p.code]}
                                abierto={abierta === p.code}
                                onAbrir={abrir => setAbierta(abrir ? p.code : null)}
                                onTipo={tipo => cambiarTipo(p, tipo)}
                                onCantidad={cantidad => cambiarCantidad(p.code, cantidad)}
                                onPago={pago => cambiarPago(p.code, pago)}
                                onQuitar={() => quitar(p.code)}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* La barra queda al alcance del pulgar y no tapa la última ficha:
                vive en el flujo, pegada abajo. */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)]">
                <div className="w-full max-w-4xl mx-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black uppercase tracking-tight text-slate-900 leading-tight">
                            {elegidos === 0 ? 'Ningún producto' : elegidos === 1 ? '1 producto' : `${elegidos} productos`}
                        </p>
                        {elegidos > 0 && (
                            <button
                                type="button"
                                onClick={() => { setLineas({}); setAbierta(null); }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors mt-0.5"
                            >
                                <Trash2 className="w-3 h-3" />
                                Vaciar
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={guardar}
                        disabled={elegidos === 0 || guardando}
                        className="shrink-0 px-6 py-3.5 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-black flex items-center justify-center gap-2"
                    >
                        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

// Mismo envoltorio que PaginaNuevoMovimiento: esta ruta es suelta y no hereda
// el Provider del panel.
const PaginaMovimientosVarios: React.FC = () => {
    const { user } = useAuth();
    return (
        <AppProvider currentUser={user}>
            <MovimientosVariosContent />
        </AppProvider>
    );
};

export default PaginaMovimientosVarios;
