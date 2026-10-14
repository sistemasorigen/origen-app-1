import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { PendingStatus, ChildPresentation } from '../../types';
import { Baby, Check, Trash2, Pencil, Plus, Undo2 } from 'lucide-react';
import {
    TarjetaDelPunto, CabeceraGrupo, ListaDeFilas, Fila,
    BotonCircular, BotonPrincipal, Pastilla, EstadoVacio, fechaCorta,
} from '../../components/info-point/ListaDelPunto';

/**
 * Las presentaciones de niños.
 *
 * Arriba las que faltan, con la fecha agendada a la vista —que es el dato que
 * se busca—, y abajo las que ya se hicieron. El nombre de los padres va en la
 * línea de abajo: es lo que permite reconocer a la familia cuando llega.
 */
const ChildPresentations: React.FC = () => {
    const navigate = useNavigate();
    const { presentations, updatePresentation, deletePresentation, showNotification } = useStore();

    const { pendientes, hechas } = useMemo(() => ({
        // Las agendadas primero, por fecha; las que todavía no tienen fecha, al final.
        pendientes: presentations.filter(p => p.isPending).sort((a, b) => {
            if (!a.scheduledDate) return 1;
            if (!b.scheduledDate) return -1;
            return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
        }),
        hechas: presentations.filter(p => !p.isPending),
    }), [presentations]);

    const padres = (p: ChildPresentation) => {
        const mama = [p.motherName, p.motherSurname].filter(Boolean).join(' ');
        const papa = [p.fatherName, p.fatherSurname].filter(Boolean).join(' ');
        const ambos = [mama, papa].filter(Boolean);
        return ambos.length ? `Hijo de ${ambos.join(' y ')}` : (p.phone || '');
    };

    const cambiarEstado = async (p: ChildPresentation, status: PendingStatus) => {
        const datos: any = { ...p, status, isPending: status === PendingStatus.PENDING ? 1 : 0 };
        datos.completionDate = status === PendingStatus.COMPLETED ? new Date().toISOString() : undefined;
        await updatePresentation(datos);
        showNotification(status === PendingStatus.COMPLETED ? 'Presentación marcada como realizada.' : 'Volvió a la agenda.');
    };

    const borrar = async (p: ChildPresentation, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`¿Eliminar la presentación de ${p.childName} ${p.childSurname}? No se puede deshacer.`)) return;
        await deletePresentation(p.id);
        showNotification('Registro eliminado.');
    };

    return (
        <TarjetaDelPunto
            titulo="Presentaciones"
            bajada="Los chicos que se van a presentar y los que ya se presentaron."
            acciones={
                <BotonPrincipal icono={Plus} onClick={() => navigate('/punto-de-informacion/presentacion-ninos/nuevo')}>
                    Nueva presentación
                </BotonPrincipal>
            }
        >
            {pendientes.length > 0 && (
                <section>
                    <CabeceraGrupo cuenta={`${pendientes.length} en agenda`}>Por hacer</CabeceraGrupo>
                    <ListaDeFilas>
                        {pendientes.map(p => (
                            <Fila key={p.id}>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-[15px] text-black truncate leading-tight">{p.childName} {p.childSurname}</h4>
                                    <p className="text-[13px] text-slate-400 truncate mt-0.5">{padres(p)}</p>
                                </div>
                                {p.scheduledDate
                                    ? <Pastilla tono="aviso">{fechaCorta(p.scheduledDate)}</Pastilla>
                                    : <Pastilla>Sin fecha</Pastilla>}
                                <BotonCircular
                                    icono={Check}
                                    tono="listo"
                                    etiqueta={`Marcar la presentación de ${p.childName} ${p.childSurname} como realizada`}
                                    onClick={() => cambiarEstado(p, PendingStatus.COMPLETED)}
                                />
                                <BotonCircular
                                    icono={Pencil}
                                    etiqueta={`Editar ${p.childName} ${p.childSurname}`}
                                    onClick={() => navigate(`/punto-de-informacion/presentacion-ninos/nuevo?id=${p.id}`)}
                                />
                                <BotonCircular
                                    icono={Trash2}
                                    tono="peligro"
                                    etiqueta={`Eliminar ${p.childName} ${p.childSurname}`}
                                    onClick={e => borrar(p, e)}
                                />
                            </Fila>
                        ))}
                    </ListaDeFilas>
                </section>
            )}

            {hechas.length > 0 && (
                <section>
                    <CabeceraGrupo cuenta={`${hechas.length} en total`}>Ya se presentaron</CabeceraGrupo>
                    <ListaDeFilas>
                        {hechas.map(p => (
                            <Fila key={p.id}>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-[15px] text-black truncate leading-tight">{p.childName} {p.childSurname}</h4>
                                    <p className="text-[13px] text-slate-400 truncate mt-0.5">
                                        {p.completionDate ? `El ${fechaCorta(p.completionDate)}` : p.status}
                                    </p>
                                </div>
                                {p.status === PendingStatus.CANCELLED
                                    ? <Pastilla tono="mala">Cancelada</Pastilla>
                                    : <Pastilla tono="buena">Listo</Pastilla>}
                                <BotonCircular
                                    icono={Undo2}
                                    etiqueta={`Devolver la presentación de ${p.childName} ${p.childSurname} a la agenda`}
                                    onClick={() => cambiarEstado(p, PendingStatus.PENDING)}
                                />
                                <BotonCircular
                                    icono={Trash2}
                                    tono="peligro"
                                    etiqueta={`Eliminar ${p.childName} ${p.childSurname}`}
                                    onClick={e => borrar(p, e)}
                                />
                            </Fila>
                        ))}
                    </ListaDeFilas>
                </section>
            )}

            {presentations.length === 0 && (
                <EstadoVacio
                    icono={Baby}
                    titulo="No hay presentaciones agendadas"
                    texto="Cuando una familia quiera presentar a su hijo, anotala acá con la fecha."
                    accion={{ texto: 'Agendar la primera', icono: Plus, onClick: () => navigate('/punto-de-informacion/presentacion-ninos/nuevo') }}
                />
            )}
        </TarjetaDelPunto>
    );
};

export default ChildPresentations;
