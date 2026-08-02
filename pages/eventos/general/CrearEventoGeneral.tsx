import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getEventoGeneralById, createEventoGeneral, updateEventoGeneral } from '../../../services/supabaseService';
import { ChevronLeft, Save, Loader2 } from 'lucide-react';
import ImageUpload from '../../../components/media/SubidaImagen';

const CrearEventoGeneral: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const [imageUrl, setImageUrl] = useState('');
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');
    const [registrationLink, setRegistrationLink] = useState('');

    const [loadingEvent, setLoadingEvent] = useState(!!editId);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!editId) return;
        getEventoGeneralById(editId).then(evento => {
            if (evento) {
                setImageUrl(evento.imageUrl || '');
                setName(evento.name);
                setStartDate(evento.startDate);
                setStartTime(evento.startTime || '');
                setEndTime(evento.endTime || '');
                setDescription(evento.description || '');
                setRegistrationLink(evento.registrationLink || '');
            }
            setLoadingEvent(false);
        });
    }, [editId]);

    const canSubmit = name.trim() && startDate.trim();

    const handleSubmit = async () => {
        setError(null);
        setSaving(true);

        const input = {
            name: name.trim(),
            imageUrl: imageUrl || undefined,
            startDate: startDate.trim(),
            startTime: startTime.trim() || undefined,
            endTime: endTime.trim() || undefined,
            description: description.trim() || undefined,
            registrationLink: registrationLink.trim() || undefined,
        };

        const success = editId
            ? await updateEventoGeneral(editId, input)
            : (await createEventoGeneral(input)) !== null;

        setSaving(false);

        if (success) {
            navigate('/eventos/admin/general');
            return;
        }

        setError('Hubo un error al guardar el evento. Probá de nuevo.');
    };

    if (loadingEvent) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-xl mx-auto">
                <button
                    onClick={() => navigate('/eventos/admin/general')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Gestión de Eventos
                </button>

                <h1 className="text-2xl font-black uppercase tracking-tight text-black mb-6">
                    {editId ? 'Editar Evento' : 'Crear Evento'}
                </h1>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-5">

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-400 mb-2 block">Foto de Portada (500x500)</label>
                        <ImageUpload
                            currentImage={imageUrl}
                            onImageUpload={setImageUrl}
                            folder="eventos-general"
                            aspectRatio="square"
                            placeholder="Subir portada cuadrada del evento"
                            variant="minimal"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Nombre del Evento</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" placeholder="Ej. Reunión de Jóvenes" />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Fecha de Inicio</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Horario de Inicio</label>
                            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Horario de Final</label>
                            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Descripción</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm resize-none" placeholder="Breve descripción del evento..." />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Link de Inscripción</label>
                        <input type="text" value={registrationLink} onChange={e => setRegistrationLink(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" placeholder="https://..." />
                    </div>

                    {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

                    <button
                        disabled={!canSubmit || saving}
                        onClick={handleSubmit}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {editId ? 'Guardar Cambios' : 'Crear Evento'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CrearEventoGeneral;
