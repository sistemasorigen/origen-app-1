import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMisSolicitudes, type MiSolicitud } from '../../../services/agenda';
import {
    BotonSecundario, EncabezadoSubpagina, ESTILO_TARJETA, EsqueletoDeSeccion,
    Icono, ICONOS, TARJETA, Vacio,
} from '../../../components/miCuenta/piezas';

/**
 * "Solicitudes" — lo que cada uno pidió desde /solicitudes.
 *
 * El otro lado de la misma mesa: en /departamentos los encargados ven lo que
 * les llegó, y acá quien lo pidió ve qué pasó con eso. Hasta ahora, mandada
 * la solicitud, no había dónde volver a mirarla.
 *
 * LO QUE IMPORTA ES EL ESTADO, no el texto: por eso la pastilla va arriba a
 * la derecha, donde la vista cae primero, y está escrita desde el lado de
 * quien pide ("Esperando respuesta", "No la tomaron") y no con la palabra de
 * la base ('nueva', 'rechazada'). Cuando la solicitud ya es una tarea, el
 * estado que vale es el de la tarea: que esté "asignada" no le dice nada a
 * quien pidió, que esté lista sí.
 *
 * Datos: services/agenda.ts → agenda_mis_solicitudes(), que filtra por
 * auth.uid() en la base. Acá no se pide por persona ni se podría.
 */

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** '2026-10-23T…' → '23 de octubre', con el año sólo si no es éste. */
const fechaDePedido = (ts: string | null): string => {
    if (!ts) return '';
    const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    const anio = d.getFullYear() === new Date().getFullYear() ? '' : ` de ${d.getFullYear()}`;
    return `${d.getDate()} de ${MESES[d.getMonth()]}${anio}`;
};

type Tono = 'espera' | 'bien' | 'no';

const TONO: Record<Tono, React.CSSProperties> = {
    espera: { background: 'var(--mc-chip)', color: 'var(--mc-m66)' },
    bien: { background: 'var(--mc-green-bg)', color: 'var(--mc-green-ink)' },
    no: { background: 'var(--mc-chip)', color: 'var(--mc-m50)' },
};

/**
 * Qué decir de una solicitud, en una palabra.
 *
 * 'aceptada' y 'asignada' son dos pasos de lo mismo para quien pidió —alguien
 * se hizo cargo—, así que lo que cambia el texto es la tarea: mientras está
 * en proceso, "En marcha"; cuando se completó, "Lista".
 */
const comoEsta = (s: MiSolicitud): { texto: string; tono: Tono } => {
    if (s.estado === 'rechazada') return { texto: 'No la tomaron', tono: 'no' };
    if (s.tarea) {
        return s.tarea.estado === 'completada'
            ? { texto: 'Lista', tono: 'bien' }
            : { texto: 'En marcha', tono: 'bien' };
    }
    if (s.estado === 'aceptada' || s.estado === 'asignada') return { texto: 'Aceptada', tono: 'bien' };
    return { texto: 'Esperando respuesta', tono: 'espera' };
};

const Pastilla: React.FC<{ texto: string; tono: Tono }> = ({ texto, tono }) => (
    <span
        className="inline-flex flex-none items-center h-[26px] px-2.5 rounded-full text-[12.5px] font-bold"
        style={TONO[tono]}
    >
        {texto}
    </span>
);

