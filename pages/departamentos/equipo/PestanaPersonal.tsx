import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { cambiarEncargados, mensajeDeMotivo, type Persona } from '../../../services/agenda';
import { useAccesoAgenda } from '../../../hooks/useAccesoAgenda';
import { Avatar } from '../../admin/departamentos/piezas';
import HojaPersonas from './HojaPersonas';
import { useAccionesDeEquipo } from './accionesDeEquipo';
import { BOTON_CHICO, BOTON_ICONO, Mensaje, Punto, ROTULO, TARJETA, usePanel } from './piezas';

/**
 * Personal (design-claude/Departamento - Equipo): los encargados del
 * departamento y, debajo, un bloque por sub-departamento con quien lo dirige
 * y sus integrantes. En la compu se lee como un organigrama: una línea baja
 * de los encargados a la fila de equipos.
 *
 * Los encargados se guardan siempre con la lista completa
 * (agenda_cambiar_encargados) y nunca quedan en cero: la ✕ del último está
 * apagada. Si quien edita se saca a sí mismo, deja de ver el departamento:
 * se le avisa fuerte y, al guardar, vuelve a /departamentos.
 */

const integrantes = (n: number) => `${n} ${n === 1 ? 'integrante' : 'integrantes'}`;

const PestanaPersonal: React.FC = () => {
    const { datos, recargar, avisar, confirmar, ir, miId, soySuperAdmin } = usePanel();
    const { recargar: recargarAcceso } = useAccesoAgenda();
    const navigate = useNavigate();
    const acciones = useAccionesDeEquipo();
    const [agregando, setAgregando] = useState(false);
    const { departamento: dep, encargados, subdepartamentos } = datos;

    const guardarEncargados = async (lista: Persona[], meSaco: boolean): Promise<boolean> => {
        const r = await cambiarEncargados(dep.id, lista.map(p => p.id));
        if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return false; }
        if (meSaco) {
            await recargarAcceso();
            avisar(`Ya no administrás ${dep.nombre}.`);
            navigate('/departamentos');
            return true;
        }
        await Promise.all([recargar(), recargarAcceso()]);
        return true;
    };

    const pedirQuitar = (e: Persona) => {
        const resto = encargados.filter(x => x.id !== e.id);
        const soyYo = e.id === miId;
        // SUPER_ADMIN sigue administrando todo aunque se saque: para él no es la confirmación fuerte.
        if (soyYo && !soySuperAdmin) {
            confirmar({
                tipo: 'destructivo',
                rotulo: 'Tu acceso',
                titulo: 'Vas a dejar de administrar este departamento',
                texto: `Si te sacás de los encargados, ${dep.nombre} deja de aparecer en tu lista y no vas a poder volver a entrar. Lo pueden volver a sumar los otros encargados o Sistemas.`,
                etiquetaBoton: 'Sí, sacarme',
                onConfirmar: () => { guardarEncargados(resto, true); },
            });
            return;
        }
        confirmar({
            tipo: 'control',
            rotulo: 'Encargados',
            titulo: `¿Quitar a ${e.nombre || 'esta persona'} de los encargados?`,
            texto: `Deja de administrar ${dep.nombre}. Si también está en un sub-departamento, sigue ahí.`,
            etiquetaBoton: 'Quitar',
            onConfirmar: async () => {
                if (await guardarEncargados(resto, false)) avisar(`${e.nombre || 'La persona'} ya no está entre quienes administran ${dep.nombre}.`);
            },
        });
    };

    const columnas = Math.min(4, Math.max(1, subdepartamentos.length));

    return (
        <>
            <section aria-labelledby="personal-encargados" className={`${TARJETA} px-[22px] py-5`}>
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="min-w-[200px] flex-1">
                        <h2 id="personal-encargados" className={ROTULO}>Encargados del departamento</h2>
                        <p className="m-0 mt-1 text-[13px] font-medium text-black/[.62]">Administran todo {dep.nombre}: equipos, tareas, prioridades y solicitudes.</p>
                    </div>
                    <button type="button" onClick={() => setAgregando(true)} className={BOTON_CHICO}>
                        <Plus size={16} strokeWidth={2.4} aria-hidden="true" />Agregar
                    </button>
                </div>
                <ul className="m-0 mt-3.5 flex list-none flex-wrap gap-2 p-0">
                    {encargados.map(e => {
                        const ultimo = encargados.length === 1;
                        return (
                            <li key={e.id} className="flex h-11 items-center gap-2 rounded-full bg-[#f2f2f0] pl-1 text-[13.5px] font-bold">
                                <Avatar persona={e} color={dep.color} tam={34} />
                                <span className="max-w-[200px] truncate">{e.nombre || 'Sin nombre'}{e.id === miId ? ' (vos)' : ''}</span>
                                <button
                                    type="button"
                                    onClick={() => pedirQuitar(e)}
                                    disabled={ultimo}
                                    title={ultimo ? 'Tiene que quedar al menos un encargado.' : undefined}
                                    aria-label={ultimo ? `${e.nombre || 'Esta persona'} es la única persona a cargo: no se puede quitar` : `Quitar a ${e.nombre || 'esta persona'} de los encargados`}
                                    className={`${BOTON_ICONO} disabled:cursor-not-allowed`}
                                >
                                    <X size={14} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {encargados.length === 1 && (
                    <p className="m-0 mt-2.5 text-[12.5px] font-semibold text-black/[.55]">Tiene que quedar al menos un encargado: para quitar a esta persona, primero sumá a otra.</p>
                )}
            </section>

            {subdepartamentos.length === 0 ? (
                <Mensaje titulo="Todavía no hay sub-departamentos" texto="Cuando armes los equipos, acá vas a ver quién dirige cada uno y quiénes lo integran.">
                    <button type="button" onClick={() => ir('subdepartamentos', null)} className={`${BOTON_CHICO} mt-4`}>Ir a Sub-departamentos</button>
                </Mensaje>
            ) : (
                <>
                    {/* La línea del organigrama: de los encargados a los equipos. */}
                    <div aria-hidden="true" className="hidden justify-center md:flex"><span className="h-[22px] w-0.5 bg-black/[.12]" /></div>
                    <div className="h-3.5 md:hidden" />
                    <div
                        className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 md:border-t-2 md:border-black/[.08] md:pt-4 min-[1100px]:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
                        style={{ '--cols': columnas } as React.CSSProperties}
                    >
                        {subdepartamentos.map(s => (
                            <section key={s.id} aria-label={s.nombre} className={`${TARJETA} overflow-hidden`}>
                                <div className="flex items-center gap-2.5 border-b border-black/[.05] px-4 py-3.5" style={{ boxShadow: `inset 0 3px 0 ${s.color}` }}>
                                    <Punto color={s.color} tam={10} />
                                    <h3 className="m-0 min-w-0 flex-1 truncate text-[15.5px] font-bold">{s.nombre}</h3>
                                    <span className="whitespace-nowrap text-[12.5px] font-semibold text-black/[.58]">{integrantes(s.cantMiembros)}</span>
                                </div>
                                <div className="px-4 pb-4 pt-3.5">
                                    <div className="flex items-center gap-2.5 rounded-[18px] bg-[#f6f6f4] p-2.5">
                                        {s.lider ? <Avatar persona={s.lider} color={s.color} tam={36} /> : <span className="h-9 w-9 flex-none rounded-full bg-white" aria-hidden="true" />}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-black/[.58]">Dirige</span>
                                            <span className="block truncate text-[14px] font-bold">{s.lider?.nombre || 'Nadie todavía'}</span>
                                        </span>
                                        <button type="button" onClick={() => acciones.cambiarQuienDirige(s)} aria-label={`Cambiar quién dirige ${s.nombre}`} className={`${BOTON_CHICO} bg-white`}>Cambiar</button>
                                    </div>
                                    {s.miembros.length > 0 ? (
                                        <ul className="m-0 ml-[26px] mt-1.5 flex list-none flex-col border-l-2 border-black/[.08] p-0 pl-3.5">
                                            {s.miembros.map(m => (
                                                <li key={m.id} className="flex min-h-[48px] items-center gap-2.5">
                                                    <Avatar persona={m} color={s.color} tam={30} />
                                                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{m.nombre || 'Sin nombre'}</span>
                                                    <button type="button" onClick={() => acciones.abrirMenu(s, m)} aria-label={`Opciones para ${m.nombre || 'esta persona'}`} className={BOTON_ICONO}>
                                                        <MoreHorizontal size={18} strokeWidth={2.4} aria-hidden="true" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="m-0 ml-[26px] mt-2 border-l-2 border-black/[.08] py-2 pl-3.5 text-[13px] font-semibold text-black/[.55]">Sin integrantes todavía.</p>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>
                </>
            )}

            {acciones.nodo}

            {agregando && (
                <HojaPersonas
                    titulo="Agregar encargados"
                    subtitulo={`Van a administrar todo ${dep.nombre}.`}
                    excluir={encargados.map(e => e.id)}
                    color={dep.color}
                    etiqueta={n => (n > 1 ? `Agregar ${n}` : 'Agregar')}
                    etiquetaBusqueda="Buscar personas para sumar como encargados"
                    textoAgregar="Elegir"
                    onAceptar={async personas => {
                        const ok = await guardarEncargados([...encargados, ...personas], false);
                        if (ok) avisar(personas.length === 1 ? `${personas[0].nombre || 'La persona'} ya administra ${dep.nombre}.` : `Se sumaron ${personas.length} encargados.`);
                        return ok;
                    }}
                    onCerrar={() => setAgregando(false)}
                />
            )}
        </>
    );
};

export default PestanaPersonal;
