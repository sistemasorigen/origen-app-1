import React from 'react';
import { X } from 'lucide-react';
import { Group } from '../../types';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * Moderación (design-claude/Admin GCX - Panel).
 *
 * Es el cajón de acciones del panel: lo que se hace sobre los grupos
 * tildados en la lista, más las dos bandejas que antes vivían sueltas en la
 * barra —solicitudes de baja y agregar un miembro a mano—, que no tienen
 * otro lugar en el diseño.
 */

interface ModalModeracionGruposProps {
    isOpen: boolean;
    onClose: () => void;
    seleccionados: Group[];
    pendingDropoutCount: number;
    onSolicitudesDeBaja: () => void;
    onAgregarMiembro: () => void;
    onAprobarSeleccionados: () => void;
    onExportarAnfitriones: () => void;
    onEliminarSeleccionados: () => void;
}

const ModalModeracionGrupos: React.FC<ModalModeracionGruposProps> = ({
    isOpen,
    onClose,
    seleccionados,
    pendingDropoutCount,
    onSolicitudesDeBaja,
    onAgregarMiembro,
    onAprobarSeleccionados,
    onExportarAnfitriones,
    onEliminarSeleccionados,
}) => {
    useBloqueoDeFondo(isOpen);

    if (!isOpen) return null;

    const pendientes = seleccionados.filter(g => g.status === 'pending' || !g.status).length;
    const n = seleccionados.length;

    // Sin `flex` a propósito: el display lo pone cada fila. Tres de ellas se
    // esconden en el teléfono con `hidden md:flex`, y si el helper trajera
    // `flex` las dos clases competirían por la misma propiedad.
    const fila = (habilitada: boolean, peligro = false) =>
        `h-[52px] w-full items-center gap-2.5 rounded-[18px] px-[18px] text-left text-[14px] font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${peligro ? 'bg-[#fdecea] text-[#a32218]' : 'bg-[#f7f7f5] text-[#0a0a0a]'} ${habilitada ? 'hover:opacity-90' : 'cursor-not-allowed opacity-40'}`;

    const globo = (
        <span className="flex h-[22px] items-center rounded-full bg-white px-2.5 text-[11.5px] font-semibold text-black/[.62]">
            {pendingDropoutCount}
        </span>
    );

    return (
        // El contenedor scrollea, no el diálogo: si la pantalla es más baja
        // que el modal (un teléfono apaisado), se puede llegar al borde de
        // arriba en vez de quedar cortado.
        <div className="fixed inset-0 z-[80] overflow-y-auto">
            {/* Fijo, no absoluto: así el fondo no se despega al scrollear. */}
            <div className="fixed inset-0 bg-[rgba(10,10,10,.42)]" onClick={onClose} />

            {/*
                Centrado real en los dos ejes, en vez del `top-12` / `md:top-[60px]`
                que tenía antes: anclado al tope, el modal quedaba pegado arriba
                con todo el aire sobrante abajo.

                `min-h-full` + `items-center` centra cuando sobra lugar, y cuando
                falta deja que el contenedor scrollee. El padding es el que
                garantiza que el borde nunca toque el filo de la pantalla.
            */}
            <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6">
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Moderación"
                    className="w-full max-w-[620px] overflow-hidden rounded-[26px] bg-white shadow-[0_20px_50px_rgba(0,0,0,.25)]"
                >
                <div className="flex items-start gap-3.5 px-[22px] pt-5">
                    <div className="min-w-0 flex-1">
                        <p className="text-[18px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">Moderación</p>
                        {/* En el teléfono no hay nada que tildar, así que pedirlo
                            sería mandar a alguien a buscar una casilla que no
                            existe. */}
                        <p className="mt-[5px] text-[12.5px] font-medium text-black/[.62]">
                            <span className="md:hidden">Las dos bandejas del panel, a mano.</span>
                            <span className="hidden md:inline">
                                {n > 0
                                    ? `${n} ${n === 1 ? 'grupo tildado' : 'grupos tildados'} en la lista.`
                                    : 'Tildá grupos en la lista para actuar sobre ellos.'}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a]"
                    >
                        <X className="h-[15px] w-[15px]" />
                    </button>
                </div>

                <div className="flex flex-col gap-2 px-[22px] pt-[18px]">
                    <button onClick={onSolicitudesDeBaja} className={`flex ${fila(true)}`}>
                        <span className="flex-1">Ver las solicitudes de baja</span>
                        {pendingDropoutCount > 0 && globo}
                    </button>

                    <button onClick={onAgregarMiembro} className={`flex ${fila(true)}`}>
                        Agregar un miembro a mano
                    </button>

                    {/* Las tres acciones que operan sobre grupos tildados no se
                        muestran en el teléfono: las casillas para tildar viven
                        en la tabla, que es solo de escritorio, así que acá
                        nunca se podían habilitar y ocupaban media pantalla en
                        gris. Va escrito móvil primero —`hidden md:flex`— porque
                        este proyecto carga Tailwind por CDN y las variantes
                        max-* no existen ahí. */}
                    <button
                        onClick={onAprobarSeleccionados}
                        disabled={pendientes === 0}
                        className={`hidden md:flex ${fila(pendientes > 0)}`}
                    >
                        {pendientes > 0
                            ? `Aprobar ${pendientes === 1 ? 'el pendiente tildado' : `los ${pendientes} pendientes tildados`}`
                            : 'Aprobar los pendientes tildados'}
                    </button>

                    <button
                        onClick={onExportarAnfitriones}
                        disabled={n === 0}
                        className={`hidden md:flex ${fila(n > 0)}`}
                    >
                        Exportar los contactos de los anfitriones
                    </button>

                    <button
                        onClick={onEliminarSeleccionados}
                        disabled={n === 0}
                        className={`hidden md:flex ${fila(n > 0, true)}`}
                    >
                        {n > 0
                            ? `Eliminar ${n === 1 ? 'el grupo tildado' : `los ${n} grupos tildados`}`
                            : 'Eliminar los grupos tildados'}
                    </button>
                </div>

                <div className="px-[22px] pb-5 pt-[18px]">
                    <button
                        onClick={onClose}
                        className="h-12 w-full rounded-full bg-[#f2f2f0] text-[14.5px] font-semibold text-[#0a0a0a]"
                    >
                        Cerrar
                    </button>
                </div>
                </div>
            </div>
        </div>
    );
};

export default ModalModeracionGrupos;
