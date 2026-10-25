import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store';
import { ProductType } from '../../types';

/** Los tipos con precio propio. La Servolución copia el de las remeras. */
const CON_PRECIO_PROPIO = [ProductType.REMERA, ProductType.BUZO];
import { useToast } from './context/ContextoToast';
import {
    Download, Loader2,
} from 'lucide-react';
import useBloqueoDeFondo from '../../hooks/useBloqueoDeFondo';
import { Campo, Opciones, campo } from '../../components/info-point/FormularioDelPunto';

/**
 * Configuración del Punto.
 *
 * Dos trabajos: lo que cuestan las cosas (precios) y llevarse el
 * inventario a una planilla. Los precios primero, porque pisan lo que hay:
 * la tarjeta dice cuántos productos hay y entre qué valores están ANTES de
 * tocar nada, y la confirmación repite la cuenta.
 *
 * Hablaba en mayúsculas —"ACTUALIZACIÓN MASIVA", "DESCARGA EL INVENTARIO
 * COMPLETO EN FORMATO CSV"— y tenía un botón verde que no existe en ninguna
 * otra pantalla de la app. Ahora habla como el login y como el resto del
 * módulo: minúsculas, negro, botones redondos.
 *
 * El id `punto-formulario` no es decorativo: index.html le pone a todo
 * input/select un borde con !important, y la única forma de ganarle sin
 * tocar lo global es un selector con id. La confirmación va con createPortal
 * porque `animate-fadeIn` deja un transform en el contenedor, y un transform
 * rompe el position:fixed de adentro.
 */

const precio = (valor: number) => `$${(valor ?? 0).toLocaleString('es-AR')}`;

/**
 * "las 11 remeras", "los 6 buzos", "la remera": el artículo y el singular
 * cambian con el tipo, y la pantalla habla de productos todo el tiempo.
 */
const PALABRAS = {
    [ProductType.REMERA]: { articulo: 'las', todas: 'todas', una: 'la remera', singular: 'remera', plural: 'remeras' },
    [ProductType.BUZO]: { articulo: 'los', todas: 'todos', una: 'el buzo', singular: 'buzo', plural: 'buzos' },
    [ProductType.SERVOLUCION]: { articulo: 'las', todas: 'todas', una: 'la remera Servolución', singular: 'remera Servolución', plural: 'remeras Servolución' },
};

/** La tarjeta de cada trabajo: un título, qué hace, y una acción si tiene. */
const Tarjeta: React.FC<{
    titulo: string;
    bajada: string;
    accion?: React.ReactNode;
    children?: React.ReactNode;
}> = ({ titulo, bajada, accion, children }) => (
    <section aria-label={titulo} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 sm:px-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
                <h2 className="text-[17px] font-bold tracking-tight text-black leading-tight">{titulo}</h2>
                <p className="text-sm text-slate-500 leading-relaxed mt-1">{bajada}</p>
            </div>
            {accion && <div className="shrink-0 flex">{accion}</div>}
        </div>
        {children}
    </section>
);

