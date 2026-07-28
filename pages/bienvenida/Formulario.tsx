
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Send, ChevronDown } from 'lucide-react';
import { useToast } from '../../pages/punto-informacion/context/ContextoToast';

interface Country {
    name: string;
    flag: string;
    iso: string;
    dialCode: string;
}

const COUNTRIES: Country[] = [
    { name: 'Argentina',            flag: '🇦🇷', iso: 'AR', dialCode: '+54'  },
    { name: 'Bolivia',              flag: '🇧🇴', iso: 'BO', dialCode: '+591' },
    { name: 'Brasil',               flag: '🇧🇷', iso: 'BR', dialCode: '+55'  },
    { name: 'Chile',                flag: '🇨🇱', iso: 'CL', dialCode: '+56'  },
    { name: 'Colombia',             flag: '🇨🇴', iso: 'CO', dialCode: '+57'  },
    { name: 'Costa Rica',           flag: '🇨🇷', iso: 'CR', dialCode: '+506' },
    { name: 'Cuba',                 flag: '🇨🇺', iso: 'CU', dialCode: '+53'  },
    { name: 'Ecuador',              flag: '🇪🇨', iso: 'EC', dialCode: '+593' },
    { name: 'El Salvador',          flag: '🇸🇻', iso: 'SV', dialCode: '+503' },
    { name: 'España',               flag: '🇪🇸', iso: 'ES', dialCode: '+34'  },
    { name: 'Estados Unidos',       flag: '🇺🇸', iso: 'US', dialCode: '+1'   },
    { name: 'Guatemala',            flag: '🇬🇹', iso: 'GT', dialCode: '+502' },
    { name: 'Honduras',             flag: '🇭🇳', iso: 'HN', dialCode: '+504' },
    { name: 'México',               flag: '🇲🇽', iso: 'MX', dialCode: '+52'  },
    { name: 'Nicaragua',            flag: '🇳🇮', iso: 'NI', dialCode: '+505' },
    { name: 'Panamá',               flag: '🇵🇦', iso: 'PA', dialCode: '+507' },
    { name: 'Paraguay',             flag: '🇵🇾', iso: 'PY', dialCode: '+595' },
    { name: 'Perú',                 flag: '🇵🇪', iso: 'PE', dialCode: '+51'  },
    { name: 'Puerto Rico',          flag: '🇵🇷', iso: 'PR', dialCode: '+1'   },
    { name: 'República Dominicana', flag: '🇩🇴', iso: 'DO', dialCode: '+1'   },
    { name: 'Uruguay',              flag: '🇺🇾', iso: 'UY', dialCode: '+598' },
    { name: 'Venezuela',            flag: '🇻🇪', iso: 'VE', dialCode: '+58'  },
    { name: 'Alemania',             flag: '🇩🇪', iso: 'DE', dialCode: '+49'  },
    { name: 'Australia',            flag: '🇦🇺', iso: 'AU', dialCode: '+61'  },
    { name: 'Canada',               flag: '🇨🇦', iso: 'CA', dialCode: '+1'   },
    { name: 'China',                flag: '🇨🇳', iso: 'CN', dialCode: '+86'  },
    { name: 'Francia',              flag: '🇫🇷', iso: 'FR', dialCode: '+33'  },
    { name: 'India',                flag: '🇮🇳', iso: 'IN', dialCode: '+91'  },
    { name: 'Israel',               flag: '🇮🇱', iso: 'IL', dialCode: '+972' },
    { name: 'Italia',               flag: '🇮🇹', iso: 'IT', dialCode: '+39'  },
    { name: 'Japón',                flag: '🇯🇵', iso: 'JP', dialCode: '+81'  },
    { name: 'Portugal',             flag: '🇵🇹', iso: 'PT', dialCode: '+351' },
    { name: 'Reino Unido',          flag: '🇬🇧', iso: 'GB', dialCode: '+44'  },
    { name: 'Suiza',                flag: '🇨🇭', iso: 'CH', dialCode: '+41'  },
];

