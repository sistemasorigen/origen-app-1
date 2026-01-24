import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { WelcomeVisitor, VisitorStage } from '../../types';
import { X, Loader2, Save, Trash2 } from 'lucide-react';
import { useToast } from '../infopoint/context/ToastContext';

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
                    referral_source: formData.referral_source,
                    experience_rating: formData.experience_rating,
                    wants_growth: formData.wants_growth,
                    interest_areas: formData.interest_areas,
                    prayer_request: formData.prayer_request
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-2xl p-6 relative animate-fadeIn my-auto max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 border-2 border-transparent hover:border-black transition-all"
                >
                    <X size={24} className="text-black" />
                </button>

                <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-black border-b-4 border-black pb-2 mr-10">
                    Detalle de Visitante
                </h2>

                <div className="space-y-6">
                    {/* 1. DATOS BÁSICOS */}
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
                        </div>
                    </div>

                    {/* 2. SOBRE TU VISITA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">¿Es primera vez?</label>
                            <select
                                className="input-field"
                                value={formData.is_first_time ? 'yes' : 'no'}
                                onChange={e => handleChange('is_first_time', e.target.value === 'yes')}
                            >
                                <option value="yes">Primera vez</option>
                                <option value="no">Ya había venido</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Decisión de Fe</label>
                            <select
                                className="input-field"
                                value={formData.accepted_jesus || ''}
                                onChange={e => handleChange('accepted_jesus', e.target.value)}
                            >
                                <option value="">- Seleccionar -</option>
                                <option value="Si">Sí, acepté hoy</option>
                                <option value="No, antes">Ya lo había hecho antes</option>
                            </select>
                        </div>
                    </div>

                    {/* 3. ORIGEN & CONEXION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">¿Cómo nos conociste?</label>
                            <select
                                className="input-field"
                                value={formData.referral_source || ''}
                                onChange={e => handleChange('referral_source', e.target.value)}
                            >
                                <option value="">- Seleccionar -</option>
                                <option value="Amigo">Invitado por un amigo</option>
                                <option value="Redes">Redes Sociales</option>
                                <option value="Internet">Internet / Web</option>
                                <option value="Pasé">Pasé por la puerta</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">¿Quiere hacer "Crecer"?</label>
                            <select
                                className="input-field bg-yellow-50"
                                value={formData.wants_growth || ''}
                                onChange={e => handleChange('wants_growth', e.target.value)}
                            >
                                <option value="">- Seleccionar -</option>
                                <option value="Si">Sí, quiero crecer</option>
                                <option value="No">No por ahora</option>
                                <option value="Tal vez">Tal vez después</option>
                            </select>
                        </div>
                    </div>

                    {/* 4. EXPERIENCIA & ORACION */}
                    <div className="space-y-4">
                        <div>
                            <label className="label">Experiencia / Comentarios</label>
                            <textarea
                                className="input-field h-20 py-2"
                                value={formData.experience_rating || ''}
                                onChange={e => handleChange('experience_rating', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Petición de Oración</label>
                            <textarea
                                className="input-field h-20 py-2"
                                value={formData.prayer_request || ''}
                                onChange={e => handleChange('prayer_request', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 5. INTERESES */}
                    <div>
                        <label className="label mb-2 block">Áreas de Interés</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {INTEREST_OPTIONS.map(opt => (
                                <label key={opt} className={`flex items-center gap-2 p-2 border-2 cursor-pointer transition-all ${formData.interest_areas?.includes(opt) ? 'border-black bg-black text-white' : 'border-neutral-200 text-neutral-500 hover:border-black'}`}>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.interest_areas?.includes(opt) || false}
                                        onChange={() => toggleInterest(opt)}
                                    />
                                    <span className="font-bold uppercase text-xs">{opt}</span>
                                </label>
                            ))}
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
        </div>
    );
};

export default VisitorDetailModal;
