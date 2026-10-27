import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useAccesoAgenda } from '../../hooks/useAccesoAgenda';
import { IconoDeDepartamento, nombreDePila, tinte } from '../admin/departamentos/piezas';
import { BOTON_NEGRO, ESTILOS, ID_AGENDA, Mensaje, ROTULO } from './equipo/piezas';

/**
 * /departamentos — design-claude/Departamentos - Inicio.dc.html.
 *
 * Los departamentos que administra quien entra (los de agenda_mi_acceso;
 * SUPER_ADMIN los ve todos), en tarjetas grandes con lo que hay en proceso y
 * lo que espera asignación. Tocar una lleva a /departamentos/:id. Con uno
 * solo igual se muestra esta pantalla: es el lugar al que se vuelve.
 *
 * Al entrar se piden los números de nuevo (el acceso queda en memoria toda la
 * sesión, pero lo que hay en proceso cambia). La recarga no esconde lo que
 * ya se ve.
 *
 * Todavía no: las solicitudes nuevas (prompt 5) ni "Sub-departamentos que
 * dirijo" (prompt 6).
 */

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const DepartamentosInicio: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { cargando, fallo, acceso, recargar } = useAccesoAgenda();

    // Si el acceso ya estaba en memoria, se piden los números de nuevo; si se
    // está trayendo por primera vez, esa misma respuesta alcanza.
    useEffect(() => { if (!cargando) recargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const deptos = acceso.encargado;
    const nombre = nombreDePila(user?.name ?? null);

    return (
        <div id={ID_AGENDA} className="min-h-screen bg-[#f6f6f4]">
            <style>{ESTILOS}</style>
            <div className="mx-auto max-w-[1080px] px-4 pb-12 pt-6 md:px-8 md:pt-8">
                <p className={ROTULO}>Administración</p>
                <h1 className="m-0 mt-1 text-[26px] font-bold tracking-[-0.025em] md:text-[32px]">Departamentos</h1>
                {!cargando && !fallo && deptos.length > 0 && (
                    <p className="m-0 mt-2 text-[14.5px] font-medium leading-[1.55] text-black/[.62]">
                        Hola {nombre}. {acceso.superAdmin ? 'Estos son todos los departamentos de Agenda Origen.' : 'Estos son los equipos que tenés a cargo.'}
                    </p>
                )}

                {cargando && (
                    <div aria-busy="true" aria-label="Cargando tus departamentos" className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                        <div className="h-[180px] rounded-[28px] bg-white motion-safe:animate-[depBrillo_1.2s_infinite]" />
                        <div className="h-[180px] rounded-[28px] bg-white motion-safe:animate-[depBrillo_1.2s_.15s_infinite]" />
                    </div>
                )}

                {!cargando && fallo && (
                    <Mensaje titulo="No pudimos cargar tus departamentos" texto="Puede ser la conexión. Probá de nuevo en un momento.">
                        <button type="button" onClick={() => recargar()} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                    </Mensaje>
                )}

                {!cargando && !fallo && deptos.length === 0 && (
                    <Mensaje
                        icono={<LayoutGrid size={26} strokeWidth={1.75} />}
                        titulo="No tenés departamentos a cargo"
                        texto="Esta pantalla es para quienes administran un departamento de Agenda Origen. Si te llegó un link y creés que deberías verlo, pedíselo a quien coordina tu área o a Sistemas."
                    >
                        <button type="button" onClick={() => navigate('/')} className={`${BOTON_NEGRO} mt-5`}>Ir al inicio</button>
                    </Mensaje>
                )}

                {!cargando && !fallo && deptos.length > 0 && (
                    <>
                        <h2 className={`${ROTULO} mx-1 mb-3 mt-7`}>{acceso.superAdmin ? 'Todos los departamentos' : 'Mis departamentos'}</h2>
                        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                            {deptos.map(d => (
                                <li key={d.id}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/departamentos/${d.id}`)}
                                        className="flex w-full flex-col gap-[18px] rounded-[28px] bg-white p-[22px] text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        <span className="flex items-center gap-3.5">
                                            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full" style={{ background: tinte(d.color), color: d.color }}>
                                                <IconoDeDepartamento clave={d.icono} tam={26} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[20px] font-bold tracking-[-0.015em] text-[#0a0a0a]">{d.nombre}</span>
                                                <span className="mt-[3px] block text-[13px] font-semibold text-black/[.58]">{acceso.superAdmin ? 'Súper Admin' : 'Lo administrás'}</span>
                                            </span>
                                        </span>
                                        <span className="flex items-center gap-2.5 border-t border-black/[.06] pt-4">
                                            <span className="flex-1 text-[14px] font-semibold leading-[1.45] text-black/[.62]">
                                                {plural(d.enProceso, 'en proceso', 'en proceso')} · {plural(d.esperando, 'esperando asignación', 'esperando asignación')}
                                            </span>
                                            <ChevronRight size={18} strokeWidth={2.2} className="flex-none text-black/[.38]" aria-hidden="true" />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default DepartamentosInicio;
