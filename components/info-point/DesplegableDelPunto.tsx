import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { InfoPointProduct, ProductType } from '../../types';

/**
 * La píldora que se despliega, y el orden de los talles.
 *
 * Nació en la carga de varios movimientos y la usa igual la pantalla de
 * reportar el stock: las dos arman una lista producto por producto, y tienen
 * que verse y comportarse igual. Vive acá para que no se separen.
 */

export interface Opcion {
    valor: string;
    etiqueta?: string;
    /** Aclaración chica a la derecha: el stock, o por qué no se puede. */
    nota?: string;
    bloqueada?: boolean;
}

/** Los tipos de producto, en el orden en que se muestran en todo el Punto. */
export const CLASES = [ProductType.REMERA, ProductType.BUZO, ProductType.SERVOLUCION];

/**
 * Remeras, buzos y Servolución, y adentro de cada uno del talle 1 al más alto.
 * El talle es texto en la base ('1'…'10'), así que se compara como número: si
 * no, el 10 queda entre el 1 y el 2.
 */
export const porTalle = (a: InfoPointProduct, b: InfoPointProduct) => {
    const clase = CLASES.indexOf(a.type) - CLASES.indexOf(b.type);
    if (clase !== 0) return clase;
    return (parseInt(a.size, 10) || 0) - (parseInt(b.size, 10) || 0);
};

/**
 * Cerrada dice qué falta elegir; abierta muestra las opciones. Es siempre
 * blanca: lo que cambia al elegir es el texto, que pasa de gris claro —una
 * indicación, no un dato— a negro, igual que un campo cuando se completa.
 *
 * Se despliega hacia abajo empujando lo que sigue, no flotando por encima: la
 * lista del teléfono recorta lo que se salga, y un menú flotante cerca del
 * borde de la pantalla se va de cuadro.
 */
export const Desplegable: React.FC<{
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
                className={`w-full h-12 px-4 flex items-center justify-between gap-2 rounded-xl border bg-white text-sm font-semibold transition-colors ${valor
                    ? 'border-slate-300 text-black'
                    : 'border-slate-200 text-slate-400 hover:text-black hover:border-slate-300'
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
                                <p className="px-4 py-3 text-sm text-slate-400">No queda nada para elegir.</p>
                            )}
                            {opciones.map(o => (
                                <button
                                    key={o.valor}
                                    type="button"
                                    disabled={o.bloqueada}
                                    aria-pressed={valor === o.valor}
                                    onClick={() => onElegir(o.valor)}
                                    className={`w-full h-12 px-4 flex items-center gap-3 text-left text-sm font-semibold transition-colors ${o.bloqueada
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-black hover:bg-slate-50'
                                        }`}
                                >
                                    <span className="flex-1 truncate">{o.etiqueta || o.valor}</span>
                                    {o.nota && (
                                        <span className="shrink-0 text-xs font-medium text-slate-400">
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

export default Desplegable;