const Tarjeta: React.FC<{ s: MiSolicitud }> = ({ s }) => {
    const [abierta, setAbierta] = useState(false);
    const estado = comoEsta(s);
    // Cuatro líneas entran sin tapar lo de abajo; el tope de la base son
    // 2000 caracteres, así que sin recorte una sola solicitud se come la
    // pantalla entera.
    const largo = s.detalles.length > 180;

    return (
        <div className={`${TARJETA} p-4`} style={ESTILO_TARJETA}>
            <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex items-center gap-2">
                    <span
                        className="w-[9px] h-[9px] rounded-full flex-none"
                        style={{ background: s.departamento.color || 'var(--mc-m38)' }}
                    />
                    <span className="text-[15px] font-semibold leading-[1.3] truncate">
                        {s.departamento.nombre}
                    </span>
                </span>
                <Pastilla texto={estado.texto} tono={estado.tono} />
            </div>

            <p
                className={`mb-0 mt-2.5 text-[14px] font-medium leading-[1.5] ${largo && !abierta ? 'line-clamp-4' : ''}`}
                style={{ color: 'var(--mc-m66)' }}
            >
                {s.detalles}
            </p>
            {largo && (
                <button
                    type="button"
                    onClick={() => setAbierta(v => !v)}
                    className="mt-1.5 border-0 bg-transparent p-0 font-[inherit] text-[13.5px] font-semibold cursor-pointer"
                    style={{ color: 'var(--mc-ink)' }}
                >
                    {abierta ? 'Ver menos' : 'Ver más'}
                </button>
            )}

            <p className="mb-0 mt-2.5 text-[13px] font-medium leading-[1.45]" style={{ color: 'var(--mc-m50)' }}>
                {s.prioridad && <>{s.prioridad.nombre} · </>}
                Pedida el {fechaDePedido(s.createdAt)}
                {s.estado === 'rechazada' && s.revisadaAt && <> · Revisada el {fechaDePedido(s.revisadaAt)}</>}
            </p>

            {s.tarea && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--mc-line)' }}>
                    <p className="m-0 text-[12.5px] font-semibold" style={{ color: 'var(--mc-m50)' }}>
                        {s.tarea.estado === 'completada' ? 'Se hizo' : 'Ya es una tarea del equipo'}
                    </p>
                    <p className="mb-0 mt-1 text-[14px] font-semibold leading-[1.35]">{s.tarea.nombre}</p>
                </div>
            )}
        </div>
    );
};

export const MisSolicitudes: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => {
    const navigate = useNavigate();
    const [lista, setLista] = useState<MiSolicitud[] | null>(null);
    const [falló, setFalló] = useState(false);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        let vigente = true;
        setLista(null);
        setFalló(false);
        getMisSolicitudes().then(r => {
            if (!vigente) return;
            // Una consulta que falla NO es "no pediste nada": decirlo sería
            // mentirle a alguien que sí pidió y viene a ver en qué quedó.
            if (r.ok) setLista(r.solicitudes);
            else setFalló(true);
        });
        return () => { vigente = false; };
    }, [intento]);

    return (
        <>
            <EncabezadoSubpagina titulo="Solicitudes" onVolver={onVolver} />
            {falló ? (
                <Vacio
                    icono={ICONOS.solicitud}
                    titulo="No pudimos traer tus solicitudes"
                    detalle="Puede ser la conexión. Probá de nuevo en un momento; lo que pediste no se perdió."
                    accion={{ texto: 'Reintentar', onClick: () => setIntento(n => n + 1) }}
                />
            ) : lista === null ? <EsqueletoDeSeccion filas={2} />
                : lista.length === 0 ? (
                    <Vacio
                        icono={ICONOS.solicitud}
                        titulo="Todavía no pediste nada"
                        detalle="Podés pedirle algo a un departamento: un flyer, un video, una mano con lo que haga falta. Acá vas a ver en qué quedó cada pedido."
                        accion={{ texto: 'Hacer una solicitud', onClick: () => navigate('/solicitudes') }}
                    />
                ) : (
                    <>
                        <div className="mt-6 flex flex-col gap-3">
                            {lista.map(s => <Tarjeta key={s.id} s={s} />)}
                        </div>
                        <BotonSecundario ancho className="mt-3" onClick={() => navigate('/solicitudes')}>
                            <span className="inline-flex items-center gap-2">
                                <Icono d={ICONOS.solicitud} tam={17} grosor={1.9} />
                                Hacer otra solicitud
                            </span>
                        </BotonSecundario>
                    </>
                )}
        </>
    );
};

export default MisSolicitudes;
