import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store';
import { ProductType, PuntoInfoBannerSlide } from '../../types';

/** Los tipos con precio propio. La Servolución copia el de las remeras. */
const CON_PRECIO_PROPIO = [ProductType.REMERA, ProductType.BUZO];
import { useToast } from './context/ContextoToast';
import {
    Download, Image as ImageIcon, Plus, Pencil, Trash2, X, Loader2, Play,
} from 'lucide-react';
import ImageUpload from '../../components/media/SubidaImagen';
import VideoUpload from '../../components/media/SubidaVideo';
import EncuadreMedia from '../../components/media/EncuadreMedia';
import useBloqueoDeFondo from '../../hooks/useBloqueoDeFondo';
import { BotonCircular } from '../../components/info-point/ListaDelPunto';
import { Campo, Opciones, campo } from '../../components/info-point/FormularioDelPunto';
import {
    getPuntoInfoBannerSlides,
    createPuntoInfoBannerSlide,
    updatePuntoInfoBannerSlide,
    deletePuntoInfoBannerSlide,
    type PuntoInfoBannerSlideInput,
} from '../../services/supabaseService';

/**
 * Configuración del Punto.
 *
 * Son tres trabajos distintos, no tres tarjetas iguales: lo que ve la
 * iglesia al entrar (la portada), lo que cuestan las cosas (precios) y
 * llevarse el inventario a una planilla.
 *
 * Van en ese orden porque ese es el peso que tienen. La portada primero: es
 * lo único de acá adentro que mira todo el mundo. Los precios después,
 * porque pisan lo que hay: la tarjeta dice cuántos productos hay y entre qué
 * valores están ANTES de tocar nada, y la confirmación repite la cuenta.
 *
 * Hablaba en mayúsculas —"ACTUALIZACIÓN MASIVA", "DESCARGA EL INVENTARIO
 * COMPLETO EN FORMATO CSV"— y tenía un botón verde que no existe en ninguna
 * otra pantalla de la app. Ahora habla como el login y como el resto del
 * módulo: minúsculas, negro, botones redondos.
 *
 * El id `punto-formulario` no es decorativo: index.html le pone a todo
 * input/select un borde con !important, y la única forma de ganarle sin
 * tocar lo global es un selector con id. Las hojas van con createPortal
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

    const [portadas, setPortadas] = useState<PuntoInfoBannerSlide[]>([]);
    const [enEdicion, setEnEdicion] = useState<(Partial<PuntoInfoBannerSlideInput> & { id?: string }) | null>(null);
    const [guardando, setGuardando] = useState(false);

    useBloqueoDeFondo(confirmando || !!enEdicion);

    useEffect(() => {
        let cancelado = false;
        getPuntoInfoBannerSlides().then(lista => {
            if (!cancelado) setPortadas(lista);
        });
        return () => { cancelado = true; };
    }, []);

    // Escape cierra lo que esté abierto, empezando por lo de más arriba.
    useEffect(() => {
        if (!confirmando && !enEdicion) return;
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (confirmando) setConfirmando(false);
            else setEnEdicion(null);
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [confirmando, enEdicion]);

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

    // ── Portada del inicio ──────────────────────────────────────────────
    const esVideo = enEdicion?.mediaType === 'video';
    /** Qué falta para poder guardar. Un video sin video no es un video. */
    const faltaEnLaHoja = !enEdicion?.mediaUrl
        ? 'Falta la imagen.'
        : esVideo && !enEdicion?.videoUrl
            ? 'Falta el video.'
            : '';

    const guardarPortada = async () => {
        if (!enEdicion?.mediaUrl || faltaEnLaHoja) return;
        setGuardando(true);

        const datos: PuntoInfoBannerSlideInput = {
            mediaUrl: enEdicion.mediaUrl,
            mediaType: enEdicion.mediaType || 'image',
            videoUrl: enEdicion.videoUrl,
            focalX: enEdicion.focalX,
            focalY: enEdicion.focalY,
            zoom: enEdicion.zoom,
            title: enEdicion.title,
            subtitle: enEdicion.subtitle,
            displayOrder: enEdicion.displayOrder ?? portadas.length,
        };

        try {
            const listo = enEdicion.id
                ? await updatePuntoInfoBannerSlide(enEdicion.id, datos)
                : !!(await createPuntoInfoBannerSlide(datos));

            if (!listo) {
                // Antes el error se tragaba: la hoja quedaba girando para
                // siempre y nadie se enteraba de que no se había guardado.
                toast.error('No se pudo guardar la portada. Probá de nuevo.');
                return;
            }

            setPortadas(await getPuntoInfoBannerSlides());
            setEnEdicion(null);
            toast.success('Portada actualizada.');
        } finally {
            setGuardando(false);
        }
    };

    const borrarPortada = async (p: PuntoInfoBannerSlide) => {
        const que = p.mediaType === 'video' ? 'este video' : 'esta imagen';
        if (!window.confirm(`¿Sacar ${que} de la portada del inicio?`)) return;
        if (await deletePuntoInfoBannerSlide(p.id)) {
            setPortadas(previas => previas.filter(x => x.id !== p.id));
            toast.success('Salió de la portada.');
        } else {
            toast.error('No se pudo sacar de la portada.');
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

            {/* ── Portada del inicio ───────────────────────────────────── */}
            <Tarjeta
                titulo="Portada del inicio"
                bajada="Las imágenes y los videos que pasan arriba de todo cuando alguien abre el Punto."
                accion={portadas.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setEnEdicion({ mediaType: 'image', mediaUrl: '' })}
                        className="px-5 py-3 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar
                    </button>
                ) : undefined}
            >
                {portadas.length > 0 ? (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">
                        {portadas.map(p => (
                            <li key={p.id} className="px-5 sm:px-6 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                                <span className="relative shrink-0 w-20 h-11 rounded-lg bg-slate-100 overflow-hidden">
                                    <img src={p.mediaUrl} alt="" className="w-full h-full object-cover" />
                                    {p.mediaType === 'video' && (
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <Play className="w-4 h-4 text-white" fill="currentColor" />
                                        </span>
                                    )}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-semibold text-[15px] text-black leading-tight truncate">
                                        {p.title || 'Sin título'}
                                    </span>
                                    <span className="block text-[13px] text-slate-400 mt-0.5">
                                        {p.mediaType === 'video' ? 'Video' : 'Imagen'}
                                    </span>
                                </span>
                                <BotonCircular
                                    icono={Pencil}
                                    etiqueta={`Editar ${p.title || 'la portada'}`}
                                    onClick={() => setEnEdicion(p)}
                                />
                                <BotonCircular
                                    icono={Trash2}
                                    etiqueta={`Sacar ${p.title || 'esta portada'} del inicio`}
                                    tono="peligro"
                                    onClick={() => borrarPortada(p)}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center text-center px-6 py-12 border-t border-slate-100">
                        <span className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                        </span>
                        <h3 className="text-lg font-bold tracking-tight text-black">No hay portada todavía</h3>
                        <p className="text-sm text-slate-500 mt-1.5 mb-6 max-w-xs leading-relaxed">
                            Mientras tanto, el inicio muestra el logo de Origen sobre fondo negro.
                        </p>
                        <button
                            type="button"
                            onClick={() => setEnEdicion({ mediaType: 'image', mediaUrl: '' })}
                            className="px-5 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar la primera
                        </button>
                    </div>
                )}
            </Tarjeta>

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

            {/* ── Hoja de la portada ───────────────────────────────────── */}
            {createPortal(
                <AnimatePresence>
                    {enEdicion && (
                        <motion.div
                            key="velo-portada"
                            {...velo}
                            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
                            onClick={() => !guardando && setEnEdicion(null)}
                        >
                            <motion.div
                                {...hoja}
                                id="punto-formulario"
                                role="dialog"
                                aria-modal="true"
                                aria-label={enEdicion.id ? 'Editar la portada' : 'Agregar a la portada'}
                                onClick={e => e.stopPropagation()}
                                className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col"
                            >
                                {/* `contenido-del-overlay`: index.css esconde todo
                                    <header> de la página mientras hay un modal
                                    abierto, y esta cabecera vive ADENTRO del modal.
                                    Sin la clase quedaba en display:none y la hoja se
                                    abría sin título ni forma de cerrarla salvo Escape. */}
                                <header className="contenido-del-overlay shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
                                    <h2 className="text-[17px] font-bold tracking-tight text-black">
                                        {enEdicion.id ? 'Editar la portada' : 'Agregar a la portada'}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setEnEdicion(null)}
                                        aria-label="Cerrar"
                                        className="shrink-0 w-9 h-9 -mr-1.5 flex items-center justify-center rounded-full text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </header>

                                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4">
                                    <Campo etiqueta="Qué vas a mostrar">
                                        <Opciones
                                            etiquetaGrupo="Imagen o video"
                                            valor={enEdicion.mediaType || 'image'}
                                            opciones={[
                                                { valor: 'image', etiqueta: 'Imagen' },
                                                { valor: 'video', etiqueta: 'Video' },
                                            ]}
                                            onElegir={v => setEnEdicion({ ...enEdicion, mediaType: v as 'image' | 'video' })}
                                        />
                                    </Campo>

                                    <Campo
                                        etiqueta={esVideo ? 'Imagen de espera' : 'Imagen'}
                                        ayuda={esVideo ? 'Se ve mientras el video carga.' : undefined}
                                    >
                                        <ImageUpload
                                            currentImage={enEdicion.mediaUrl || ''}
                                            folder="punto-info-banner"
                                            onImageUpload={url => setEnEdicion({ ...enEdicion, mediaUrl: url })}
                                            aspectRatio="wide"
                                        />
                                    </Campo>

                                    {esVideo && (
                                        <Campo etiqueta="Video">
                                            <VideoUpload
                                                currentVideo={enEdicion.videoUrl || ''}
                                                folder="punto-info-banner"
                                                onVideoUpload={url => setEnEdicion({ ...enEdicion, videoUrl: url })}
                                            />
                                        </Campo>
                                    )}

                                    {enEdicion.mediaUrl && (
                                        <Campo etiqueta="Encuadre" ayuda="Movés la imagen para elegir qué parte se ve.">
                                            <EncuadreMedia
                                                mediaType={enEdicion.mediaType || 'image'}
                                                imageUrl={enEdicion.mediaUrl}
                                                videoUrl={enEdicion.videoUrl}
                                                frameWidth={1920}
                                                frameHeight={720}
                                                value={{
                                                    focalX: enEdicion.focalX ?? 50,
                                                    focalY: enEdicion.focalY ?? 50,
                                                    zoom: enEdicion.zoom ?? 1,
                                                }}
                                                onChange={encuadre => setEnEdicion({ ...enEdicion, ...encuadre })}
                                            />
                                        </Campo>
                                    )}

                                    <Campo etiqueta="Título" ayuda="Va escrito encima. Se puede dejar vacío.">
                                        <input
                                            type="text"
                                            aria-label="Título"
                                            placeholder="Encuentro de jóvenes"
                                            value={enEdicion.title || ''}
                                            onChange={e => setEnEdicion({ ...enEdicion, title: e.target.value })}
                                            className={campo}
                                        />
                                    </Campo>

                                    <Campo etiqueta="Subtítulo">
                                        <input
                                            type="text"
                                            aria-label="Subtítulo"
                                            placeholder="Sábado 22, 19 h"
                                            value={enEdicion.subtitle || ''}
                                            onChange={e => setEnEdicion({ ...enEdicion, subtitle: e.target.value })}
                                            className={campo}
                                        />
                                    </Campo>
                                </div>

                                <footer className="shrink-0 px-5 py-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={guardarPortada}
                                        disabled={guardando || !!faltaEnLaHoja}
                                        className="w-full py-4 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:bg-black disabled:active:scale-100 flex items-center justify-center gap-2"
                                    >
                                        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {enEdicion.id ? 'Guardar' : 'Agregar'}
                                    </button>
                                    {faltaEnLaHoja && (
                                        <p className="text-[13px] text-slate-400 text-center mt-2">{faltaEnLaHoja}</p>
                                    )}
                                </footer>
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
