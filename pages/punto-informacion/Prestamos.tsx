import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Loan } from '../../types';
import { Shirt, Trash2, Plus, Undo2 } from 'lucide-react';
import {
    TarjetaDelPunto, CabeceraGrupo, ListaDeFilas, Fila,
    BotonCircular, BotonPrincipal, Pastilla, EstadoVacio, fechaCorta,
} from '../../components/info-point/ListaDelPunto';

/**
 * Lo que se prestó.
 *
 * La pregunta es siempre la misma: qué salió y no volvió. Por eso arriba van
 * los que faltan devolver —con los días que llevan afuera, que es lo que
 * decide si hay que ir a buscarlo— y abajo los que ya volvieron.
 */

/** "Hoy", "Ayer", "Hace 5 días". */
const hace = (iso: string) => {
    const dia = 86400000;
    const desde = new Date(iso);
    if (Number.isNaN(desde.getTime())) return '';
    const dias = Math.floor((Date.now() - desde.getTime()) / dia);
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Ayer';
    return `Hace ${dias} días`;
};

const Loans: React.FC = () => {
    const navigate = useNavigate();
    const { loans, updateLoan, deleteLoan, showNotification } = useStore();

    const { afuera, devueltos } = useMemo(() => ({
        // El que más tiempo lleva afuera, primero.
        afuera: loans.filter(l => l.status === 'ACTIVE')
            .sort((a, b) => new Date(a.loanDate).getTime() - new Date(b.loanDate).getTime()),
        devueltos: loans.filter(l => l.status === 'RETURNED')
            .sort((a, b) => new Date(b.returnDate || b.loanDate).getTime() - new Date(a.returnDate || a.loanDate).getTime()),
    }), [loans]);

    const devolver = async (l: Loan) => {
        try {
            await updateLoan({ ...l, status: 'RETURNED', returnDate: new Date().toISOString() });
            showNotification('Devolución registrada.');
        } catch (error) {
            console.error('Error updating loan:', error);
            showNotification('No se pudo registrar la devolución.', 'error');
        }
    };

    const borrar = async (l: Loan, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`¿Eliminar el préstamo de ${l.lenderName} ${l.lenderSurname}? No se puede deshacer.`)) return;
        await deleteLoan(l.id);
        showNotification('Registro eliminado.');
    };

    return (
        <TarjetaDelPunto
            titulo="Préstamos"
            bajada="Qué salió del mostrador y todavía no volvió."
            acciones={
                <BotonPrincipal icono={Plus} onClick={() => navigate('/punto-de-informacion/prestamos/nuevo')}>
                    Nuevo préstamo
                </BotonPrincipal>
            }
        >
            {afuera.length > 0 && (
                <section>
                    <CabeceraGrupo cuenta={`${afuera.length} sin devolver`}>Afuera</CabeceraGrupo>
                    <ListaDeFilas>
                        {afuera.map(l => (
                            <Fila key={l.id}>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-[15px] text-black truncate leading-tight">{l.lenderName} {l.lenderSurname}</h4>
                                    <p className="text-[13px] text-slate-400 truncate mt-0.5">
                                        {l.itemType} talle {l.itemSize} · {hace(l.loanDate)}
                                    </p>
                                </div>
                                {/* La acción del día tiene nombre, no icono. */}
                                <button
                                    type="button"
                                    onClick={e => { e.preventDefault(); devolver(l); }}
                                    className="shrink-0 px-3.5 h-10 rounded-full bg-emerald-50 text-emerald-700 text-[13px] font-semibold hover:bg-emerald-100 transition-colors"
                                >
                                    Devolver
                                </button>
                                <BotonCircular
                                    icono={Trash2}
                                    tono="peligro"
                                    etiqueta={`Eliminar el préstamo de ${l.lenderName} ${l.lenderSurname}`}
                                    onClick={e => borrar(l, e)}
                                />
                            </Fila>
                        ))}
                    </ListaDeFilas>
                </section>
            )}

            {devueltos.length > 0 && (
                <section>
                    <CabeceraGrupo cuenta={`${devueltos.length} en total`}>Devueltos</CabeceraGrupo>
                    <ListaDeFilas>
                        {devueltos.map(l => (
                            <Fila key={l.id}>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-[15px] text-black truncate leading-tight">{l.lenderName} {l.lenderSurname}</h4>
                                    <p className="text-[13px] text-slate-400 truncate mt-0.5">{l.itemType} talle {l.itemSize}</p>
                                </div>
                                <Pastilla tono="buena">
                                    {l.returnDate ? fechaCorta(l.returnDate) : 'Devuelto'}
                                </Pastilla>
                                <BotonCircular
                                    icono={Undo2}
                                    etiqueta={`Marcar el préstamo de ${l.lenderName} ${l.lenderSurname} como no devuelto`}
                                    onClick={() => updateLoan({ ...l, status: 'ACTIVE', returnDate: undefined })}
                                />
                                <BotonCircular
                                    icono={Trash2}
                                    tono="peligro"
                                    etiqueta={`Eliminar el préstamo de ${l.lenderName} ${l.lenderSurname}`}
                                    onClick={e => borrar(l, e)}
                                />
                            </Fila>
                        ))}
                    </ListaDeFilas>
                </section>
            )}

            {loans.length === 0 && (
                <EstadoVacio
                    icono={Shirt}
                    titulo="No hay nada prestado"
                    texto="Cuando prestes una remera o un buzo, anotalo acá para saber quién lo tiene."
                    accion={{ texto: 'Anotar el primero', icono: Plus, onClick: () => navigate('/punto-de-informacion/prestamos/nuevo') }}
                />
            )}
        </TarjetaDelPunto>
    );
};

export default Loans;
