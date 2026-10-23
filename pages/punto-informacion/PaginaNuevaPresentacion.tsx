import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { puedeEntrarAlPunto } from '../../services/authUtils';
import SinAcceso from '../../components/auth/SinAcceso';
import { PendingStatus } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { formatDateForInput } from '../../services/dateUtils';
import {
    PantallaFormulario, Campo, ParDeCampos, BarraDeRevisar, HojaDeRevision, fechaParaRevisar, campo,
} from '../../components/info-point/FormularioDelPunto';

const VOLVER = '/punto-de-informacion?view=PRESENTATIONS';

const PaginaNuevaPresentacionContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { presentations, addPresentation, updatePresentation, showNotification } = useStore();
    const [form, setForm] = useState({
        childName: '', childSurname: '',
        motherName: '', motherSurname: '',
        fatherName: '', fatherSurname: '',
        email: '', phone: '',
        scheduledDate: formatDateForInput(new Date().toISOString()),
    });
    const [guardando, setGuardando] = useState(false);
    const [revisando, setRevisando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!editId) return;
        const existente = presentations.find(p => p.id === editId);
        if (existente) {
            setForm({
                childName: existente.childName, childSurname: existente.childSurname,
                motherName: existente.motherName, motherSurname: existente.motherSurname,
                fatherName: existente.fatherName, fatherSurname: existente.fatherSurname,
                email: existente.email, phone: existente.phone,
                scheduledDate: formatDateForInput(existente.scheduledDate),
            });
        }
    }, [editId, presentations]);

    // Enviar el formulario no guarda: abre la revisión.
    const revisar = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setRevisando(true);
    };

    const guardar = async () => {
        setGuardando(true);
        setError(null);
        try {
            if (editId) {
                const existente = presentations.find(p => p.id === editId);
                if (existente) {
                    await updatePresentation({ ...existente, ...form });
                    showNotification('Datos actualizados.');
                }
            } else {
                await addPresentation({
                    id: safeUUID(),
                    ...form,
                    isPending: 1,
                    status: PendingStatus.PENDING,
                });
                showNotification(`${form.childName} quedó en la agenda.`);
            }
            navigate(VOLVER);
        } catch (err) {
            console.error('[Punto] presentación:', err);
            setError('No se pudo guardar. Revisá la conexión y probá de nuevo: los datos siguen acá.');
        } finally {
            setGuardando(false);
        }
    };

    const nene = `${form.childName} ${form.childSurname}`.trim();
    const fecha = fechaParaRevisar(form.scheduledDate);

    return (
        <PantallaFormulario
            volverA={VOLVER}
            volverTexto="Presentaciones"
            titulo={editId ? 'Editar la presentación' : 'Agendar una presentación'}
            bajada={editId ? undefined : 'Queda en la agenda hasta que la marques como realizada.'}
        >
            <form id="form-presentacion" onSubmit={revisar} className="space-y-6">
                <div className="space-y-4">
                    <ParDeCampos>
                        <Campo etiqueta="Nombre del nene o la nena" para="pres-nombre">
                            <input
                                id="pres-nombre" type="text" required placeholder="Mía"
                                value={form.childName}
                                onChange={e => setForm({ ...form, childName: e.target.value })}
                                className={campo}
                            />
                        </Campo>
                        <Campo etiqueta="Apellido" para="pres-apellido">
                            <input
                                id="pres-apellido" type="text" required placeholder="Fernández"
                                value={form.childSurname}
                                onChange={e => setForm({ ...form, childSurname: e.target.value })}
                                className={campo}
                            />
                        </Campo>
                    </ParDeCampos>

                    <Campo etiqueta="Fecha" para="pres-fecha" ayuda="Se puede cambiar después.">
                        <input
                            id="pres-fecha" type="date" required
                            value={form.scheduledDate}
                            onChange={e => setForm({ ...form, scheduledDate: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                </div>

                {/* Los padres van juntos y aparte: es el bloque que se completa
                    mirando a la familia, no al nene. */}
                <div className="space-y-4 pt-5 border-t border-slate-100">
                    <h2 className="text-[15px] font-semibold text-black">Los papás</h2>

                    <ParDeCampos>
                        <Campo etiqueta="Nombre de la mamá" para="pres-mama">
                            <input
                                id="pres-mama" type="text" placeholder="Ana"
                                value={form.motherName}
                                onChange={e => setForm({ ...form, motherName: e.target.value })}
                                className={campo}
                            />
                        </Campo>
                        <Campo etiqueta="Apellido" para="pres-mama-apellido">
                            <input
                                id="pres-mama-apellido" type="text" placeholder="Fernández"
                                value={form.motherSurname}
                                onChange={e => setForm({ ...form, motherSurname: e.target.value })}
                                className={campo}
                            />
                        </Campo>
                    </ParDeCampos>

                    <ParDeCampos>
                        <Campo etiqueta="Nombre del papá" para="pres-papa">
                            <input
                                id="pres-papa" type="text" placeholder="Luis"
                                value={form.fatherName}
                                onChange={e => setForm({ ...form, fatherName: e.target.value })}
                                className={campo}
                            />
                        </Campo>
                        <Campo etiqueta="Apellido" para="pres-papa-apellido">
                            <input
                                id="pres-papa-apellido" type="text" placeholder="Fernández"
                                value={form.fatherSurname}
                                onChange={e => setForm({ ...form, fatherSurname: e.target.value })}
                                className={campo}
                            />
                        </Campo>
                    </ParDeCampos>

                    <Campo etiqueta="Teléfono" para="pres-telefono" ayuda="Para avisarles si cambia la fecha.">
                        <input
                            id="pres-telefono" type="tel" inputMode="tel" required placeholder="11 5555 0000"
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
                            className={campo}
                        />
                    </Campo>

                    <Campo etiqueta="Email" para="pres-email">
                        <input
                            id="pres-email" type="email" inputMode="email" required placeholder="nombre@email.com"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                </div>

            </form>

            <BarraDeRevisar
                form="form-presentacion"
                resumen={nene || 'Agendar una presentación'}
                detalle={fecha ? fecha.charAt(0).toUpperCase() + fecha.slice(1) : 'Completá los datos'}
            />
            <HojaDeRevision
                abierta={revisando}
                titulo={editId ? 'Revisá los cambios' : 'Revisá la presentación'}
                bajada="Leéselos a la familia antes de guardar."
                grupos={[
                    { titulo: 'La presentación', filas: [
                        { etiqueta: 'Nene o nena', valor: nene },
                        { etiqueta: 'Fecha', valor: fecha },
                    ] },
                    { titulo: 'Los papás', filas: [
                        { etiqueta: 'Mamá', valor: `${form.motherName} ${form.motherSurname}`.trim() },
                        { etiqueta: 'Papá', valor: `${form.fatherName} ${form.fatherSurname}`.trim() },
                        { etiqueta: 'Teléfono', valor: form.phone.trim() },
                        { etiqueta: 'Email', valor: form.email.trim() },
                    ] },
                ]}
                textoConfirmar={editId ? 'Guardar los cambios' : 'Agendar'}
                guardando={guardando}
                error={error}
                onCorregir={() => setRevisando(false)}
                onConfirmar={guardar}
            />
        </PantallaFormulario>
    );
};

// useStore pide el store del Punto, y esta ruta es suelta: trae el suyo.
//
// Y el mismo portero que las de movimientos: se llega por link, sin pasar por
// el panel, así que el permiso del panel no la cubre. Mientras el perfil está
// en camino no se decide nada: `user` todavía es null y rebotaría a quien sí
// tiene permiso.
const PaginaNuevaPresentacion: React.FC = () => {
    const { user, isLoadingSession, isLoadingProfile } = useAuth();

    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Cargando</span>
            </div>
        );
    }
    if (!puedeEntrarAlPunto(user)) return <SinAcceso />;

    return (
        <AppProvider currentUser={user}>
            <PaginaNuevaPresentacionContent />
        </AppProvider>
    );
};

export default PaginaNuevaPresentacion;
