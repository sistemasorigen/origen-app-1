
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

// Prioridad de legibilidad: esto lo completa gente que recién llega a la
// iglesia, a veces desde el celular con poca luz — por eso el label queda
// alto contraste (texto sólido, no atenuado) aunque el resto del chrome sea
// "soft". Mismo criterio de campo que Bienvenida.tsx ya restyleado.
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white mb-1';
const inputCls = 'w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white font-semibold text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-slate-400 dark:focus:border-zinc-600 focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all';

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
            <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center animate-fadeIn">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-3">
                        ¡Gracias!
                    </h1>
                    <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-8">
                        Tus respuestas nos ayudan a conocerte mejor.
                        <br />
                        Te estamos redirigiendo...
                    </p>
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-slate-400 dark:text-zinc-500" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 py-12">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 md:p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                        Bienvenido
                    </h1>
                    <div className="h-1 w-20 bg-slate-900 dark:bg-white mx-auto mb-4 rounded-full" />
                    <p className="text-sm font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                        Queremos conocerte
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* 1. DATOS BÁSICOS */}
                    <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 p-4">
                        <h3 className="font-bold uppercase tracking-tight mb-3 text-sm text-slate-900 dark:text-white">Tus Datos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Nombre</label>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">El mismo nombre con el que te anotaste en recepción.</p>
                                <input
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    className={inputCls}
                                    placeholder="Tu nombre"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Apellido</label>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">El mismo apellido con el que te anotaste en recepción.</p>
                                <input
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    className={inputCls}
                                    placeholder="Tu apellido"
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Teléfono</label>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">
                                    El mismo número que le diste al equipo de bienvenida.
                                    Seleccioná tu país y escribí el número sin el 0 inicial.
                                </p>

                                {/* Selector de país + input — wrapper con borde único */}
                                <div className="flex rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-within:ring-4 focus-within:ring-slate-900/10 dark:focus-within:ring-white/10 focus-within:border-slate-400 dark:focus-within:border-zinc-600 overflow-hidden transition-all">

                                    {/* Selector de país */}
                                    <div ref={countryRef} className="relative shrink-0">
                                        <button
                                            ref={btnRef}
                                            type="button"
                                            onClick={openDropdown}
                                            className="h-11 px-3 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border-r border-slate-200 dark:border-zinc-700 transition-colors flex items-center gap-2 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                                        >
                                            <span
                                                className="min-w-[26px] text-center text-[10px] font-black text-slate-600 dark:text-zinc-300 bg-slate-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded leading-none tabular-nums"
                                            >
                                                {selectedCountry.iso}
                                            </span>
                                            <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white">
                                                {selectedCountry.dialCode}
                                            </span>
                                            <ChevronDown
                                                size={12}
                                                className={`text-slate-400 dark:text-zinc-500 transition-transform duration-150 ${isCountryOpen ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {/* Dropdown de países */}
                                        {isCountryOpen && (
                                            <div
                                                className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-lg flex flex-col overflow-hidden"
                                                style={{
                                                    position: 'fixed',
                                                    top: dropdownPos.top,
                                                    left: dropdownPos.left,
                                                    width: dropdownPos.width,
                                                    zIndex: 9999,
                                                }}
                                            >
                                                <div className="p-2 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        placeholder="Buscar país o prefijo..."
                                                        value={countrySearch}
                                                        onChange={e => setCountrySearch(e.target.value)}
                                                        className="w-full h-9 px-3 text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-700 outline-none focus:border-slate-400 dark:focus:border-zinc-600"
                                                    />
                                                </div>
                                                <div className="overflow-y-auto max-h-52">
                                                    {filteredCountries.length === 0 ? (
                                                        <p className="px-4 py-5 text-xs font-bold text-slate-400 dark:text-zinc-500 text-center uppercase tracking-widest">
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
                                                                        isSelected ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
                                                                    }`}
                                                                >
                                                                    <span
                                                                        className={`min-w-[22px] text-center text-[9px] font-black px-1 py-0.5 rounded leading-none shrink-0 ${
                                                                            isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                                                        }`}
                                                                    >
                                                                        {c.iso}
                                                                    </span>
                                                                    <span className="flex-1 truncate">{c.name}</span>
                                                                    <span className={`tabular-nums shrink-0 text-[11px] ${isSelected ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400 dark:text-zinc-500'}`}>
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
                                        className="flex-1 h-11 px-3 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-900 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none min-w-0"
                                        placeholder="9 11 1234-5678"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Email <span className="text-slate-400 dark:text-zinc-500 font-normal">(Opcional)</span></label>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">Solo para enviarte info de la iglesia cuando la tengas. No es obligatorio.</p>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className={inputCls}
                                    placeholder="tu@email.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. SOBRE TU VISITA */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className={labelCls}>¿Es primera vez?</label>
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">¿Es la primera vez que venís a una reunión de Origen?</p>
                            <select
                                className={inputCls}
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
                            <label className={labelCls}>Experiencia / Comentarios</label>
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">Contanos cómo te sentiste hoy, qué fue lo que más te gustó o cualquier cosa que quieras compartir con nosotros.</p>
                            <textarea
                                required
                                className={`${inputCls} h-24 py-2 resize-none`}
                                value={formData.experience}
                                onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                placeholder="¿Cómo te sentiste? ¿Qué te pareció la reunión?"
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Petición de Oración</label>
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">Si hay algo por lo que querés que oremos por vos, escribilo acá. Es confidencial.</p>
                            <textarea
                                className={`${inputCls} h-24 py-2 resize-none`}
                                value={formData.prayer_request}
                                onChange={e => setFormData({ ...formData, prayer_request: e.target.value })}
                                placeholder="(Opcional)"
                            />
                        </div>
                    </div>

                    {/* 5. INTERESES */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white mb-2">Áreas de Interés</label>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium mb-1.5 leading-snug">Seleccioná todo lo que te llame la atención. Podés elegir más de uno, o ninguno si preferís.</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {INTEREST_OPTIONS.map(opt => (
                                <label key={opt} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${formData.interest_areas.includes(opt) ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-slate-400 dark:hover:border-zinc-500'}`}>
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
                        className="w-full h-14 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-8"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Enviar</>}
                    </button>

                    <p className="text-xs text-center text-slate-400 dark:text-zinc-500 mt-4">
                        Al enviar este formulario aceptas ser contactado por el equipo de Origen.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Formulario;
