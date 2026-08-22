import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import { ChevronLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { ToastProvider, useToast } from '../punto-informacion/context/ContextoToast';

const INTEREST_OPTIONS = ['Domingos', 'Grupos GCX', 'Voluntarios', 'Oración', 'Bautismos', 'Niños'];

const STAGES: VisitorStage[] = [
    'NEW', 'FILLED_FORM', 'SECOND_CONTACT', 'THIRD_CONTACT', 'INTERESTED_GROWTH',
    'DOING_GROWTH', 'DOING_TRAINING', 'VOLUNTEERS', 'NO_RESPONSE'
];

// Copiados literales de Bienvenida.tsx (STAGE_LABELS) — no exportados desde
// ahí, así que se duplican acá. Si cambian en el Kanban, cambiar también acá.
const STAGE_LABELS: Record<VisitorStage, string> = {
    'NEW': 'INCOMPLETOS',
    'FILLED_FORM': 'FORM LLENO',
    'SECOND_CONTACT': '2° CONTACTO',
    'THIRD_CONTACT': '3° CONTACTO',
    'INTERESTED_GROWTH': 'INT. CRECER',
    'DOING_GROWTH': 'CRECER',
    'DOING_TRAINING': 'ENTRENAMIENTO',
    'VOLUNTEERS': 'VOLUNTARIOS',
    'NO_RESPONSE': 'NO RESPONDIÓ'
};

const inputCls = 'w-full h-10 px-3 border border-slate-300 rounded-lg text-sm font-medium text-black outline-none focus:border-black transition-colors';
const labelCls = 'block text-xs font-bold uppercase text-slate-400 mb-1';

const DetalleIngresanteContent: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToast();

    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [formData, setFormData] = useState<Partial<WelcomeVisitor>>({});

    useEffect(() => {
        if (!id) return;
        supabase.from('welcome_visitors').select('*').eq('id', id).single()
            .then(({ data, error }) => {
                if (error || !data) {
                    setNotFound(true);
                } else {
                    setFormData(data);
                }
                setLoading(false);
            });
    }, [id]);

    const handleChange = (field: keyof WelcomeVisitor, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleInterest = (interest: string) => {
        const current = formData.interest_areas || [];
        if (current.includes(interest)) {
            handleChange('interest_areas', current.filter(i => i !== interest));
        } else {
            handleChange('interest_areas', [...current, interest]);
        }
    };

    const handleSave = async () => {
        if (!id || !formData.first_name || !formData.last_name) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('welcome_visitors')
                .update({
                    // mismo trim que en el alta: un espacio sobrante acá
                    // rompe la búsqueda en el formulario público — NO SACAR.
                    first_name: formData.first_name.trim(),
                    last_name: formData.last_name.trim(),
                    age: formData.age,
                    phone: formData.phone,
                    localidad: formData.localidad,
                    is_first_time: formData.is_first_time,
                    accepted_jesus: formData.accepted_jesus,
                    interest_areas: formData.interest_areas,
                    prayer_request: formData.prayer_request,
                    email: formData.email,
                    experience_description: formData.experience_description,
                    stage: formData.stage,
                })
                .eq('id', id);

            if (error) throw error;

            toast.success('Datos actualizados correctamente.');
            // El ToastProvider vive DENTRO de esta página (ver el wrapper al
            // final del archivo), así que navegar de inmediato la desmonta
            // junto con el toast recién creado — el usuario nunca llega a
            // verlo. Medido en vivo: sin este delay, el toast queda con
            // `toastVisible: false` un instante después del guardado. El
            // pequeño margen alcanza para que entre la animación (~300ms)
            // antes de que la ruta cambie.
            setTimeout(() => navigate('/bienvenida'), 600);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            console.error('[DetalleIngresante] Error al guardar:', err);
            toast.error('Error al actualizar: ' + msg);
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!id) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from('welcome_visitors').delete().eq('id', id);
            if (error) throw error;
            toast.success('Ingresante eliminado.');
            // Mismo motivo que en handleSave: sin el delay, navegar
            // desmonta el ToastProvider de esta página antes de que el
            // toast llegue a pintarse.
            setTimeout(() => navigate('/bienvenida'), 600);
        } catch (err: unknown) {
            console.error('[DetalleIngresante] Error al eliminar:', err);
            toast.error('Error al eliminar.');
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center gap-4">
                <p className="text-slate-500 font-medium">No encontramos este ingresante.</p>
                <button onClick={() => navigate('/bienvenida')} className="px-5 py-2.5 bg-black text-white font-semibold rounded-lg text-sm">
                    Volver a la planilla
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    onClick={() => navigate('/bienvenida')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Bienvenida
                </button>

                <h1 className="text-2xl font-black uppercase tracking-tight text-black mb-6">
                    {formData.first_name} {formData.last_name}
                </h1>

                <div className="space-y-5">

                    {/* Etapa */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                        <label className={labelCls}>Etapa</label>
                        <select
                            className={inputCls}
                            value={formData.stage || 'NEW'}
                            onChange={e => handleChange('stage', e.target.value as VisitorStage)}
                        >
                            {STAGES.map(s => (
                                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                            ))}
                        </select>
                    </div>

                    {/* Datos básicos */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold uppercase text-sm text-black mb-3">Datos Básicos</h3>
                        {/* Sin breakpoint acá era grid-cols-2 fijo — dos
                            campos por fila incluso a 375px, apretando
                            "Teléfono" (+54 156874009... cortado) contra el
                            borde. La sección de abajo (Respuestas del
                            Formulario) ya usaba grid-cols-1 md:grid-cols-2;
                            esta quedó como la única sin el breakpoint. */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Nombre</label>
                                <input type="text" className={inputCls} value={formData.first_name || ''} onChange={e => handleChange('first_name', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Apellido</label>
                                <input type="text" className={inputCls} value={formData.last_name || ''} onChange={e => handleChange('last_name', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Edad</label>
                                <input type="number" className={inputCls} value={formData.age || ''} onChange={e => handleChange('age', parseInt(e.target.value) || undefined)} />
                            </div>
                            <div>
                                <label className={labelCls}>Teléfono</label>
                                <input type="tel" className={inputCls} value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelCls}>Localidad / Barrio</label>
                                <input type="text" className={inputCls} value={formData.localidad || ''} onChange={e => handleChange('localidad', e.target.value)} placeholder="Ej: Palermo, Lomas..." />
                            </div>
                            <div>
                                <label className={labelCls}>Email</label>
                                <input type="email" className={inputCls} value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Respuestas del formulario */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold uppercase text-sm text-black mb-3">Respuestas del Formulario</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className={labelCls}>¿Es primera vez?</label>
                                <select
                                    className={inputCls}
                                    value={formData.is_first_time == null ? '' : (formData.is_first_time ? 'yes' : 'no')}
                                    onChange={e => {
                                        const val = e.target.value;
                                        handleChange('is_first_time', val === '' ? null : val === 'yes');
                                    }}
                                >
                                    <option value="">— Sin respuesta —</option>
                                    <option value="yes">Sí, primera vez</option>
                                    <option value="no">No, ya había venido</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Decisión de Fe</label>
                                <select className={inputCls} value={formData.accepted_jesus || ''} onChange={e => handleChange('accepted_jesus', e.target.value)}>
                                    <option value="">— Sin respuesta —</option>
                                    <option value="Si">Sí, acepté hoy</option>
                                    <option value="No, antes">Ya lo había hecho antes</option>
                                    <option value="Cristiano">Sin decisión (ya era cristiano)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4 mb-4">
                            <div>
                                <label className={labelCls}>Experiencia / Comentarios</label>
                                <textarea className={`${inputCls} h-24 py-2 resize-none`} value={formData.experience_description || ''} onChange={e => handleChange('experience_description', e.target.value)} placeholder="Sin respuesta" />
                            </div>
                            <div>
                                <label className={labelCls}>Petición de Oración</label>
                                <textarea className={`${inputCls} h-24 py-2 resize-none`} value={formData.prayer_request || ''} onChange={e => handleChange('prayer_request', e.target.value)} placeholder="Sin respuesta" />
                            </div>
                        </div>

                        <div>
                            <label className={`${labelCls} mb-2`}>Áreas de Interés</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {INTEREST_OPTIONS.map(opt => {
                                    const active = (formData.interest_areas || []).includes(opt);
                                    return (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => toggleInterest(opt)}
                                            className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${active ? 'bg-black text-white border-black' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
                                        >
                                            <span className="font-semibold text-xs uppercase">{opt}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Acciones */}
                <div className="flex justify-between items-center mt-6">
                    {confirmDelete ? (
                        <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex items-center gap-1.5 text-xs font-bold uppercase text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition-colors"
                        >
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Confirmar eliminación
                        </button>
                    ) : (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="flex items-center gap-1.5 text-xs font-bold uppercase text-red-600 hover:underline"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar Cambios</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

// `DetalleIngresante` es una ruta propia (/bienvenida/v/:id), no un hijo
// montado dentro de Bienvenida.tsx — así que no hereda el <ToastProvider>
// que esa página monta para sí misma. Sin este wrapper, useToast() explota
// al primer guardado/error con "useToast must be used within a ToastProvider"
// (mismo patrón que AdminGCXLayout: Content separado del Provider).
const DetalleIngresante: React.FC = () => (
    <ToastProvider>
        <DetalleIngresanteContent />
    </ToastProvider>
);

export default DetalleIngresante;
