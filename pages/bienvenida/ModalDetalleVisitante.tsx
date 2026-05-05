import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useToast } from '../infopoint/context/ContextoToast';
import NeoModal from '../../components/ui/NeoModal';

interface VisitorDetailModalProps {
    visitor: WelcomeVisitor | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

const INTEREST_OPTIONS = ['Domingos', 'Grupos GCX', 'Voluntarios', 'Oración', 'Bautismos', 'Niños'];

const VisitorDetailModal: React.FC<VisitorDetailModalProps> = ({ visitor, isOpen, onClose, onUpdate }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<WelcomeVisitor>>({});

    useEffect(() => {
        if (visitor) {
            setFormData({ ...visitor });
        }
    }, [visitor]);

    if (!isOpen || !visitor) return null;

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
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('welcome_visitors')
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    age: formData.age,
                    phone: formData.phone,
                    is_first_time: formData.is_first_time,
                    accepted_jesus: formData.accepted_jesus,
                    // referral_source: formData.referral_source, // REMOVED
                    experience_rating: formData.experience_rating,
                    // wants_growth: formData.wants_growth,       // REMOVED
                    interest_areas: formData.interest_areas,
                    prayer_request: formData.prayer_request,
                    email: formData.email,
                    experience_description: formData.experience_description
                })
                .eq('id', visitor.id);

            if (error) throw error;

            toast.success('Datos actualizados correctamente.');
            onUpdate();
            onClose();
        } catch (err: any) {
            console.error(err);
            toast.error('Error al actualizar: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar a esta persona del sistema de bienvenida?')) return;
        setIsLoading(true);
        try {
            const { error } = await supabase.from('welcome_visitors').delete().eq('id', visitor.id);
            if (error) throw error;
            toast.success('Visitante eliminado.');
            onUpdate();
            onClose();
        } catch (err: any) {
            toast.error('Error al eliminar.');
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <NeoModal isOpen={isOpen} onClose={onClose} title="Detalle de Visitante" maxWidth="max-w-2xl">
            <div className="space-y-6">
                {/* 1. DATOS BÁSICOS (EDITABLE) */}
                <div className="bg-slate-50 p-4 border-2 border-black">
                    <h3 className="font-black uppercase mb-3 text-sm">Datos Básicos</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Nombre</label>
                            <input type="text" className="input-field" value={formData.first_name || ''} onChange={e => handleChange('first_name', e.target.value)} />
                        </div>
                        <div>
                            <label className="label">Apellido</label>
                            <input type="text" className="input-field" value={formData.last_name || ''} onChange={e => handleChange('last_name', e.target.value)} />
                        </div>
                        <div>
                            <label className="label">Edad</label>
                            <input type="number" className="input-field" value={formData.age || ''} onChange={e => handleChange('age', parseInt(e.target.value))} />
                        </div>
                        <div>
                            <label className="label">Teléfono</label>
                            <input type="tel" className="input-field" value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} />
                        </div>
                        <div className="col-span-2">
                            <label className="label">Email</label>
                            <input type="email" className="input-field" value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* 2. RESPUESTAS DEL FORMULARIO (EDITABLE) */}
                <div className="bg-slate-50 p-4 border-2 border-black">
                    <h3 className="font-black uppercase mb-3 text-sm flex items-center gap-2">
                        Respuestas del Formulario
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="label">¿Es primera vez?</label>
                            <select
                                className="input-field"
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
                            <label className="label">Decisión de Fe</label>
                            <select
                                className="input-field"
                                value={formData.accepted_jesus || ''}
                                onChange={e => handleChange('accepted_jesus', e.target.value)}
                            >
                                <option value="">— Sin respuesta —</option>
                                <option value="Si">Sí, acepté hoy</option>
                                <option value="No, antes">Ya lo había hecho antes</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4 mb-4">
                        <div>
                            <label className="label">Experiencia / Comentarios</label>
                            <textarea
                                className="input-field h-24 py-2 resize-none"
                                value={formData.experience_description || ''}
                                onChange={e => handleChange('experience_description', e.target.value)}
                                placeholder="Sin respuesta"
                            />
                        </div>
                        <div>
                            <label className="label">Petición de Oración</label>
                            <textarea
                                className="input-field h-24 py-2 resize-none"
                                value={formData.prayer_request || ''}
                                onChange={e => handleChange('prayer_request', e.target.value)}
                                placeholder="Sin respuesta"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label mb-2 block">Áreas de Interés</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {INTEREST_OPTIONS.map(opt => (
                                <label
                                    key={opt}
                                    className={`flex items-center gap-2 p-2 border-2 cursor-pointer transition-all ${
                                        (formData.interest_areas || []).includes(opt)
                                            ? 'border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                            : 'border-neutral-200 text-neutral-500 hover:border-black'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={(formData.interest_areas || []).includes(opt)}
                                        onChange={() => toggleInterest(opt)}
                                    />
                                    <span className="font-bold uppercase text-xs">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t-4 border-black">
                <button
                    onClick={handleDelete}
                    className="text-red-500 font-bold uppercase text-xs hover:underline flex items-center gap-1"
                >
                    <Trash2 size={14} /> Eliminar
                </button>
                <button
                    onClick={handleSave}
                    disabled={isLoading}
                    className="h-10 px-6 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Guardar Cambios</>}
                </button>
            </div>

            <style>{`
                .label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    margin-bottom: 0.25rem;
                    color: #000;
                }
                .input-field {
                    width: 100%;
                    height: 2.5rem;
                    padding: 0 0.75rem;
                    border: 2px solid #000;
                    font-weight: 700;
                    outline: none;
                    transition: all;
                    color: #000;
                    background: #fff;
                }
                textarea.input-field {
                    height: auto;
                    padding: 0.5rem 0.75rem;
                }
                .input-field:focus {
                    box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
                }
            `}</style>
        </NeoModal>
    );
};

export default VisitorDetailModal;