const AdminPanel: React.FC = () => {
    const { products, refreshData } = useStore();
    const toast = useToast();
    const sinMovimiento = useReducedMotion();

    const [tipo, setTipo] = useState<ProductType>(ProductType.REMERA);
    const [nuevoPrecio, setNuevoPrecio] = useState(0);
    const [confirmando, setConfirmando] = useState(false);
    const [actualizando, setActualizando] = useState(false);

    useBloqueoDeFondo(confirmando);

    // Escape cierra la confirmación.
    useEffect(() => {
        if (!confirmando) return;
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setConfirmando(false);
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [confirmando]);

    // ── Precios ─────────────────────────────────────────────────────────
    const delTipo = products.filter(p => p.type === tipo);
    const valores = delTipo.map(p => p.price ?? 0);
    const masBarato = valores.length ? Math.min(...valores) : 0;
    const masCaro = valores.length ? Math.max(...valores) : 0;
    const palabra = PALABRAS[tipo];
    const cuantos = delTipo.length;
    const unaSola = cuantos === 1;
    // "1 remeras" no lo dice nadie.
    const nombreTipo = unaSola ? palabra.singular : palabra.plural;
    /** "la remera" o "las 11 remeras". */
    const cuantosConArticulo = unaSola ? palabra.una : `${palabra.articulo} ${cuantos} ${palabra.plural}`;

    const comoEstanHoy = cuantos === 0
        ? `Todavía no cargaste ${palabra.plural}.`
        : masBarato === masCaro
            ? `Hay ${cuantos} ${nombreTipo} a ${precio(masBarato)}.`
            : `Hay ${cuantos} ${nombreTipo}, de ${precio(masBarato)} a ${precio(masCaro)}.`;

    const puedeActualizar = cuantos > 0 && nuevoPrecio > 0;

    const soloNumeros = (texto: string) => {
        const n = parseInt(texto.replace(/[^0-9]/g, ''), 10);
        return Number.isNaN(n) ? 0 : n;
    };

    const actualizarPrecios = async () => {
        setConfirmando(false);
        setActualizando(true);
        try {
            const { dbAPI } = await import('../../services/db');
            await dbAPI.updateProductPricesByType(tipo, nuevoPrecio);
            await refreshData();
            toast.success(`Precios actualizados: ${palabra.plural} a ${precio(nuevoPrecio)}.`);
        } catch {
            toast.error('No se pudieron actualizar los precios. Probá de nuevo.');
        } finally {
            setActualizando(false);
        }
    };

    // ── Inventario en CSV ───────────────────────────────────────────────
    const descargarCSV = () => {
        const encabezados = ['Codigo', 'Nombre', 'Tipo', 'Talle', 'Stock', 'Precio'];
        const filas = products.map(p => [p.code, p.name, p.type, p.size, p.stock, p.price]);
        const contenido = '﻿' + [encabezados, ...filas].map(f => f.join(',')).join('\n');
        const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'inventario_origen.csv');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        toast.success('Inventario descargado.');
    };

    // ── Movimiento: sólo el que responde a un toque ─────────────────────
    const velo = sinMovimiento ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    const hoja = sinMovimiento
        ? {}
        : {
            initial: { opacity: 0, y: 24 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: 24 },
            transition: { duration: 0.2, ease: 'easeOut' as const },
        };

    return (
        <div id="punto-formulario" className="w-full max-w-2xl mx-auto space-y-5 animate-fadeIn pb-10">

            {/* ── Precios ──────────────────────────────────────────────── */}
            <Tarjeta
                titulo="Precios"
                bajada="Un mismo precio para todas las remeras o para todos los buzos. Las remeras Servolución llevan siempre el precio de las remeras."
            >
                <div className="px-5 sm:px-6 pb-5 space-y-4 border-t border-slate-100 pt-5">
                    <Campo etiqueta="Qué productos">
                        <Opciones
                            etiquetaGrupo="Remeras o buzos"
                            valor={tipo}
                            opciones={CON_PRECIO_PROPIO.map(t => ({ valor: t }))}
                            onElegir={v => setTipo(v as ProductType)}
                        />
                    </Campo>

                    <Campo etiqueta="Nuevo precio">
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400 pointer-events-none">
                                $
                            </span>
                            <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                aria-label="Nuevo precio"
                                value={nuevoPrecio || ''}
                                placeholder="0"
                                onChange={e => setNuevoPrecio(soloNumeros(e.target.value))}
                                className={`${campo} pl-8`}
                            />
                        </div>
                    </Campo>

                    {/* El antes y el después, con la cuenta hecha: pisar precios
                        no se deshace. */}
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500 leading-relaxed">
                        {comoEstanHoy}
                        {puedeActualizar && (
                            <>
                                {' '}{unaSola ? 'Pasa' : `Pasan ${palabra.todas}`} a{' '}
                                <span className="font-semibold text-black">{precio(nuevoPrecio)}</span>.
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setConfirmando(true)}
                        disabled={!puedeActualizar || actualizando}
                        className="w-full py-4 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:bg-black disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                        {actualizando && <Loader2 className="w-4 h-4 animate-spin" />}
                        Actualizar precios
                    </button>
                </div>
            </Tarjeta>

            {/* ── Inventario en CSV ────────────────────────────────────── */}
            <Tarjeta
                titulo="Inventario en una planilla"
                bajada={products.length > 0
                    ? `Los ${products.length} productos con su talle, su stock y su precio, en un archivo que abre Excel.`
                    : 'Cuando haya productos cargados, se los puede bajar en un archivo que abre Excel.'}
            >
                <div className="px-5 sm:px-6 pb-5 border-t border-slate-100 pt-5">
                    <button
                        type="button"
                        onClick={descargarCSV}
                        disabled={products.length === 0}
                        className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 text-black font-semibold text-sm rounded-full hover:bg-slate-200 active:scale-[0.99] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Descargar inventario
                    </button>
                </div>
            </Tarjeta>

            {/* ── Confirmar el cambio de precios ───────────────────────── */}
            {createPortal(
                <AnimatePresence>
                    {confirmando && (
                        <motion.div
                            key="velo-precios"
                            {...velo}
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
                            onClick={() => setConfirmando(false)}
                        >
                            <motion.div
                                {...hoja}
                                role="dialog"
                                aria-modal="true"
                                aria-label="Confirmar el cambio de precios"
                                onClick={e => e.stopPropagation()}
                                className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6"
                            >
                                <h2 className="text-lg font-bold tracking-tight text-black leading-snug">
                                    ¿Pasar {cuantosConArticulo} a {precio(nuevoPrecio)}?
                                </h2>
                                <p className="text-sm text-slate-500 leading-relaxed mt-2">
                                    {comoEstanHoy} Los precios de ahora se pierden.
                                </p>

                                <div className="flex gap-2 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmando(false)}
                                        className="flex-1 py-3.5 bg-slate-100 text-black font-semibold text-sm rounded-full hover:bg-slate-200 active:scale-[0.99] transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={actualizarPrecios}
                                        className="flex-1 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all"
                                    >
                                        Actualizar
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body,
            )}

        </div>
    );
};

export default AdminPanel;
