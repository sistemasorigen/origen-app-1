import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { puedeEntrarAlPunto } from '../../services/authUtils';
import { Announcement } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { Check } from 'lucide-react';
import {
    PantallaFormulario, Campo, ParDeCampos, BotonGuardar, Opciones, campo, campoLargo,
} from '../../components/info-point/FormularioDelPunto';

const VOLVER = '/punto-de-informacion?view=ANNOUNCEMENTS';

const FORM_VACIO: Omit<Announcement, 'id' | 'createdAt'> = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    isActive: true,
    isPermanent: false,
    link: '',
};

const PaginaNuevoAnuncioContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { announcements, addAnnouncement, updateAnnouncement } = useStore();
    const [form, setForm] = useState(FORM_VACIO);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [guardado, setGuardado] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const hoy = new Date().toISOString().slice(0, 10);

    useEffect(() => {
        if (!editId) return;
        const a = announcements.find(ann => ann.id === editId);
        if (!a) return;
        const conFechas = a.startDate && a.endDate;
        const activoPorDefecto = a.isPermanent || (conFechas && a.startDate <= hoy && a.endDate >= hoy);
        setForm({
            title: a.title,
            description: a.description,
            startDate: a.startDate || '',
            endDate: a.endDate || '',
            isActive: a.isActive ?? activoPorDefecto,
            isPermanent: a.isPermanent || false,
            link: a.link || '',
        });
    }, [editId, announcements]);

    const revisar = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = 'Falta el título.';
        if (!form.isPermanent) {
            if (!form.startDate) errs.startDate = 'Falta la fecha de inicio.';
            if (!form.endDate) errs.endDate = 'Falta la fecha de fin.';
            if (form.startDate && form.endDate && form.endDate < form.startDate) {
                errs.endDate = 'Termina antes de empezar.';
            }
        }
        return errs;
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = revisar();
        if (Object.keys(errs).length > 0) {
            setErrores(errs);
            return;
        }
        setErrores({});
        setGuardando(true);

        try {
            // Un anuncio fijo no muestra fechas, pero la base pide start_date:
            // se le ponen unas que no molesten.
            const datos = form.isPermanent
                ? { ...form, startDate: form.startDate || hoy, endDate: form.endDate || '2099-12-31' }
                : form;

            // El QR lleva el link si hay; si no, el título y la fecha.
            const contenido = datos.link ? datos.link : `${datos.title}${datos.startDate ? ` - ${datos.startDate}` : ''}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(contenido || 'https://origen.church')}`;

            let salioBien = false;
            if (editId) {
                const existente = announcements.find(a => a.id === editId);
                if (existente) salioBien = await updateAnnouncement({ ...existente, ...datos, qrCodeUrl: qrUrl });
            } else {
                salioBien = await addAnnouncement({
                    id: safeUUID(),
                    createdAt: new Date().toISOString(),
                    ...datos,
                    qrCodeUrl: qrUrl,
                } as Announcement);
            }

            // Si la base lo rechazó, el formulario queda como está para no
            // perder lo escrito: el aviso de error lo muestra el store.
            if (!salioBien) return;

            setGuardado(true);
            setTimeout(() => navigate(VOLVER), 900);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <PantallaFormulario
            volverA={VOLVER}
            volverTexto="Anuncios"
            titulo={editId ? 'Editar el anuncio' : 'Crear un anuncio'}
            bajada={editId ? undefined : 'Aparece en la app de todos, con su QR para compartir.'}
        >
            <form onSubmit={guardar} className="space-y-4">
                <Campo etiqueta="Título" para="anuncio-titulo">
                    <input
                        id="anuncio-titulo" type="text"
                        placeholder="Semana de ayuno"
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        className={campo}
                    />
                    {errores.title && <p className="text-[13px] font-medium text-red-600 mt-1.5">{errores.title}</p>}
                </Campo>

                <Campo etiqueta="Cuándo se muestra">
                    <Opciones
                        etiquetaGrupo="Cuándo se muestra el anuncio"
                        valor={form.isPermanent ? 'fijo' : 'fechas'}
                        opciones={[
                            { valor: 'fechas', etiqueta: 'Entre dos fechas' },
                            { valor: 'fijo', etiqueta: 'Siempre' },
                        ]}
                        onElegir={v => setForm(f => ({ ...f, isPermanent: v === 'fijo' }))}
                    />
                </Campo>

                {!form.isPermanent && (
                    <ParDeCampos juntos>
                        <Campo etiqueta="Desde" para="anuncio-desde">
                            <input
                                id="anuncio-desde" type="date"
                                value={form.startDate}
                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                className={campo}
                            />
                            {errores.startDate && <p className="text-[13px] font-medium text-red-600 mt-1.5">{errores.startDate}</p>}
                        </Campo>
                        <Campo etiqueta="Hasta" para="anuncio-hasta">
                            <input
                                id="anuncio-hasta" type="date"
                                value={form.endDate}
                                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                className={campo}
                            />
                            {errores.endDate && <p className="text-[13px] font-medium text-red-600 mt-1.5">{errores.endDate}</p>}
                        </Campo>
                    </ParDeCampos>
                )}

                <Campo
                    etiqueta="Link"
                    para="anuncio-link"
                    ayuda="A dónde lleva el QR. Si lo dejás vacío, el QR muestra el título y la fecha."
                >
                    <input
                        id="anuncio-link" type="url" inputMode="url"
                        placeholder="https://..."
                        value={form.link}
                        onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                        className={campo}
                    />
                </Campo>

                <Campo etiqueta="Descripción" para="anuncio-descripcion" ayuda="Opcional.">
                    <textarea
                        id="anuncio-descripcion" rows={3}
                        placeholder="De qué se trata…"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className={campoLargo}
                    />
                </Campo>

                <div className="pt-2">
                    {guardado ? (
                        <p className="w-full py-4 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-sm flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" />
                            Guardado
                        </p>
                    ) : (
                        <BotonGuardar guardando={guardando}>
                            {editId ? 'Guardar los cambios' : 'Crear el anuncio'}
                        </BotonGuardar>
                    )}
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
const PaginaNuevoAnuncio: React.FC = () => {
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
            <PaginaNuevoAnuncioContent />
        </AppProvider>
    );
};

export default PaginaNuevoAnuncio;
