import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { MovementType, ProductType, InfoPointProduct, Movement } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { puedeEntrarAlPunto } from '../../services/authUtils';
import { ArrowLeft, Loader2, PackageOpen, Minus, Plus, Trash2, ChevronDown, Check, X } from 'lucide-react';

/**
 * Nuevo movimiento: agregar, descontar o corregir el stock del Punto.
 *
 * Quien la usa está parado detrás del mostrador después de una reunión, con el
 * teléfono en una mano y una pila de remeras en la otra. Arma la lista de lo
 * que se movió —un talle por vez, como salen de la pila—, dice qué pasó con
 * cada uno, y guarda todo junto.
 *
 * La pantalla arranca vacía a propósito: antes mostraba el inventario entero y
 * había que buscar la ficha entre veinte. Ahora entra sólo lo que se agrega.
 */

type MedioDePago = 'Efectivo' | 'Mercado Pago';

/** Un producto agregado a esta carga. Sin `tipo` = agregado pero sin acción. */
interface Linea {
    code: string;
    tipo?: MovementType;
    cantidad: number;
    /** Sólo en las salidas: cada venta se cobra como se cobra. */
    pago?: MedioDePago;
}

/**
 * Los límites de cada acción, que son la regla de la casa:
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

const TIPOS = [MovementType.IN, MovementType.OUT, MovementType.ADJUST];
const PAGOS: MedioDePago[] = ['Efectivo', 'Mercado Pago'];
const CLASES = [ProductType.REMERA, ProductType.BUZO];

/**
 * Remeras antes que buzos, y adentro de cada uno del talle 1 al más alto.
 * El talle es texto en la base ('1'…'10'), así que se compara como número: si
 * no, el 10 queda entre el 1 y el 2.
 */
const porTalle = (a: InfoPointProduct, b: InfoPointProduct) => {
    const clase = CLASES.indexOf(a.type) - CLASES.indexOf(b.type);
    if (clase !== 0) return clase;
    return (parseInt(a.size, 10) || 0) - (parseInt(b.size, 10) || 0);
};

// ── Una píldora que se despliega ────────────────────────────────────────
interface Opcion {
    valor: string;
    etiqueta?: string;
    /** Aclaración chica a la derecha: el stock, o por qué no se puede. */
    nota?: string;
    bloqueada?: boolean;
}

/**
 * Cerrada dice qué falta elegir; abierta muestra las opciones. Es siempre
 * blanca: lo que cambia al elegir es el texto, que pasa de gris claro —una
 * indicación, no un dato— a negro, igual que un campo cuando se completa.
 *
 * Se despliega hacia abajo empujando lo que sigue, no flotando por encima: la
 * lista del teléfono recorta lo que se salga, y un menú flotante cerca del
 * borde de la pantalla se va de cuadro.
 */
