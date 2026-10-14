import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { puedeEntrarAlPunto } from '../../services/authUtils';
import { AppEvent } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { formatDateForInput } from '../../services/dateUtils';
import {
    PantallaFormulario, Campo, ParDeCampos, BotonGuardar, campo, campoLargo,
} from '../../components/info-point/FormularioDelPunto';

const VOLVER = '/punto-de-informacion?view=EVENTS';

const PaginaNuevoEventoContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { events, addEvent, updateEvent, showNotification } = useStore();
    const [form, setForm] = useState({ name: '', date: '', startTime: '', endTime: '', link: '', description: '' });
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!editId) return;
        const existente = events.find(ev => ev.id === editId);
        if (existente) {
            setForm({
                name: existente.name,
                date: existente.date,
                startTime: existente.startTime || '',
                endTime: existente.endTime || '',
                link: existente.link || '',
                description: existente.description || '',
            });
        }
    }, [editId, events]);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.date) {
            showNotification('Falta el nombre o la fecha.', 'error');
            return;
        }

        setGuardando(true);
        try {
            // El QR lleva el link si hay; si no, el nombre y la fecha.
            const contenido = form.link ? form.link : `${form.name} - ${form.date} ${form.startTime}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(contenido || 'https://origen.church')}`;

            if (editId) {
                const existente = events.find(ev => ev.id === editId);
                await updateEvent({
                    ...existente,
                    id: editId,
                    name: form.name,
                    description: form.description,
                    date: form.date,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    link: form.link,
                    qrCodeUrl: qrUrl,
                } as AppEvent);
                showNotification('Evento actualizado.');
            } else {
                await addEvent({
                    id: safeUUID(),
                    name: form.name,
                    description: form.description,
                    date: form.date,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    link: form.link,
                    qrCodeUrl: qrUrl,
                    createdAt: new Date().toISOString(),
                } as AppEvent);
                showNotification(`"${form.name}" quedó en la agenda, con su QR.`);
            }
            navigate(VOLVER);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <PantallaFormulario
            volverA={VOLVER}
            volverTexto="Eventos"
            titulo={editId ? 'Editar el evento' : 'Crear un evento'}
            bajada={editId ? undefined : 'Se crea con su código QR para compartir o imprimir.'}
        >
            <form onSubmit={guardar} className="space-y-4">
                <Campo etiqueta="Nombre" para="evento-nombre">
                    <input
                        id="evento-nombre" type="text" required
                        placeholder="Noche de alabanza"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className={campo}
                    />
                </Campo>

                <Campo etiqueta="Fecha" para="evento-fecha">
                    <input
                        id="evento-fecha" type="date" required
                        value={formatDateForInput(form.date)}
                        onChange={e => setForm({ ...form, date: e.target.value })}
                        className={campo}
                    />
                </Campo>

                <ParDeCampos juntos>
                    <Campo etiqueta="Empieza" para="evento-inicio">
                        <input
                            id="evento-inicio" type="time"
                            value={form.startTime}
                            onChange={e => setForm({ ...form, startTime: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                    <Campo etiqueta="Termina" para="evento-fin">
                        <input
                            id="evento-fin" type="time"
                            value={form.endTime}
                            onChange={e => setForm({ ...form, endTime: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                </ParDeCampos>

                <Campo
                    etiqueta="Link"
                    para="evento-link"
                    ayuda="A dónde lleva el QR. Si lo dejás vacío, el QR muestra el nombre y la fecha."
                >
                    <input
                        id="evento-link" type="url" inputMode="url"
                        placeholder="https://..."
                        value={form.link}
                        onChange={e => setForm({ ...form, link: e.target.value })}
                        className={campo}
                    />
                </Campo>

                <Campo etiqueta="Descripción" para="evento-descripcion" ayuda="Opcional.">
                    <textarea
                        id="evento-descripcion" rows={3}
                        placeholder="De qué se trata, dónde es…"
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className={campoLargo}
                    />
                </Campo>

                <div className="pt-2">
                    <BotonGuardar guardando={guardando}>
                        {editId ? 'Guardar los cambios' : 'Crear el evento'}
                    </BotonGuardar>
                </div>
            </form>
        </PantallaFormulario>
    );
};

// useStore pide el store del Punto, y esta ruta es suelta: trae el suyo.
//
// Y el mismo portero que las de movimientos: se llega por link, sin pasar por
// el panel, así que el permiso del panel no la cubre. Mientras el perfil está
// en camino no se decide nada: `user` todavía es null y rebotaría a quien sí
// tiene permiso.
const PaginaNuevoEvento: React.FC = () => {
    const { user, isLoadingSession, isLoadingProfile } = useAuth();

    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Cargando</span>
            </div>
        );
    }
    if (!puedeEntrarAlPunto(user)) return <Navigate to="/" replace />;

    return (
        <AppProvider currentUser={user}>
            <PaginaNuevoEventoContent />
        </AppProvider>
    );
};

export default PaginaNuevoEvento;
