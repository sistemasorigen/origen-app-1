import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import useBloqueoDeFondo from '../../hooks/useBloqueoDeFondo';

/**
 * Las piezas de los formularios de alta del Punto.
 *
 * Seis pantallas cargan datos —evento, anuncio, bautismo, presentación,
 * préstamo, producto— y cada una tenía su propia cabecera, sus etiquetas en
 * mayúscula, su ancho y sus botones. Acá viven una sola vez, en el idioma del
 * login: minúsculas con tracking-tight, negro puro, botón redondo.
 *
 * Quien las usa suele tener a la persona enfrente esperando, así que los
 * campos son altos (48px), las etiquetas van arriba y a la izquierda —no
 * adentro del campo, que desaparecen al escribir—. Guardar es en dos pasos,
 * como en Reportar: "Revisar" en una barra fija abajo, y una hoja con los
 * datos para confirmar.
 *
 * El id `punto-formulario` NO es decorativo: index.html le pone a todo
 * input/select/textarea un borde y un fondo con !important, y la única forma
 * de ganarle sin tocar lo global es un selector con id.
 */

export const PantallaFormulario: React.FC<{
    volverA: string;
    volverTexto: string;
    titulo: string;
    bajada?: string;
    children: React.ReactNode;
}> = ({ volverA, volverTexto, titulo, bajada, children }) => {
    const navigate = useNavigate();
    return (
        <div id="punto-formulario" className="min-h-screen bg-slate-50">
            {/* pb-36: lo último del formulario no queda debajo de la barra. */}
            <div className="w-full max-w-lg mx-auto px-4 pt-6 pb-36 md:pt-10">
                <button
                    type="button"
                    onClick={() => navigate(volverA)}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {volverTexto}
                </button>

                <h1 className="text-[26px] font-bold tracking-tight text-black leading-none">{titulo}</h1>
                {bajada && <p className="text-sm text-slate-500 leading-relaxed mt-2">{bajada}</p>}

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 mt-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

/** Una etiqueta arriba, el campo abajo, y una ayuda si hace falta. */
export const Campo: React.FC<{
    etiqueta: string;
    para?: string;
    ayuda?: string;
    children: React.ReactNode;
}> = ({ etiqueta, para, ayuda, children }) => (
    <div>
        <label htmlFor={para} className="block text-[13px] font-semibold text-slate-700 mb-1.5">{etiqueta}</label>
        {children}
        {ayuda && <p className="text-[13px] text-slate-400 mt-1.5">{ayuda}</p>}
    </div>
);

/**
 * Dos campos al lado del otro en pantalla grande, uno debajo del otro en el
 * teléfono. Con `juntos`, van al lado hasta en el teléfono: sirve para los
 * pares cortos —una hora, una fecha—, no para dos nombres.
 */
export const ParDeCampos: React.FC<{ children: React.ReactNode; juntos?: boolean }> = ({ children, juntos }) => (
    <div className={`grid gap-4 ${juntos ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>{children}</div>
);

/** Las clases de un campo. El borde y el fondo los pone el CSS con id. */
export const campo = 'w-full h-12 px-4 text-sm font-medium text-black placeholder:text-slate-400 transition-colors';
export const campoLargo = 'w-full px-4 py-3 text-sm font-medium text-black placeholder:text-slate-400 transition-colors resize-none';

/**
 * La barra de abajo, la misma de Reportar: lo que se está por cargar a la
 * izquierda y "Revisar" a la derecha, siempre a la vista aunque el
 * formulario sea largo.
 *
 * "Revisar" es el submit del formulario (por el atributo `form`, porque la
 * barra va por portal y queda afuera): así el navegador sigue avisando los
 * campos obligatorios que faltan antes de abrir la revisión. Va por portal
 * porque el contenedor de la app tiene un transform, y un transform rompe
 * el position:fixed de adentro.
 */
export const BarraDeRevisar: React.FC<{
    /** El id del <form> que envía. */
    form: string;
    resumen: string;
    detalle?: string;
    deshabilitado?: boolean;
}> = ({ form, resumen, detalle, deshabilitado }) => createPortal(
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)]">
        <div className="w-full max-w-lg mx-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-4">
            <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold tracking-tight text-black leading-tight truncate">{resumen}</p>
                {detalle && <p className="text-[13px] text-slate-400 mt-0.5 truncate">{detalle}</p>}
            </div>
            <button
                type="submit"
                form={form}
                disabled={deshabilitado}
                className="shrink-0 px-6 py-3.5 bg-black text-white text-sm font-semibold rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:bg-black disabled:active:scale-100"
            >
                Revisar
            </button>
        </div>
    </div>,
    document.body,
);

export interface FilaDeRevision { etiqueta: string; valor: string }

/**
 * Antes de guardar, los datos a la vista: hoja desde abajo en el teléfono,
 * modal en la compu, igual que la revisión de Reportar. Con la persona
 * enfrente es el momento de leerle el apellido o el teléfono y corregir;
 * después, un dato mal anotado ya no se ve hasta que hace falta.
 *
 * Si el guardado falla, la hoja queda abierta con el error y los datos
 * siguen en el formulario.
 */
export const HojaDeRevision: React.FC<{
    abierta: boolean;
    titulo: string;
    bajada?: string;
    grupos: { titulo?: string; filas: FilaDeRevision[] }[];
    textoConfirmar: string;
    guardando: boolean;
    error?: string | null;
    onCorregir: () => void;
    onConfirmar: () => void;
}> = ({ abierta, titulo, bajada, grupos, textoConfirmar, guardando, error, onCorregir, onConfirmar }) => {
    const sinMovimiento = useReducedMotion();
    const panel = useRef<HTMLDivElement>(null);
    useBloqueoDeFondo(abierta);

    // Escape lee siempre lo último: quien usa la hoja le pasa una función
    // nueva en cada render, y con ella en las dependencias el foco volvía al
    // panel en cada tecla.
    const alCorregir = useRef(onCorregir);
    alCorregir.current = onCorregir;
    const ocupado = useRef(guardando);
    ocupado.current = guardando;

    useEffect(() => {
        if (!abierta) return;
        panel.current?.focus({ preventScroll: true });
        const alTeclado = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ocupado.current) alCorregir.current(); };
        document.addEventListener('keydown', alTeclado);
        return () => document.removeEventListener('keydown', alTeclado);
    }, [abierta]);

    return createPortal(
        <AnimatePresence>
            {abierta && (
                <motion.div
                    className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/50"
                    initial={sinMovimiento ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { if (!guardando) onCorregir(); }}
                >
                    <motion.div
                        ref={panel}
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-label={titulo}
                        onClick={e => e.stopPropagation()}
                        className="w-full md:max-w-lg bg-white rounded-t-3xl md:rounded-2xl shadow-xl max-h-[92vh] md:max-h-[88vh] flex flex-col outline-none"
                        initial={sinMovimiento ? false : { y: 24, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={sinMovimiento ? { opacity: 0 } : { y: 24, opacity: 0 }}
                        transition={{ duration: sinMovimiento ? 0 : 0.2, ease: 'easeOut' }}
                    >
                        {/* contenido-del-overlay: con un modal abierto, index.css esconde
                            todo <header> de la página; éste es de la hoja. */}
                        <header className="contenido-del-overlay shrink-0 px-5 pt-4 pb-3 border-b border-slate-100">
                            <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mb-3 md:hidden" />
                            <h2 className="text-[19px] font-bold tracking-tight text-black">{titulo}</h2>
                            {bajada && <p className="text-[13px] text-slate-500 mt-1">{bajada}</p>}
                        </header>

                        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
                            {grupos.map((g, i) => (
                                <section key={i}>
                                    {g.titulo && <h3 className="text-[13px] font-semibold text-slate-500 mb-2">{g.titulo}</h3>}
                                    <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                                        {g.filas.map(f => (
                                            <div key={f.etiqueta} className="px-4 py-2.5 flex items-baseline gap-3">
                                                <dt className="w-28 shrink-0 text-[13px] text-slate-500">{f.etiqueta}</dt>
                                                <dd className="min-w-0 flex-1 text-sm font-semibold text-black [overflow-wrap:anywhere]">
                                                    {f.valor || <span className="font-medium text-slate-300">Sin completar</span>}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </section>
                            ))}

                            {error && (
                                <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-[13px] leading-relaxed text-red-800">
                                    {error}
                                </p>
                            )}
                        </div>

                        <footer className="shrink-0 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={onCorregir}
                                disabled={guardando}
                                className="h-12 rounded-full bg-slate-100 text-black text-sm font-semibold hover:bg-slate-200 active:scale-[0.99] transition-all disabled:opacity-40"
                            >
                                Corregir
                            </button>
                            <button
                                type="button"
                                onClick={onConfirmar}
                                disabled={guardando}
                                className="h-12 rounded-full bg-black text-white text-sm font-semibold hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {guardando ? 'Guardando…' : textoConfirmar}
                            </button>
                        </footer>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
};

/** "viernes 23 de octubre de 2026", para leerla en la revisión. */
export const fechaParaRevisar = (iso: string): string => {
    const d = new Date(`${(iso || '').slice(0, 10)}T12:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Un grupo de opciones que se eligen tocando, en vez de un desplegable.
 * Con dos o tres opciones es un toque en lugar de tres, y se ven todas.
 */
export const Opciones: React.FC<{
    valor: string;
    opciones: { valor: string; etiqueta?: string }[];
    onElegir: (valor: string) => void;
    etiquetaGrupo: string;
}> = ({ valor, opciones, onElegir, etiquetaGrupo }) => (
    <div role="group" aria-label={etiquetaGrupo} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(opciones.length, 3)}, minmax(0, 1fr))` }}>
        {opciones.map(o => (
            <button
                key={o.valor}
                type="button"
                aria-pressed={valor === o.valor}
                onClick={() => onElegir(o.valor)}
                className={`h-12 px-2 rounded-xl border text-sm font-semibold transition-colors ${valor === o.valor
                    ? 'bg-black border-black text-white'
                    : 'bg-white border-slate-200 text-slate-500 hover:text-black hover:border-slate-300'
                    }`}
            >
                {o.etiqueta || o.valor}
            </button>
        ))}
    </div>
);