const Desplegable: React.FC<{
    valor: string | null;
    vacio: string;
    opciones: Opcion[];
    abierto: boolean;
    onAbrir: (abierto: boolean) => void;
    onElegir: (valor: string) => void;
    etiqueta: string;
}> = ({ valor, vacio, opciones, abierto, onAbrir, onElegir, etiqueta }) => {
    const sinMovimiento = useReducedMotion();
    const elegida = opciones.find(o => o.valor === valor);

    return (
        <div onKeyDown={e => { if (e.key === 'Escape') onAbrir(false); }}>
            <button
                type="button"
                aria-expanded={abierto}
                aria-haspopup="true"
                onClick={() => onAbrir(!abierto)}
                className={`w-full h-12 px-4 flex items-center justify-between gap-2 rounded-xl border bg-white text-xs font-bold uppercase tracking-tight transition-colors ${valor
                    ? 'border-slate-300 text-slate-900'
                    : 'border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300'
                    }`}
            >
                <span className="truncate">{elegida ? (elegida.etiqueta || elegida.valor) : vacio}</span>
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
                            aria-label={etiqueta}
                            className="mt-1.5 rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100"
                        >
                            {opciones.length === 0 && (
                                <p className="px-4 py-3 text-[11px] font-medium text-slate-400">No queda nada para elegir.</p>
                            )}
                            {opciones.map(o => (
                                <button
                                    key={o.valor}
                                    type="button"
                                    disabled={o.bloqueada}
                                    aria-pressed={valor === o.valor}
                                    onClick={() => onElegir(o.valor)}
                                    className={`w-full h-12 px-4 flex items-center gap-3 text-left text-xs font-bold uppercase tracking-tight transition-colors ${o.bloqueada
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <span className="flex-1 truncate">{o.etiqueta || o.valor}</span>
                                    {o.nota && (
                                        <span className="shrink-0 text-[10px] font-medium normal-case tracking-normal text-slate-400">
                                            {o.nota}
                                        </span>
                                    )}
                                    {valor === o.valor && <Check className="w-4 h-4 shrink-0 text-slate-400" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Agregar un producto a la carga ──────────────────────────────────────
/**
 * Primero qué es —remera o buzo—, después el talle, y recién ahí se confirma.
 *
 * Los talles que se ofrecen salen del inventario y descuentan lo que ya está
 * en la carga: no se puede agregar dos veces el mismo, ni uno que no existe.
 */
const SelectorDeProducto: React.FC<{
    productos: InfoPointProduct[];
    yaEnLaCarga: string[];
    abierta: string | null;
    onAbrir: (clave: string | null) => void;
    onAgregar: (code: string) => void;
}> = ({ productos, yaEnLaCarga, abierta, onAbrir, onAgregar }) => {
    const sinMovimiento = useReducedMotion();
    const [abiertoElCuadro, setAbiertoElCuadro] = useState(false);
    const [clase, setClase] = useState<ProductType | null>(null);
    const [talle, setTalle] = useState<string | null>(null);

    const disponibles = productos.filter(p => !yaEnLaCarga.includes(p.code));
    const clasesConProductos = CLASES.filter(c => disponibles.some(p => p.type === c));
    const talles = disponibles.filter(p => p.type === clase).sort(porTalle);
    const elegido = talles.find(p => p.size === talle);
    const listo = !!clase && !!elegido;

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
                className="w-full h-14 px-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-900 hover:bg-slate-50 transition-colors"
            >
                <Plus className={`w-4 h-4 shrink-0 transition-transform duration-200 ${abiertoElCuadro ? 'rotate-45' : ''}`} />
                Seleccionar producto
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
                                    nota: `${p.stock ?? 0} en stock`,
                                }))}
                                abierto={abierta === 'nuevo-talle'}
                                onAbrir={a => onAbrir(a ? 'nuevo-talle' : null)}
                                onElegir={v => { setTalle(v); onAbrir(null); }}
                            />

                            {/* No se habilita hasta que estén las dos cosas. */}
                            <button
                                type="button"
                                disabled={!listo}
                                onClick={() => { if (elegido) { onAgregar(elegido.code); cerrarTodo(); } }}
                                className="w-full h-12 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-black"
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

// ── Una ficha de la carga ───────────────────────────────────────────────
const FichaProducto: React.FC<{
    producto: InfoPointProduct;
    linea: Linea;
    abierta: string | null;
    onAbrir: (clave: string | null) => void;
    onTipo: (tipo: MovementType) => void;
    onCantidad: (cantidad: number) => void;
    onPago: (pago: MedioDePago) => void;
    onQuitar: () => void;
}> = ({ producto, linea, abierta, onAbrir, onTipo, onCantidad, onPago, onQuitar }) => {
    const sinMovimiento = useReducedMotion();
    const stock = producto.stock ?? 0;
    const agotado = stock <= 0;
    const lim = linea.tipo ? limites(linea.tipo, stock) : null;
    const queda = linea.tipo ? stockResultante(stock, linea) : stock;
    const esSalida = linea.tipo === MovementType.OUT;

    // El signo lo pone la acción, no el dedo: en una salida alcanza con teclear
    // el número y sale en negativo solo.
    const alEscribir = (texto: string) => {
        const n = parseInt(texto.replace(/[^0-9]/g, ''), 10);
        if (Number.isNaN(n)) return;
        onCantidad(linea.tipo === MovementType.OUT ? -n : n);
    };

    const acomodar = () => {
        if (!lim) return;
        onCantidad(Math.min(lim.max, Math.max(lim.min, linea.cantidad)));
    };

    return (
        <li
            aria-label={producto.name}
            className={`p-4 bg-white transition-colors md:rounded-xl md:border ${linea.tipo ? 'md:border-slate-400' : 'md:border-slate-200'}`}
        >
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-black text-sm uppercase tracking-tight text-slate-900 truncate">{producto.type}</h3>
                    <span className="shrink-0 text-[10px] text-slate-500 font-bold uppercase tracking-wide bg-slate-100 px-1.5 py-px rounded border border-slate-200">
                        Talle {producto.size}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <p className="text-right">
                        <span className="font-mono tabular-nums font-black text-base text-slate-900">{stock}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1.5">en stock</span>
                    </p>
                    <button
                        type="button"
                        onClick={onQuitar}
                        aria-label={`Quitar ${producto.name} de la carga`}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <Desplegable
                etiqueta={`Acciones para ${producto.name}`}
                vacio="Seleccione una acción"
                valor={linea.tipo || null}
                opciones={TIPOS.map(t => ({
                    valor: t,
                    bloqueada: t === MovementType.OUT && agotado,
                    nota: t === MovementType.OUT && agotado ? 'Sin stock para descontar' : undefined,
                }))}
                abierto={abierta === `accion-${producto.code}`}
                onAbrir={a => onAbrir(a ? `accion-${producto.code}` : null)}
                onElegir={v => onTipo(v as MovementType)}
            />

            <AnimatePresence initial={false}>
                {linea.tipo && lim && (
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
                            Queda en <span className="font-bold text-slate-700">{queda}</span>
                            {linea.tipo === MovementType.ADJUST && queda === stock && ', igual que ahora'}
                        </p>

                        {/* Cada venta se cobra como se cobra: el medio de pago
                            viaja con la salida, no con la carga entera. */}
                        {esSalida && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                {PAGOS.map(medio => (
                                    <button
                                        key={medio}
                                        type="button"
                                        onClick={() => onPago(medio)}
                                        aria-pressed={(linea.pago || 'Efectivo') === medio}
                                        className={`h-10 text-xs font-bold uppercase tracking-tight rounded-xl border transition-colors ${(linea.pago || 'Efectivo') === medio
                                            ? 'bg-slate-900 border-slate-900 text-white'
                                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                                            }`}
                                    >
                                        {medio}
                                    </button>
                                ))}
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
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [guardando, setGuardando] = useState(false);
    // Qué desplegable está abierto. Uno solo a la vez: abrir otro cierra el
    // anterior, que es lo que uno espera y evita una pantalla llena de menús.
    const [abierta, setAbierta] = useState<string | null>(null);

    const porCodigo = useMemo(() => {
        const mapa: Record<string, InfoPointProduct> = {};
        products.forEach(p => { mapa[p.code] = p; });
        return mapa;
    }, [products]);

    // Siempre del talle 1 al más alto, sin importar en qué orden se agregaron.
    const enOrden = useMemo(
        () => [...lineas].sort((a, b) => {
            const pa = porCodigo[a.code];
            const pb = porCodigo[b.code];
            if (!pa || !pb) return 0;
            return porTalle(pa, pb);
        }),
        [lineas, porCodigo],
    );

    const conAccion = lineas.filter(l => !!l.tipo);

    const cambiar = (code: string, cambio: Partial<Linea>) => {
        setLineas(prev => prev.map(l => (l.code === code ? { ...l, ...cambio } : l)));
    };

    const elegirTipo = (code: string, tipo: MovementType) => {
        const stock = porCodigo[code] ? (porCodigo[code].stock ?? 0) : 0;
        setLineas(prev => prev.map(l => {
            if (l.code !== code) return l;
            // Si ya era ésa, no se pisa la cantidad que venía cargada.
            if (l.tipo === tipo) return l;
            return {
                ...l,
                tipo,
                cantidad: limites(tipo, stock).inicial,
                // Casi siempre pagan en efectivo: queda elegido y se cambia
                // sólo cuando no fue así.
                pago: tipo === MovementType.OUT ? 'Efectivo' : undefined,
            };
        }));
        setAbierta(null);
    };

    const guardar = async () => {
        const movimientos: Movement[] = conAccion.map(linea => {
            const p = porCodigo[linea.code];
            return {
                id: safeUUID(),
                productCode: linea.code,
                productName: p ? p.name : linea.code,
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

    const hayInventario = products.length > 0;

    return (
        <div id="punto-lote" className="min-h-screen bg-slate-50">
            <div className="w-full max-w-4xl mx-auto p-4 md:p-8 pb-36">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=MOVEMENTS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Movimientos
                </button>

                <h1 className="font-black text-xl text-slate-900 uppercase tracking-tight">Nuevo movimiento</h1>
                <p className="text-sm font-medium text-slate-500 mt-1.5 max-w-prose">
                    Agregá los productos que se movieron y decí qué pasó con cada uno. Se guardan todos juntos.
                </p>

                {isLoading && !hayInventario && (
                    <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-bold uppercase tracking-widest">Cargando inventario</span>
                    </div>
                )}

                {!isLoading && !hayInventario && (
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

                {hayInventario && (
                    <div className="mt-6">
                        <SelectorDeProducto
                            productos={products}
                            yaEnLaCarga={lineas.map(l => l.code)}
                            abierta={abierta}
                            onAbrir={setAbierta}
                            onAgregar={code => setLineas(prev => (
                                prev.some(l => l.code === code) ? prev : [...prev, { code, cantidad: 1 }]
                            ))}
                        />
                    </div>
                )}

                {/* En el teléfono es una lista corrida; en pantalla grande, dos
                    columnas de fichas. */}
                {enOrden.length > 0 && (
                    <ul className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-sm md:bg-transparent md:border-0 md:rounded-none md:shadow-none md:overflow-visible md:divide-y-0 md:grid md:grid-cols-2 md:items-start md:gap-4">
                        {enOrden.map(linea => porCodigo[linea.code] && (
                            <FichaProducto
                                key={linea.code}
                                producto={porCodigo[linea.code]}
                                linea={linea}
                                abierta={abierta}
                                onAbrir={setAbierta}
                                onTipo={tipo => elegirTipo(linea.code, tipo)}
                                onCantidad={cantidad => cambiar(linea.code, { cantidad })}
                                onPago={pago => cambiar(linea.code, { pago })}
                                onQuitar={() => {
                                    setLineas(prev => prev.filter(l => l.code !== linea.code));
                                    setAbierta(null);
                                }}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* De borde a borde y pegada al piso, al alcance del pulgar.
                Va por un portal al body y no adentro de la página: el
                contenedor de la app entra con una animación que le deja un
                transform puesto, y un transform convierte al ancestro en el
                marco de referencia de todo `fixed` que tenga adentro. Media
                página después, la barra aparecía a mitad de camino.
                Afuera, nada puede moverla. */}
            {createPortal(
                <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)]">
                <div className="w-full max-w-4xl mx-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-black uppercase tracking-tight text-slate-900 leading-tight">
                            {conAccion.length === 0 ? 'Ningún producto' : conAccion.length === 1 ? '1 producto' : `${conAccion.length} productos`}
                        </p>
                        {lineas.length > 0 && (
                            <button
                                type="button"
                                onClick={() => { setLineas([]); setAbierta(null); }}
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
                        disabled={conAccion.length === 0 || guardando}
                        className="shrink-0 px-6 py-3.5 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:hover:bg-black flex items-center justify-center gap-2"
                    >
                        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                        Guardar
                    </button>
                </div>
                </div>,
                document.body,
            )}
        </div>
    );
};

// Mismo envoltorio que las otras páginas sueltas del Punto: no heredan el
// Provider del panel.
//
// Y el mismo portero: se llega por link, sin pasar por el panel, así que el
// permiso del panel no la cubre. Mientras el perfil está en camino no se
// decide nada: `user` todavía es null y rebotaría a quien sí tiene permiso.
const PaginaMovimientosVarios: React.FC = () => {
    const { user, isLoadingSession, isLoadingProfile } = useAuth();

    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-bold uppercase tracking-widest">Cargando</span>
            </div>
        );
    }
    if (!puedeEntrarAlPunto(user)) return <Navigate to="/" replace />;

    return (
        <AppProvider currentUser={user}>
            <MovimientosVariosContent />
        </AppProvider>
    );
};

export default PaginaMovimientosVarios;
