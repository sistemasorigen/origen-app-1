
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Send } from 'lucide-react';
import { useToast } from '../../pages/punto-informacion/context/ContextoToast';

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
        is_first_time: null as boolean | null,
        // referral_source: '', // REMOVED
        // wants_growth: '',    // REMOVED
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
                .select('id, first_name, last_name')
                .eq('phone', formData.phone)
                .order('created_at', { ascending: false })
                .limit(1);

            if (searchError) {
                console.error("Search error", searchError);
                toast.error('Error al buscar registro.');
                setIsLoading(false);
                return;
            }

            const existingVisitor = existingVisitors && existingVisitors.length > 0 ? existingVisitors[0] : null;

            // VALIDATION: Check if visitor exists
            if (!existingVisitor) {
                toast.error('No se encontró un registro previo con este teléfono. Por favor acercate a recepción.');
                setTimeout(() => navigate('/auth'), 3000);
                return;
            }

            // VALIDATION: Check if Name and Surname match (Case insensitive, trimmed)
            const dbName = existingVisitor.first_name?.trim().toLowerCase() || '';
            const inputName = formData.firstName.trim().toLowerCase();
            const dbLast = existingVisitor.last_name?.trim().toLowerCase() || '';
            const inputLast = formData.lastName.trim().toLowerCase();

            if (dbName !== inputName || dbLast !== inputLast) {
                toast.error('El nombre y apellido no coinciden con nuestros registros de Bienvenida.');
                setTimeout(() => navigate('/auth'), 3000);
                return;
            }

            const updateData = {
                email: formData.email,
                experience_description: formData.experience,
                stage: 'FILLED_FORM',
                // Keep original names to ensure consistency, or update if slight fix? User asked to validate match.
                // We update the other fields.
                // first_name: formData.firstName, // Optional: if we want to correct casing
                // last_name: formData.lastName, 

                // New Fields
                is_first_time: formData.is_first_time === null ? false : formData.is_first_time,
                // referral_source: formData.referral_source, // REMOVED
                // wants_growth: formData.wants_growth,       // REMOVED
                interest_areas: formData.interest_areas,
                prayer_request: formData.prayer_request
            };

            // Update existing
            const { error: updateError } = await supabase
                .from('welcome_visitors')
                .update(updateData)
                .eq('id', existingVisitor.id);

            if (updateError) throw updateError;

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
                                <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">El mismo nombre con el que te anotaste en recepción.</p>
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
                                <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">El mismo apellido con el que te anotaste en recepción.</p>
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
                                <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">El mismo número que le diste al equipo de bienvenida. Lo usamos para identificarte.</p>
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
                                <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">Solo para enviarte info de la iglesia cuando la tengas. No es obligatorio.</p>
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
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="label">¿Es primera vez?</label>
                            <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">¿Es la primera vez que venís a una reunión de Origen?</p>
                            <select
                                className="input-field"
                                required
                                value={formData.is_first_time === null ? '' : (formData.is_first_time ? 'yes' : 'no')}
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, is_first_time: val === '' ? null : val === 'yes' });
                                }}
                            >
                                <option value="">- Seleccionar -</option>
                                <option value="yes">Primera vez</option>
                                <option value="no">Ya había venido</option>
                            </select>
                        </div>
                    </div>

                    {/* 3. EXPERIENCIA & ORACION */}
                    <div className="space-y-4">
                        <div>
                            <label className="label">Experiencia / Comentarios</label>
                            <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">Contanos cómo te sentiste hoy, qué fue lo que más te gustó o cualquier cosa que quieras compartir con nosotros.</p>
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
                            <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">Si hay algo por lo que querés que oremos por vos, escribilo acá. Es confidencial.</p>
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
                        <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">Seleccioná todo lo que te llame la atención. Podés elegir más de uno, o ninguno si preferís.</p>
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
