import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { PendingStatus, Baptism } from '../../types';
import { Droplets, Check, Trash2, Pencil, Plus, Undo2 } from 'lucide-react';
import {
    TarjetaDelPunto, CabeceraGrupo, ListaDeFilas, Fila,
    BotonCircular, BotonPrincipal, Pastilla, EstadoVacio, fechaCorta,
} from '../../components/info-point/ListaDelPunto';

/**
 * Los bautismos anotados.
 *
 * La pregunta del mostrador es quién falta, así que arriba van los que
 * esperan y abajo los que ya se bautizaron. Antes era una sola lista donde
 * los realizados se mezclaban con los pendientes y había que leer la chapita
 * de cada uno para saber cuál era cuál.
 */
const Baptisms: React.FC = () => {
    const navigate = useNavigate();
    const { baptisms, updateBaptism, deleteBaptism, showNotification } = useStore();

    const { pendientes, hechos } = useMemo(() => ({
        pendientes: baptisms.filter(b => b.isPending),
        hechos: baptisms.filter(b => !b.isPending),
    }), [baptisms]);

    const cambiarEstado = async (b: Baptism, status: PendingStatus) => {
        const datos: any = { ...b, status, isPending: status === PendingStatus.PENDING ? 1 : 0 };
        datos.completionDate = status === PendingStatus.COMPLETED ? new Date().toISOString() : undefined;
        await updateBaptism(datos);
        showNotification(status === PendingStatus.COMPLETED ? 'Bautismo marcado como realizado.' : 'Volvió a la lista de espera.');
    };

    const borrar = async (b: Baptism, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`¿Eliminar el registro de ${b.firstName} ${b.lastName}? No se puede deshacer.`)) return;
        await deleteBaptism(b.id);
        showNotification('Registro eliminado.');
    };

    return (
        <TarjetaDelPunto
            titulo="Bautismos"
            bajada="Quién se anotó y quién ya se bautizó."
            acciones={
                <BotonPrincipal icono={Plus} onClick={() => navigate('/punto-de-informacion/bautismos/nuevo')}>
                    Nuevo bautismo
                </BotonPrincipal>
            }
        >
            {pendientes.length > 0 && (
                <section>
                    <CabeceraGrupo cuenta={`${pendientes.length} esperando`}>En espera</CabeceraGrupo>
                    <ListaDeFilas>
                        {pendientes.map(b => (
                            <Fila key={b.id}>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-[15px] text-black truncate leading-tight">{b.firstName} {b.lastName}</h4>
                                    <p className="text-[13px] text-slate-400 truncate mt-0.5">
                                        Se anotó el {fechaCorta(b.registrationDate)}{b.phone ? ` · ${b.phone}` : ''}
                                    </p>
                                </div>
                                <BotonCircular
                                    icono={Check}
                                    tono="listo"
                                    etiqueta={`Marcar el bautismo de ${b.firstName} ${b.lastName} como realizado`}
                                    onClick={() => cambiarEstado(b, PendingStatus.COMPLETED)}
                                />
                                <BotonCircular
                                    icono={Pencil}
                                    etiqueta={`Editar ${b.firstName} ${b.lastName}`}
                                    onClick={() => navigate(`/punto-de-informacion/bautismos/nuevo?id=${b.id}`)}
                                />
                                <BotonCircular
                                    icono={Trash2}
                                    tono="peligro"
                                    etiqueta={`Eliminar ${b.firstName} ${b.lastName}`}
                                    onClick={e => borrar(b, e)}
                                />
                            </Fila>
                        ))}
                    </ListaDeFilas>
                </section>
            )}

            {hechos.length > 0 && (
                <section>
                    <CabeceraGrupo cuenta={`${hechos.length} en total`}>Ya se bautizaron</CabeceraGrupo>
                    <ListaDeFilas>
                        {hechos.map(b => (
                            <Fila key={b.id}>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-[15px] text-black truncate leading-tight">{b.firstName} {b.lastName}</h4>
                                    <p className="text-[13px] text-slate-400 truncate mt-0.5">
                                        {b.completionDate ? `El ${fechaCorta(b.completionDate)}` : b.status}
                                    </p>
                                </div>
                                {b.status === PendingStatus.CANCELLED
                                    ? <Pastilla tono="mala">Cancelado</Pastilla>
                                    : <Pastilla tono="buena">Listo</Pastilla>}
                                <BotonCircular
                                    icono={Undo2}
                                    etiqueta={`Devolver a ${b.firstName} ${b.lastName} a la lista de espera`}
                                    onClick={() => cambiarEstado(b, PendingStatus.PENDING)}
                                />
                                <BotonCircular
                                    icono={Trash2}
                                    tono="peligro"
                                    etiqueta={`Eliminar ${b.firstName} ${b.lastName}`}
                                    onClick={e => borrar(b, e)}
                                />
                            </Fila>
                        ))}
                    </ListaDeFilas>
                </section>
            )}

            {baptisms.length === 0 && (
                <EstadoVacio
                    icono={Droplets}
                    titulo="Todavía no hay nadie anotado"
                    texto="Cuando alguien quiera bautizarse, anotalo acá y queda en la lista de espera."
                    accion={{ texto: 'Anotar el primero', icono: Plus, onClick: () => navigate('/punto-de-informacion/bautismos/nuevo') }}
                />
            )}
        </TarjetaDelPunto>
    );
};

export default Baptisms;
