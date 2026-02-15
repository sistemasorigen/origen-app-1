
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '../../pages/infopoint/context/ToastContext';

const INTEREST_OPTIONS = ['Domingos', 'Grupos GCX', 'Voluntarios', 'Oración', 'Bautismos', 'Niños'];

const Formulario: React.FC = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Input, 2: Success
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        experience: '',
        is_first_time: true,
        accepted_jesus: '',
        referral_source: '',
        wants_growth: '',
        interest_areas: [] as string[],
        prayer_request: ''
    });

    const toggleInterest = (interest: string) => {
        const current = formData.interest_areas;
        if (current.includes(interest)) {
            setFormData({ ...formData, interest_areas: current.filter(i => i !== interest) });
        } else {
            setFormData({ ...formData, interest_areas: [...current, interest] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Search for existing visitor by phone (handle duplicates by taking latest)
            const { data: existingVisitors, error: searchError } = await supabase
                .from('welcome_visitors')
                .select('id')
                .eq('phone', formData.phone)
                .order('created_at', { ascending: false })
                .limit(1);

            if (searchError) {
                console.error("Search error", searchError);
            }

            const existingVisitor = existingVisitors && existingVisitors.length > 0 ? existingVisitors[0] : null;

            const updateData = {
                email: formData.email,
                experience_description: formData.experience,
                stage: 'FILLED_FORM',
                first_name: formData.firstName,
                last_name: formData.lastName,
                phone: formData.phone,

                // New Fields
                is_first_time: formData.is_first_time,
                accepted_jesus: formData.accepted_jesus,
                referral_source: formData.referral_source,
                wants_growth: formData.wants_growth,
                interest_areas: formData.interest_areas,
                prayer_request: formData.prayer_request
            };

            const insertData = {
                ...updateData,
                created_at: new Date().toISOString()
            };

            if (existingVisitor) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('welcome_visitors')
                    .update(updateData)
                    .eq('id', existingVisitor.id);

                if (updateError) throw updateError;
            } else {
                // Create new
                const { error: insertError } = await supabase
                    .from('welcome_visitors')
                    .insert(insertData);

                if (insertError) throw insertError;
            }

            setStep(2);
            setTimeout(() => {
                navigate('/auth');
            }, 3000);

        } catch (error: any) {
            console.error('Error submitting form:', error);
            toast.error('Ocurrió un error. Por favor intentá nuevamente.');
        } finally {
            setIsLoading(false);
        }
    };

    if (step === 2) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-center animate-fadeIn">
                <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">
                    ¡Gracias!
                </h1>
                <p className="text-gray-400 max-w-md mb-8">
                    Tus respuestas nos ayudan a conocerte mejor.
                    <br />
                    Te estamos redirigiendo...
                </p>
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-4 py-12">
            <div className="w-full max-w-2xl bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 md:p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-black uppercase tracking-tighter mb-2">
                        Bienvenido
                    </h1>
                    <div className="h-1 w-20 bg-black mx-auto mb-4" />
                    <p className="text-sm font-bold text-gray-600 uppercase tracking-widest">
                        Queremos conocerte
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 1. DATOS BÁSICOS */}
                    <div className="bg-slate-50 p-4 border-2 border-black">
                        <h3 className="font-black uppercase mb-3 text-sm">Tus Datos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    className="input-field"
                                    placeholder="Tu nombre"
                                />
                            </div>
                            <div>
                                <label className="label">Apellido</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    className="input-field"
                                    placeholder="Tu apellido"
                                />
                            </div>
                            <div>
                                <label className="label">Teléfono</label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="input-field"
                                    placeholder="+54 9..."
                                />
                            </div>
                            <div>
                                <label className="label">Email <span className="text-gray-400 font-normal">(Opcional)</span></label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="input-field"
                                    placeholder="tu@email.com"
                                />
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
                                onChange={e => setFormData({ ...formData, is_first_time: e.target.value === 'yes' })}
                            >
                                <option value="yes">Primera vez</option>
                                <option value="no">Ya había venido</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Decisión de Fe</label>
                            <select
                                className="input-field"
                                value={formData.accepted_jesus}
                                onChange={e => setFormData({ ...formData, accepted_jesus: e.target.value })}
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
                                value={formData.referral_source}
                                onChange={e => setFormData({ ...formData, referral_source: e.target.value })}
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
                                value={formData.wants_growth}
                                onChange={e => setFormData({ ...formData, wants_growth: e.target.value })}
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
                                required
                                className="input-field h-24 py-2 resize-none"
                                value={formData.experience}
                                onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                placeholder="¿Cómo te sentiste? ¿Qué te pareció la reunión?"
                            />
                        </div>
                        <div>
                            <label className="label">Petición de Oración</label>
                            <textarea
                                className="input-field h-24 py-2 resize-none"
                                value={formData.prayer_request}
                                onChange={e => setFormData({ ...formData, prayer_request: e.target.value })}
                                placeholder="(Opcional)"
                            />
                        </div>
                    </div>

                    {/* 5. INTERESES */}
                    <div>
                        <label className="label mb-2 block">Áreas de Interés</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {INTEREST_OPTIONS.map(opt => (
                                <label key={opt} className={`flex items-center gap-2 p-2 border-2 cursor-pointer transition-all ${formData.interest_areas.includes(opt) ? 'border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'border-neutral-200 text-neutral-500 hover:border-black'}`}>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={formData.interest_areas.includes(opt)}
                                        onChange={() => toggleInterest(opt)}
                                    />
                                    <span className="font-bold uppercase text-xs">{opt}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-14 bg-black text-white text-sm font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> ENVIAR</>}
                    </button>

                    <p className="text-xs text-center text-gray-400 mt-4">
                        Al enviar este formulario aceptas ser contactado por el equipo de Origen.
                    </p>
                </form>
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
                    height: 2.75rem;
                    padding: 0 0.75rem;
                    border: 2px solid #000;
                    font-weight: 700;
                    outline: none;
                    transition: all;
                    color: #000;
                    background: #fff;
                    font-size: 0.9rem;
                }
                .input-field:focus {
                    box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
                    background-color: #fffbeb; 
                }
            `}</style>
        </div>
    );
};

export default Formulario;
