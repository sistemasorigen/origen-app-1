import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
 * adentro del campo, que desaparecen al escribir— y el botón de guardar
 * ocupa todo el ancho abajo, donde cae el pulgar.
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
            <div className="w-full max-w-lg mx-auto px-4 py-6 md:py-10">
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

/** El botón que guarda: ancho completo, abajo, donde cae el pulgar. */
export const BotonGuardar: React.FC<{
    guardando?: boolean;
    children: React.ReactNode;
    deshabilitado?: boolean;
}> = ({ guardando, children, deshabilitado }) => (
    <button
        type="submit"
        disabled={guardando || deshabilitado}
        className="w-full py-4 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-40 disabled:hover:bg-black disabled:active:scale-100 flex items-center justify-center gap-2"
    >
        {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
        {children}
    </button>
);

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
