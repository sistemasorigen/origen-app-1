import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useToast } from '../infopoint/context/ToastContext';
import NeoModal from '../../components/NeoModal';

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

    const DisplayField = ({ label, value }: { label: string, value: any }) => (
        <div className="mb-1">
            <label className="label">{label}</label>
            <div className={`w-full min-h-[2.5rem] px-3 py-2 border-2 border-black font-bold flex items-center ${value ? 'bg-white' : 'bg-neutral-100 text-neutral-400 italic'}`}>
                {value || 'Incompleto'}
            </div>
        </div>
    );

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

                {/* 2. DATOS DEL FORMULARIO (READ ONLY) */}
                <div className="bg-neutral-50 p-4 border-2 border-neutral-200">
                    <h3 className="font-black uppercase mb-3 text-sm text-neutral-400 flex items-center gap-2">
                        Respuestas del Formulario
                        {visitor.stage !== 'FILLED_FORM' && <span className="text-[10px] bg-neutral-200 px-2 py-0.5 text-black rounded-full">Lectura</span>}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <DisplayField
                            label="¿Es primera vez?"
                            value={formData.is_first_time != null ? (formData.is_first_time ? 'Sí, primera vez' : 'No, ya había venido') : null}
                        />
                        <DisplayField
                            label="Decisión de Fe"
                            value={formData.accepted_jesus}
                        />
                    </div>

                    <div className="space-y-4 mb-4">
                        <DisplayField
                            label="Experiencia / Comentarios"
                            value={formData.experience_description}
                        />
                        <DisplayField
                            label="Petición de Oración"
                            value={formData.prayer_request}
                        />
                    </div>

                    <div>
                        <label className="label mb-2 block">Áreas de Interés</label>
                        <div className="flex flex-wrap gap-2">
                            {formData.interest_areas && formData.interest_areas.length > 0 ? (
                                formData.interest_areas.map(interest => (
                                    <span key={interest} className="px-3 py-1 bg-black text-white text-xs font-bold uppercase tracking-wider">
                                        {interest}
                                    </span>
                                ))
                            ) : (
                                <div className="w-full min-h-[2.5rem] px-3 py-2 border-2 border-neutral-200 font-bold bg-neutral-100 flex items-center text-neutral-400 italic">
                                    Incompleto
                                </div>
                            )}
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
                .input-field:focus {
                    box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
                }
            `}</style>
        </NeoModal>
    );
};

export default VisitorDetailModal;
