import React from 'react';
import { X } from 'lucide-react';
import { Group } from '../../types';

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
    if (!isOpen) return null;

    const pendientes = seleccionados.filter(g => g.status === 'pending' || !g.status).length;
    const n = seleccionados.length;

    const fila = (habilitada: boolean, peligro = false) =>
        `flex h-[52px] w-full items-center gap-2.5 rounded-[18px] px-[18px] text-left text-[14px] font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${peligro ? 'bg-[#fdecea] text-[#a32218]' : 'bg-[#f7f7f5] text-[#0a0a0a]'} ${habilitada ? 'hover:opacity-90' : 'cursor-not-allowed opacity-40'}`;

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
                        <p className="mt-[5px] text-[12.5px] font-medium text-black/[.62]">
                            {n > 0
                                ? `${n} ${n === 1 ? 'grupo tildado' : 'grupos tildados'} en la lista.`
                                : 'Tildá grupos en la lista para actuar sobre ellos.'}
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
                    <button onClick={onSolicitudesDeBaja} className={fila(true)}>
                        <span className="flex-1">Ver las solicitudes de baja</span>
                        {pendingDropoutCount > 0 && globo}
                    </button>

                    <button onClick={onAgregarMiembro} className={fila(true)}>
                        Agregar un miembro a mano
                    </button>

                    <button
                        onClick={onAprobarSeleccionados}
                        disabled={pendientes === 0}
                        className={fila(pendientes > 0)}
                    >
                        {pendientes > 0
                            ? `Aprobar ${pendientes === 1 ? 'el pendiente tildado' : `los ${pendientes} pendientes tildados`}`
                            : 'Aprobar los pendientes tildados'}
                    </button>

                    <button onClick={onExportarAnfitriones} disabled={n === 0} className={fila(n > 0)}>
                        Exportar los contactos de los anfitriones
                    </button>

                    <button onClick={onEliminarSeleccionados} disabled={n === 0} className={fila(n > 0, true)}>
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
