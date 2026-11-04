import React from 'react';
import { Repeat, TriangleAlert, Users } from 'lucide-react';
import { type Tarea } from '../../services/agenda';
import { VENCIDA } from '../../src/contenido/agendaPaleta';
import { avanceDeTarea } from '../../pages/agenda/plazos';
import {
    diaDelPlazo, diaYMes, diasDePlazo, esConPlazo, progresoDePlazo,
    textoDeSerie, textoDeVencimiento, textoDelPlazo,
} from '../../pages/agenda/plazos';

/**
 * Las piezas de las tareas CON PLAZO y de las que se repiten, en un solo
 * lugar: el detalle, las cuatro vistas de la Agenda y los dos paneles usan
 * exactamente estas, así "Vencida" se ve igual en todos lados.
 *
 * Nada de acá decide si una tarea está vencida ni cuánto falta: eso viene de
 * la base en `vencida` y `diasRestantes` (sección 39).
 */

/** La marca de vencida. Va AL LADO del chip de estado, no en lugar de él. */
export const ChipVencida: React.FC<{ grande?: boolean }> = ({ grande = false }) => (
    <span
        className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full font-bold ${grande ? 'h-[30px] pl-2.5 pr-3 text-[12.5px]' : 'h-6 pl-2 pr-2.5 text-[11.5px]'}`}
        style={{ background: VENCIDA.fondo, color: VENCIDA.tinta }}
    >
        <TriangleAlert size={grande ? 13 : 12} strokeWidth={2.6} aria-hidden="true" />
        {VENCIDA.etiqueta}
    </span>
);

/** Un punto del color de vencida, donde no entra el chip entero (el mes del teléfono). */
export const PuntoVencida: React.FC<{ tam?: number }> = ({ tam = 6 }) => (
    <span
        aria-hidden="true"
        className="flex-none rounded-full"
        style={{ width: tam, height: tam, background: VENCIDA.punto }}
    />
);

/** El ícono de las repeticiones, siempre el mismo. */
export const IconoSerie: React.FC<{ size?: number; className?: string }> = ({ size = 13, className = '' }) => (
    <Repeat size={size} strokeWidth={2.3} aria-hidden="true" className={className} />
);

/** "Se repite cada semana · 3 de 6 · del 3/11 al 12/12". */
export const LineaDeSerie: React.FC<{ tarea: Tarea; corta?: boolean }> = ({ tarea, corta = false }) => {
    const s = tarea.serie;
    if (!s) return null;
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold text-black/[.62]">
            <IconoSerie className="flex-none" />
            <span className="truncate">
                {corta
                    ? textoDeSerie(tarea)
                    : `Se repite ${s.frecuenciaTexto.toLowerCase()} · ${textoDeSerie(tarea)} · del ${diaYMes(s.desde)} al ${diaYMes(s.hasta)}`}
            </span>
        </span>
    );
};

/**
 * El plazo en el detalle: "Del 1/11 al 12/12", cuánto falta y una barra fina
 * con lo que ya pasó. La barra es la única parte decorativa, y gana su lugar:
 * de un vistazo dice si el plazo recién empieza o se está por terminar.
 */
export const BloqueDePlazo: React.FC<{ tarea: Tarea; hoy: string }> = ({ tarea, hoy }) => {
    if (!esConPlazo(tarea)) return null;
    const total = diasDePlazo(tarea);
    const avance = progresoDePlazo(tarea, hoy);
    const color = tarea.vencida ? VENCIDA.punto : tarea.subdepartamento?.color || '#0a0a0a';
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[14.5px] font-bold text-[#0a0a0a]">{textoDelPlazo(tarea)}</span>
                <span
                    className="text-[13px] font-bold"
                    style={{ color: tarea.vencida ? VENCIDA.tinta : 'rgba(0,0,0,.62)' }}
                >
                    {textoDeVencimiento(tarea)}
                </span>
            </div>
            <div
                className="h-[5px] overflow-hidden rounded-full bg-black/[.08]"
                role="img"
                aria-label={`Día ${diaDelPlazo(tarea, hoy)} de ${total} del plazo`}
            >
                <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.round(avance * 100)}%`, background: color }}
                />
            </div>
            <span className="text-[12.5px] font-semibold text-black/[.55]">
                {total} {total === 1 ? 'día' : 'días'} de plazo · se completa cualquier día
            </span>
        </div>
    );
};

/** Para quien integra un equipo: es compartida, sin decir con quién ni cómo van. */
export const EtiquetaCompartida: React.FC<{ tarea: Tarea }> = ({ tarea }) => {
    if (!tarea.compartida || !tarea.subdepartamento) return null;
    return (
        <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-[#f2f2f0] px-[9px] text-[12px] font-bold text-black/[.62]">
            <Users size={12} strokeWidth={2.2} aria-hidden="true" />
            Compartida
        </span>
    );
};

/** Para el encargado: "Diseño ya terminó · falta Video". */
export const LineaDeAvance: React.FC<{ tarea: Tarea }> = ({ tarea }) => {
    const avance = avanceDeTarea(tarea);
    if (!avance) return null;
    return <span className="w-full text-[12.5px] font-semibold leading-[1.4] text-black/[.62]">{avance}</span>;
};

/** "Plazo: 1/11 – 12/12 · faltan 9 días", para las tarjetas de los paneles. */
export const EtiquetaDePlazo: React.FC<{ tarea: Tarea }> = ({ tarea }) => {
    if (!esConPlazo(tarea)) return null;
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold"
            style={{ color: tarea.vencida ? VENCIDA.tinta : 'rgba(0,0,0,.62)' }}
        >
            Plazo: {diaYMes(tarea.fecha)} – {diaYMes(tarea.fechaHasta as string)}
            <span className="text-black/[.38]" aria-hidden="true">·</span>
            {textoDeVencimiento(tarea).toLowerCase()}
        </span>
    );
};
