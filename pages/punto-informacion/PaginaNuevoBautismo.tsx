import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { puedeEntrarAlPunto } from '../../services/authUtils';
import SinAcceso from '../../components/auth/SinAcceso';
import { PendingStatus } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import {
    PantallaFormulario, Campo, ParDeCampos, BarraDeRevisar, HojaDeRevision, campo,
} from '../../components/info-point/FormularioDelPunto';

const VOLVER = '/punto-de-informacion?view=BAPTISMS';

const PaginaNuevoBautismoContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { baptisms, addBaptism, updateBaptism, showNotification } = useStore();
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [guardando, setGuardando] = useState(false);
    const [revisando, setRevisando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!editId) return;
        const existente = baptisms.find(b => b.id === editId);
        if (existente) {
            setForm({
                firstName: existente.firstName,
                lastName: existente.lastName,
                email: existente.email,
                phone: existente.phone,
            });
        }
    }, [editId, baptisms]);

    // Enviar el formulario no guarda: abre la revisión. Los obligatorios ya
    // los frenó el navegador.
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
                const existente = baptisms.find(b => b.id === editId);
                if (existente) {
                    await updateBaptism({ ...existente, ...form });
                    showNotification('Datos actualizados.');
                }
            } else {
                await addBaptism({
                    id: safeUUID(),
                    ...form,
                    isPending: 1,
                    status: PendingStatus.PENDING,
                    registrationDate: new Date().toISOString(),
                });
                showNotification(`${form.firstName} quedó en la lista de espera.`);
            }
            navigate(VOLVER);
        } catch (err) {
            console.error('[Punto] bautismo:', err);
            setError('No se pudo guardar. Revisá la conexión y probá de nuevo: los datos siguen acá.');
        } finally {
            setGuardando(false);
        }
    };

    const nombre = `${form.firstName} ${form.lastName}`.trim();

    return (
        <PantallaFormulario
            volverA={VOLVER}
            volverTexto="Bautismos"
            titulo={editId ? 'Editar el registro' : 'Anotar un bautismo'}
            bajada={editId ? undefined : 'Queda en la lista de espera hasta que lo marques como realizado.'}
        >
            <form id="form-bautismo" onSubmit={revisar} className="space-y-4">
                <ParDeCampos>
                    <Campo etiqueta="Nombre" para="bautismo-nombre">
                        <input
                            id="bautismo-nombre" type="text" autoComplete="given-name" required
                            placeholder="Joaquín"
                            value={form.firstName}
                            onChange={e => setForm({ ...form, firstName: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                    <Campo etiqueta="Apellido" para="bautismo-apellido">
                        <input
                            id="bautismo-apellido" type="text" autoComplete="family-name" required
                            placeholder="Molina"
                            value={form.lastName}
                            onChange={e => setForm({ ...form, lastName: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                </ParDeCampos>

                <Campo etiqueta="Teléfono" para="bautismo-telefono" ayuda="Para avisarle la fecha cuando se defina.">
                    <input
                        id="bautismo-telefono" type="tel" inputMode="tel" autoComplete="tel" required
                        placeholder="11 5555 0000"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className={campo}
                    />
                </Campo>

                <Campo etiqueta="Email" para="bautismo-email">
                    <input
                        id="bautismo-email" type="email" inputMode="email" autoComplete="email" required
                        placeholder="nombre@email.com"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className={campo}
                    />
                </Campo>

            </form>

            <BarraDeRevisar
                form="form-bautismo"
                resumen={nombre || 'Anotar un bautismo'}
                detalle={nombre ? (editId ? 'Cambios sin guardar' : 'Para la lista de espera') : 'Completá los datos'}
            />
            <HojaDeRevision
                abierta={revisando}
                titulo={editId ? 'Revisá los cambios' : 'Revisá el bautismo'}
                bajada="Leéselos a la persona antes de guardar."
                grupos={[{ filas: [
                    { etiqueta: 'Nombre', valor: nombre },
                    { etiqueta: 'Teléfono', valor: form.phone.trim() },
                    { etiqueta: 'Email', valor: form.email.trim() },
                ] }]}
                textoConfirmar={editId ? 'Guardar los cambios' : 'Anotar el bautismo'}
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
const PaginaNuevoBautismo: React.FC = () => {
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
            <PaginaNuevoBautismoContent />
        </AppProvider>
    );
};

export default PaginaNuevoBautismo;