const INTEREST_OPTIONS = ['Domingos', 'Grupos GCX', 'Voluntarios', 'Oración', 'Bautismos', 'Niños'];
const FORM_RATE_KEY = 'form_last_submit';
const FORM_RATE_MS = 60_000;

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
        interest_areas: [] as string[],
        prayer_request: ''
    });

    // Selector de país
    const [selectedCountry, setSelectedCountry] =
        useState<Country>(COUNTRIES[0]); // Argentina por defecto
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const countryRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] =
        useState({ top: 0, left: 0, width: 288 });

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                countryRef.current &&
                !countryRef.current.contains(e.target as Node)
            ) {
                setIsCountryOpen(false);
                setCountrySearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const openDropdown = () => {
        if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setDropdownPos({ top: r.bottom + 4, left: r.left, width: 288 });
        }
        setIsCountryOpen(o => !o);
        setCountrySearch('');
    };

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.dialCode.includes(countrySearch)
    );

    const toggleInterest = (interest: string) => {
        const current = formData.interest_areas;
        if (current.includes(interest)) {
            setFormData({ ...formData, interest_areas: current.filter(i => i !== interest) });
        } else {
            setFormData({ ...formData, interest_areas: [...current, interest] });
        }
    };

    // Normaliza un número a solo dígitos para comparar sin importar el formato
    const normalizePhone = (phone: string): string =>
        phone.replace(/\D/g, '');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const lastSubmit = sessionStorage.getItem(FORM_RATE_KEY);
        if (lastSubmit) {
            const elapsed = Date.now() - parseInt(lastSubmit, 10);
            if (elapsed < FORM_RATE_MS) {
                const remaining = Math.ceil((FORM_RATE_MS - elapsed) / 1000);
                toast.error(`Por favor esperá ${remaining} segundos antes de volver a enviar.`);
                return;
            }
        }

        setIsLoading(true);

        try {
            // Construir número normalizado para comparar
            // El número en DB es "+54 9 11 1234-5678"
            // El usuario puede tipear "9 11 1234-5678" o "11 1234-5678"
            // → normalizamos ambos a solo dígitos y comparamos por sufijo
            const localDigits = formData.phone
                .replace(/\D/g, '')
                .replace(/^0+/, '');
            const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
            const phoneNormalized = `${dialDigits}${localDigits}`;

            // PASO A: buscar por nombre vía RPC. El .ilike() que había antes
            // era un match exacto: no toleraba un espacio sobrante en el dato
            // cargado en recepción, y la persona no se encontraba a sí misma.
            // El RPC compara con btrim() + lower() de los dos lados.
            const { data: byName, error: nameSearchError } = await supabase
                .rpc('search_welcome_visitor', {
                    p_first_name: formData.firstName.trim(),
                    p_last_name: formData.lastName.trim()
                });

            if (nameSearchError) {
                console.error('Search error', nameSearchError);
                toast.error('Error al buscar registro.');
                setIsLoading(false);
                return;
            }

            // PASO B: de los que matchean el nombre, encontrar el que
            // tiene el teléfono más cercano comparando sufijos de dígitos
            const existingVisitor = (byName || []).find(v => {
                const dbPhoneNorm = normalizePhone(v.phone || '');
                const minLen = Math.min(phoneNormalized.length, dbPhoneNorm.length);
                // Mínimo 8 dígitos para evitar falsos positivos
                if (minLen < 8) return false;
                return (
                    dbPhoneNorm.endsWith(phoneNormalized.slice(-minLen)) ||
                    phoneNormalized.endsWith(dbPhoneNorm.slice(-minLen))
                );
            }) || null;

            if (!existingVisitor) {
                toast.error(
                    'No encontramos tu registro. ' +
                    'Verificá que el nombre y teléfono ' +
                    'sean exactamente los que diste en recepción.'
                );
                setTimeout(() => navigate('/auth'), 3000);
                return;
            }

            const updateData = {
                email: formData.email,
                experience_description: formData.experience,
                stage: 'FILLED_FORM',
                is_first_time: formData.is_first_time === null ? false : formData.is_first_time,
                interest_areas: formData.interest_areas,
                prayer_request: formData.prayer_request
            };

            const { error: updateError } = await supabase
                .from('welcome_visitors')
                .update(updateData)
                .eq('id', existingVisitor.id);

            if (updateError) throw updateError;

            sessionStorage.setItem(FORM_RATE_KEY, Date.now().toString());
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
                                <p className="text-[11px] text-neutral-400 font-medium mb-1.5 leading-snug">
                                    El mismo número que le diste al equipo de bienvenida.
                                    Seleccioná tu país y escribí el número sin el 0 inicial.
                                </p>

                                {/* Selector de país + input — wrapper con borde único */}
                                <div className="flex" style={{ border: '2px solid #d1d5db' }}>

                                    {/* Selector de país */}
                                    <div ref={countryRef} className="relative shrink-0">
                                        <button
                                            ref={btnRef}
                                            type="button"
                                            onClick={openDropdown}
                                            className="h-11 px-3 bg-neutral-50 hover:bg-neutral-100 transition-colors flex items-center gap-2 text-black focus:outline-none cursor-pointer"
                                            style={{ borderRight: '2px solid #d1d5db' }}
                                        >
                                            <span
                                                className="text-[10px] font-black text-neutral-500 bg-neutral-200 px-1.5 py-0.5 leading-none tabular-nums"
                                                style={{ minWidth: 26, textAlign: 'center' }}
                                            >
                                                {selectedCountry.iso}
                                            </span>
                                            <span className="text-xs font-black tabular-nums text-black">
                                                {selectedCountry.dialCode}
                                            </span>
                                            <ChevronDown
                                                size={12}
                                                className={`text-neutral-400 transition-transform duration-150 ${isCountryOpen ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {/* Dropdown de países */}
                                        {isCountryOpen && (
                                            <div
                                                className="bg-white flex flex-col overflow-hidden"
                                                style={{
                                                    position: 'fixed',
                                                    top: dropdownPos.top,
                                                    left: dropdownPos.left,
                                                    width: dropdownPos.width,
                                                    zIndex: 9999,
                                                    border: '2px solid black',
                                                    boxShadow: '6px 6px 0px 0px rgba(0,0,0,1)',
                                                }}
                                            >
                                                <div className="p-2 bg-neutral-50" style={{ borderBottom: '2px solid black' }}>
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        placeholder="Buscar país o prefijo..."
                                                        value={countrySearch}
                                                        onChange={e => setCountrySearch(e.target.value)}
                                                        className="w-full h-9 px-3 text-xs font-bold text-black bg-white"
                                                        style={{ border: '2px solid black', outline: 'none' }}
                                                    />
                                                </div>
                                                <div className="overflow-y-auto max-h-52">
                                                    {filteredCountries.length === 0 ? (
                                                        <p className="px-4 py-5 text-xs font-bold text-neutral-400 text-center uppercase tracking-widest">
                                                            Sin resultados
                                                        </p>
                                                    ) : (
                                                        filteredCountries.map(c => {
                                                            const isSelected = selectedCountry.iso === c.iso;
                                                            return (
                                                                <button
                                                                    key={`${c.dialCode}-${c.iso}`}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedCountry(c);
                                                                        setIsCountryOpen(false);
                                                                        setCountrySearch('');
                                                                    }}
                                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-left transition-colors cursor-pointer ${
                                                                        isSelected ? 'bg-black text-white' : 'text-black hover:bg-neutral-100'
                                                                    }`}
                                                                >
                                                                    <span
                                                                        className={`text-[9px] font-black px-1 py-0.5 leading-none shrink-0 ${
                                                                            isSelected ? 'bg-white text-black' : 'bg-black text-white'
                                                                        }`}
                                                                        style={{ minWidth: 22, textAlign: 'center' }}
                                                                    >
                                                                        {c.iso}
                                                                    </span>
                                                                    <span className="flex-1 truncate">{c.name}</span>
                                                                    <span className={`tabular-nums shrink-0 text-[11px] ${isSelected ? 'text-white/60' : 'text-neutral-400'}`}>
                                                                        {c.dialCode}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Input del número — sin borde propio, lo hereda el wrapper */}
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="flex-1 h-11 px-3 font-bold text-black bg-white outline-none min-w-0"
                                        style={{ border: 'none', fontSize: '0.9rem' }}
                                        placeholder="9 11 1234-5678"
                                    />
                                </div>
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
