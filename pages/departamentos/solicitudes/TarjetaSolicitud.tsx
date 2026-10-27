import React, { useEffect, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { haceCuanto, type Solicitud } from '../../../services/agenda';
import { Avatar } from '../../admin/departamentos/piezas';
import { ChipColor } from '../equipo/piezas';

/**
 * Una solicitud que llegó al departamento (design-claude/Departamento -
 * Tareas, pestaña Solicitudes).
 *
 * Los detalles se recortan a cuatro líneas y el "Ver más" aparece sólo si
 * REALMENTE hay más: se mide el texto en vez de adivinar por el largo, porque
 * cuatro líneas en un teléfono y en una pantalla ancha no son la misma
 * cantidad de letras, y un "Ver más" que no revela nada enseña a no tocarlo.
 *
 * El texto se muestra tal cual se escribió —saltos de línea respetados— y
 * nunca como HTML: lo que escribe una persona no se interpreta.
 */

const LINEAS = 4;

const TarjetaSolicitud: React.FC<{
    solicitud: Solicitud;
    /** El color del departamento, para las iniciales de quien pidió. */
    color: string;
    onAceptar?: () => void;
    onRechazar?: () => void;
    onAsignar?: () => void;
    ocupada?: boolean;
    /** Se la acaba de aceptar: sale de esta lista. */
    saliendo?: boolean;
    /** Acaba de llegar a esta lista: entra marcándose. */
    reciente?: boolean;
}> = ({ solicitud, color, onAceptar, onRechazar, onAsignar, ocupada = false, saliendo = false, reciente = false }) => {
    const [abierto, setAbierto] = useState(false);
    const [hayMas, setHayMas] = useState(false);
    const texto = useRef<HTMLParagraphElement>(null);

    // Se mide después de pintar, y de nuevo si cambia el ancho.
    useEffect(() => {
        const medir = () => {
            const el = texto.current;
            if (el) setHayMas(el.scrollHeight - el.clientHeight > 2);
        };
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, [solicitud.detalles, abierto]);

    const quien = solicitud.solicitante?.nombre || 'Alguien de la iglesia';
    const animacion = saliendo
        ? 'motion-safe:animate-[depSale_.34s_ease_both]'
        : reciente ? 'motion-safe:animate-[depLlega_1s_ease_both]' : '';

    return (
        <article className={`flex flex-col gap-3.5 rounded-[24px] bg-white p-[18px] shadow-[0_1px_2px_rgba(0,0,0,.05)] ${animacion}`}>
            <div className="flex items-center gap-3">
                <Avatar persona={solicitud.solicitante ?? { nombre: null, avatarUrl: null }} color={color} tam={42} />
                <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[15px] font-bold">{quien}</p>
                    <p className="m-0 mt-0.5 text-[12.5px] font-semibold text-black/[.58]">{haceCuanto(solicitud.createdAt)}</p>
                </div>
                {solicitud.prioridad && (
                    // Sin id, la prioridad se borró: queda el nombre que se
                    // pidió, en gris, porque ese color ya no existe.
                    <ChipColor color={solicitud.prioridad.color ?? 'rgba(0,0,0,.4)'}>
                        {solicitud.prioridad.nombre}
                    </ChipColor>
                )}
            </div>

            <p
                ref={texto}
                className="m-0 whitespace-pre-line text-[14.5px] font-medium leading-[1.6] text-black/[.8]"
                style={abierto ? undefined : {
                    display: '-webkit-box',
                    WebkitLineClamp: LINEAS,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {solicitud.detalles}
            </p>
            {(hayMas || abierto) && (
                <button
                    type="button"
                    onClick={() => setAbierto(v => !v)}
                    className="-mt-2 self-start text-[13.5px] font-bold text-[#0a0a0a] underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                >
                    {abierto ? 'Ver menos' : 'Ver más'}
                </button>
            )}

            <div className="mt-auto flex gap-2">
                {onRechazar && (
                    <button
                        type="button"
                        onClick={onRechazar}
                        disabled={ocupada}
                        className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[#f2f2f0] text-[14px] font-bold text-black/[.62] transition-colors hover:text-[#0a0a0a] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Rechazar
                    </button>
                )}
                {onAceptar && (
                    <button
                        type="button"
                        onClick={onAceptar}
                        disabled={ocupada}
                        className="flex h-[46px] flex-1 items-center justify-center rounded-full bg-[#0a0a0a] text-[14px] font-bold text-white transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Aceptar
                    </button>
                )}
                {onAsignar && (
                    <button
                        type="button"
                        onClick={onAsignar}
                        disabled={ocupada}
                        className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-[#0a0a0a] text-[14px] font-bold text-white transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" />
                        Asignar tarea
                    </button>
                )}
            </div>
        </article>
    );
};

export default TarjetaSolicitud;
