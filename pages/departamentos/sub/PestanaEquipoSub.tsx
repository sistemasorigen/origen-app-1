import React from 'react';
import type { PanelSubdepartamento } from '../../../services/agenda';
import { Avatar, plural } from '../../admin/departamentos/piezas';
import { ROTULO, TARJETA } from '../equipo/piezas';

/**
 * El equipo del sub-departamento, de solo lectura
 * (design-claude/Sub-departamento - Panel, pestaña Equipo).
 *
 * Quien dirige ve quiénes son y a quién recurrir, y nada más: sumar, mover o
 * quitar gente es del encargado del departamento. Mostrar acá un botón que
 * va a decir "no tenés permiso" sería peor que no mostrarlo, así que en vez
 * del botón está el camino: con quién hablar.
 *
 * Nombres y fotos nada más. agenda_subdepartamento devuelve sólo eso de cada
 * persona —ni emails ni teléfonos—, que es lo que esta pantalla necesita.
 */

const PestanaEquipoSub: React.FC<{ datos: PanelSubdepartamento }> = ({ datos }) => {
    const { subdepartamento: sub, lider, miembros, encargados } = datos;

    return (
        <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3.5">
                <section aria-labelledby="sub-dirige" className={`${TARJETA} p-5`}>
                    <h2 id="sub-dirige" className={`${ROTULO} mb-3`}>Quién lo dirige</h2>
                    <div className="flex items-center gap-3">
                        {lider
                            ? <Avatar persona={lider} color={sub.color} tam={50} />
                            : <span className="h-[50px] w-[50px] flex-none rounded-full bg-[#f2f2f0]" aria-hidden="true" />}
                        <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[16.5px] font-bold">{lider?.nombre || 'Nadie todavía'}</p>
                            <p className="m-0 mt-0.5 text-[13px] font-semibold text-black/[.58]">
                                {sub.nombre} · {datos.departamento.nombre}
                            </p>
                        </div>
                    </div>
                </section>

                <section aria-labelledby="sub-integrantes" className={`${TARJETA} p-5`}>
                    <h2 id="sub-integrantes" className={`${ROTULO} mb-2.5`}>
                        Integrantes · {miembros.length}
                    </h2>
                    {miembros.length === 0 ? (
                        <p className="m-0 py-2 text-[14px] font-semibold text-black/[.58]">
                            Todavía no hay integrantes además de quien lo dirige.
                        </p>
                    ) : (
                        <ul className="m-0 flex list-none flex-col p-0">
                            {miembros.map(m => (
                                <li key={m.id} className="flex min-h-[56px] items-center gap-3 border-b border-black/[.05] last:border-0">
                                    <Avatar persona={m} color={sub.color} tam={38} />
                                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                                        {m.nombre || 'Sin nombre'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="m-0 mt-3.5 text-[12.5px] font-semibold leading-[1.5] text-black/[.58]">
                        {plural(miembros.length + (lider ? 1 : 0), 'persona en el equipo', 'personas en el equipo')}.
                        Para cambios en el equipo, hablá con los encargados del departamento.
                    </p>
                </section>
            </div>

            <section aria-labelledby="sub-encargados" className={`${TARJETA} p-5`}>
                <h2 id="sub-encargados" className={ROTULO}>Encargados del departamento</h2>
                <p className="m-0 mb-3 mt-1.5 text-[13px] font-medium leading-[1.5] text-black/[.62]">
                    Para cambios en el equipo, hablá con ellos.
                </p>
                {encargados.length === 0 ? (
                    <p className="m-0 py-2 text-[14px] font-semibold text-black/[.58]">
                        Este departamento no tiene encargados cargados.
                    </p>
                ) : (
                    <ul className="m-0 flex list-none flex-col p-0">
                        {encargados.map(e => (
                            <li key={e.id} className="flex min-h-[56px] items-center gap-3">
                                <Avatar persona={e} color={datos.departamento.color} tam={38} />
                                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                                    {e.nombre || 'Sin nombre'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default PestanaEquipoSub;
