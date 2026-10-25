import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store';
import { InfoPointProduct, ProductType } from '../../types';
import { Trash2, Plus, Search, Package, ChevronDown } from 'lucide-react';

/**
 * El inventario del Punto.
 *
 * Es la percha vista desde el mostrador, y la pregunta es siempre la misma:
 * ¿queda talle 2?, ¿qué se está por acabar? Por eso la lista va agrupada por
 * remeras y buzos, del talle 1 al más alto, y lo único que grita es lo que
 * está por terminarse.
 *
 * Antes eran dos pantallas distintas —una tabla en la compu y tarjetas altas
 * con rótulos "PRECIO" y "STOCK" en el teléfono— y los talles salían en el
 * orden en que venían de la base, así que el 10 podía caer entre el 1 y el 2.
 *
 * Los dos grupos arrancan cerrados: con veinte talles cargados, abrir la
 * pantalla y ver dos barras —con cuántas hay de cada cosa— es más rápido que
 * ver veinte filas y buscar. El que necesita el detalle, lo despliega.
 */

const CLASES = [ProductType.REMERA, ProductType.BUZO, ProductType.SERVOLUCION];

/** Del talle 1 al más alto. El talle es texto: se compara como número. */
const porTalle = (a: InfoPointProduct, b: InfoPointProduct) =>
    (parseInt(a.size, 10) || 0) - (parseInt(b.size, 10) || 0);

const precio = (valor: number) => `$${(valor ?? 0).toLocaleString('es-AR')}`;

/**
 * Cómo está un talle. Los tonos son los mismos con los que la app avisa
 * cosas en todas partes: suaves, no alarmas.
 */
const estadoDe = (p: InfoPointProduct) => {
    const stock = p.stock ?? 0;
    if (stock <= 0) return { pastilla: 'bg-red-50 text-red-700', nota: 'Sin stock', notaColor: 'text-red-600' };
    if (stock <= (p.minStock ?? 0)) return { pastilla: 'bg-amber-50 text-amber-700', nota: 'Quedan pocos', notaColor: 'text-amber-600' };
    return { pastilla: 'bg-slate-100 text-slate-700', nota: '', notaColor: '' };
};

const Inventory: React.FC = () => {
    const navigate = useNavigate();
    const { products, deleteProduct } = useStore();
    const sinMovimiento = useReducedMotion();
    // Cerrados al entrar: adentro está el detalle, y el detalle se pide.
    const [abiertos, setAbiertos] = useState<string[]>([]);

    const alternar = (clase: string) =>
        setAbiertos(previos => previos.includes(clase)
            ? previos.filter(c => c !== clase)
            : [...previos, clase]);

    // Remeras, buzos y Servolución —cada una su grupo—, y adentro del 1 al más alto.
    const grupos = useMemo(
        () => CLASES
            .map(clase => ({
                clase,
                items: products.filter(p => p.type === clase).sort(porTalle),
            }))
            .filter(g => g.items.length > 0),
        [products],
    );

    const borrar = async (p: InfoPointProduct, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`¿Eliminar ${p.type} talle ${p.size} del inventario?`)) return;
        await deleteProduct(p.code);
    };

    return (
        <div className="animate-fadeIn">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-sm text-slate-500">
                        Lo que hay en el mostrador, talle por talle.
                    </p>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => navigate('/punto-de-informacion?view=SEARCH')}
                            className="flex-1 sm:flex-none px-4 sm:px-5 py-3.5 bg-slate-100 text-black font-semibold text-sm rounded-full hover:bg-slate-200 active:scale-[0.99] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Search className="w-4 h-4" />
                            Buscar
                        </button>
                        <button
                            onClick={() => navigate('/punto-de-informacion?view=NEW_PRODUCT')}
                            className="flex-1 sm:flex-none px-4 sm:px-5 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            Nuevo producto
                        </button>
                    </div>
                </div>

                {grupos.map(({ clase, items }) => {
                    const total = items.reduce((n, p) => n + (p.stock ?? 0), 0);
                    const abierto = abiertos.includes(clase);
                    const sinStock = items.filter(p => (p.stock ?? 0) <= (p.minStock ?? 0)).length;
                    return (
                        <section key={clase}>
                            {/* La barra separa, cuenta y abre: de un vistazo,
                                cuántas hay de cada cosa y cuántas se están por
                                acabar, sin desplegar nada. */}
                            <h3 className="sticky top-0 z-10">
                                <button
                                    type="button"
                                    onClick={() => alternar(clase)}
                                    aria-expanded={abierto}
                                    aria-controls={`talles-${clase}`}
                                    className="w-full px-5 sm:px-6 py-3 bg-slate-50/95 backdrop-blur border-y border-slate-100 flex items-center gap-3 text-[13px] font-semibold text-slate-500 hover:text-black hover:bg-slate-100/95 transition-colors"
                                >
                                    <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
                                    <span className="flex-1 text-left text-black">{clase}</span>
                                    {sinStock > 0 && !abierto && (
                                        <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                                            {sinStock} por acabarse
                                        </span>
                                    )}
                                    <span className="tabular-nums font-normal text-slate-400">{total} en total</span>
                                </button>
                            </h3>

                            <AnimatePresence initial={false}>
                            {abierto && (
                            <motion.ul
                                id={`talles-${clase}`}
                                initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={sinMovimiento ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                transition={{ duration: sinMovimiento ? 0 : 0.2, ease: 'easeOut' }}
                                className="divide-y divide-slate-100 overflow-hidden">
                                {items.map(p => {
                                    const estado = estadoDe(p);
                                    return (
                                        <li key={p.code} className="px-5 sm:px-6 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-semibold text-[15px] text-black leading-tight">Talle {p.size}</h4>
                                                <p className="flex items-center gap-2 mt-0.5 text-[13px] text-slate-400 tabular-nums">
                                                    <span>{precio(p.price)}</span>
                                                    {estado.nota && (
                                                        <span className={`font-medium ${estado.notaColor}`}>{estado.nota}</span>
                                                    )}
                                                </p>
                                            </div>

                                            <span className={`shrink-0 min-w-[44px] text-center rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${estado.pastilla}`}>
                                                {p.stock ?? 0}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={e => borrar(p, e)}
                                                className="shrink-0 w-9 h-9 -mr-1.5 flex items-center justify-center rounded-full text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                aria-label={`Eliminar ${p.type} talle ${p.size}`}
                                            >
                                                <Trash2 className="w-4 h-4 pointer-events-none" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </motion.ul>
                            )}
                            </AnimatePresence>
                        </section>
                    );
                })}

                {products.length === 0 && (
                    <div className="flex flex-col items-center text-center px-6 py-16 border-t border-slate-100">
                        <span className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <Package className="w-6 h-6 text-slate-400" />
                        </span>
                        <h3 className="text-lg font-bold tracking-tight text-black">El inventario está vacío</h3>
                        <p className="text-sm text-slate-500 mt-1.5 mb-6 max-w-xs">
                            Creá la primera remera o el primer buzo y después cargá cuántos hay.
                        </p>
                        <button
                            onClick={() => navigate('/punto-de-informacion?view=NEW_PRODUCT')}
                            className="px-5 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Crear el primero
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Inventory;
