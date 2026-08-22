import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { ChevronLeft, Loader2, Save, ChevronDown } from 'lucide-react';
import { ToastProvider, useToast } from '../punto-informacion/context/ContextoToast';

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

// Mismos tokens que DetalleIngresante.tsx — sin variantes dark:, borde
// border-slate-300/rounded-lg en vez del rounded-xl + dark:* del modal viejo.
const inputCls = 'w-full h-10 px-3 border border-slate-300 rounded-lg text-sm font-medium text-black outline-none focus:border-black transition-colors';
const labelCls = 'block text-xs font-bold uppercase text-slate-400 mb-1';

// Medidas del dropdown de países, usadas para decidir si abre hacia abajo o
// hacia arriba. El alto es el del panel completo: buscador (~53px) + lista
// (max-h-52 = 208px) + bordes.
const DROPDOWN_WIDTH = 288;
const DROPDOWN_HEIGHT = 268;

const NuevoIngresanteContent: React.FC = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        age: '',
        phone: '',
        accepted_jesus: '' as '' | 'Si' | 'No, antes' | 'Cristiano',
        localidad: ''
    });

    // Selector de país
    const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]); // Argentina por defecto
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');
    const countryRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: DROPDOWN_WIDTH });

    // Posición del dropdown relativa al botón, con dos correcciones:
    // abre hacia arriba si no entra abajo (el selector queda cerca del pie del
    // formulario), y clampea a los bordes para no salirse de la pantalla.
    const computeDropdownPos = () => {
        const r = btnRef.current?.getBoundingClientRect();
        if (!r) return null;
        const cabeAbajo = r.bottom + 4 + DROPDOWN_HEIGHT <= window.innerHeight;
        return {
            top: cabeAbajo ? r.bottom + 4 : Math.max(8, r.top - DROPDOWN_HEIGHT - 4),
            left: Math.max(8, Math.min(r.left, window.innerWidth - DROPDOWN_WIDTH - 8)),
            width: DROPDOWN_WIDTH,
        };
    };

    const openDropdown = () => {
        if (isCountryOpen) {
            setIsCountryOpen(false);
            setCountrySearch('');
            return;
        }
        const pos = computeDropdownPos();
        if (pos) setDropdownPos(pos);
        setIsCountryOpen(true);
        setCountrySearch('');
    };

    // El dropdown es position:fixed y se ancla a las coordenadas que tenía el
    // botón al abrirse. Sin esto, al scrollear el botón se movía y el menú
    // quedaba clavado donde estaba: aparecía despegado, flotando sobre el resto
    // del formulario. Se reposiciona en cada scroll/resize; si el botón se fue
    // de pantalla se cierra, en vez de quedar pegado contra un borde.
    useEffect(() => {
        if (!isCountryOpen) return;
        let frame = 0;
        const reposition = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const r = btnRef.current?.getBoundingClientRect();
                if (!r) return;
                if (r.bottom < 0 || r.top > window.innerHeight) {
                    setIsCountryOpen(false);
                    setCountrySearch('');
                    return;
                }
                const pos = computeDropdownPos();
                if (pos) setDropdownPos(pos);
            });
        };
        // capture: el scroll puede venir de un contenedor interno y no del window
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [isCountryOpen]);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
                setIsCountryOpen(false);
                setCountrySearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.dialCode.includes(countrySearch)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Construir número completo con prefijo internacional
            // Se elimina el 0 inicial del número local si existe
            // (ej: Argentina "011..." → "11...")
            const localDigits = formData.phone.replace(/\D/g, '').replace(/^0+/, '');
            const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
            const phoneClean = `${dialDigits}${localDigits}`;

            // Número completo para guardar en DB
            const phoneForDB = `${selectedCountry.dialCode} ${formData.phone.trim()}`;

            const message = `Bienvenido/a a Origen Iglesia
Gracias por estar hoy con nosotros.
Creemos que cada persona tiene un propósito y que Dios sigue escribiendo historias nuevas.
Este formulario es solo para conocerte un poco mejor y poder acompañarte:
https://app.origeniglesia.org/#/form

Tus respuestas son confidenciales y podés completar solo lo que quieras.
Gracias por tomarte unos minutos.
¡Bienvenido/a a casa!`;

            const url = `https://wa.me/${phoneClean}?text=${encodeURIComponent(message)}`;

            // CRÍTICO: window.open ANTES del await.
            // Safari iOS bloquea window.open después de
            // cualquier await porque lo considera un popup
            // no iniciado directamente por el usuario.
            window.open(url, '_blank');

            // Guardar en DB con número completo
            const { error } = await supabase
                .from('welcome_visitors')
                .insert({
                    // trim obligatorio: un espacio sobrante acá rompe la
                    // búsqueda del visitante en el formulario público
                    first_name: formData.firstName.trim(),
                    last_name: formData.lastName.trim(),
                    age: formData.age ? parseInt(formData.age) : null,
                    phone: phoneForDB,
                    stage: 'NEW',
                    accepted_jesus: formData.accepted_jesus || null,
                    localidad: formData.localidad.trim() || null
                });

            if (error) throw error;

            toast.success('Guardado. Abriendo WhatsApp...');
            // Mismo motivo que en DetalleIngresante.tsx: el ToastProvider
            // vive DENTRO de esta página, así que navegar de inmediato
            // desmonta el toast antes de que llegue a pintarse. Medido con
            // MutationObserver en esa página: sin el delay, el toast nunca
            // aparece en el DOM.
            setTimeout(() => navigate('/bienvenida'), 600);
            // No hace falta resetear formData/selectedCountry al final: la
            // página entera se desmonta al navegar, a diferencia del modal
            // viejo que seguía montado detrás de otros modales.
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            console.error('[NuevoIngresante] Error al registrar visitante:', err);
            toast.error('Error al registrar visitante: ' + msg);
            setIsLoading(false);
        }
    };

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
                    Nuevo Ingresante
                </h1>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Datos personales */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold uppercase text-sm text-black mb-3">Datos Personales</h3>
                        {/* Un campo por hilera: a 375px los pares Nombre/Apellido
                            y Edad/Localidad quedaban en cajas de ~140px, con los
                            placeholders cortados ("Ej: Palermo, Lom"). El form ya
                            vive en una columna max-w-2xl, así que la fila completa
                            tampoco queda desproporcionada en desktop. */}
                        <div className="grid grid-cols-1 gap-4 mb-4">
                            <div>
                                <label className={labelCls}>Nombre <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Valentina"
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Apellido <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: González"
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Edad</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    placeholder="Ej: 28"
                                    value={formData.age}
                                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>Localidad o barrio</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Palermo, Lomas..."
                                    value={formData.localidad}
                                    onChange={e => setFormData({ ...formData, localidad: e.target.value })}
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Decisión de Fe — llenado por el equipo de bienvenida,
                            NO aparece en el /form público */}
                        <div>
                            <label className={labelCls}>Decisión de Fe</label>
                            <p className="text-[11px] font-medium text-slate-400 mb-2">
                                ¿Tomó una decisión en la reunión de hoy?
                            </p>
                            {/* Los value van tal cual a la columna accepted_jesus:
                                'Si' / 'No, antes' / 'Cristiano'. La opción vacía
                                se guarda como null (ver el insert). */}
                            <select
                                value={formData.accepted_jesus}
                                onChange={e =>
                                    setFormData({
                                        ...formData,
                                        accepted_jesus: e.target.value as '' | 'Si' | 'No, antes' | 'Cristiano'
                                    })
                                }
                                className={`${inputCls} cursor-pointer`}
                            >
                                <option value="">Elegir opción...</option>
                                <option value="Si">Aceptó hoy</option>
                                <option value="No, antes">Ya era cristiano</option>
                                <option value="Cristiano">Sin decisión</option>
                            </select>
                        </div>
                    </div>

                    {/* Contacto */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
                        <h3 className="font-bold uppercase text-sm text-black mb-3">Contacto</h3>

                        <label className={labelCls}>WhatsApp <span className="text-red-500">*</span></label>

                        <div className="flex rounded-lg border border-slate-300 bg-white focus-within:border-black overflow-hidden transition-colors">

                            {/* Selector de país */}
                            <div ref={countryRef} className="relative shrink-0">
                                <button
                                    ref={btnRef}
                                    type="button"
                                    onClick={openDropdown}
                                    className="h-10 px-3 bg-slate-50 hover:bg-slate-100 border-r border-slate-300 transition-colors flex items-center gap-2 text-black focus:outline-none cursor-pointer"
                                >
                                    <span className="min-w-[26px] text-center text-[10px] font-black text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded leading-none tabular-nums">
                                        {selectedCountry.iso}
                                    </span>
                                    <span className="text-xs font-black tabular-nums text-black">
                                        {selectedCountry.dialCode}
                                    </span>
                                    <ChevronDown
                                        size={12}
                                        className={`text-slate-400 transition-transform duration-150 ${isCountryOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {/* Dropdown renderizado en body para no quedar recortado por overflow */}
                                {isCountryOpen && createPortal(
                                    <div
                                        className="bg-white rounded-lg border border-slate-200 shadow-lg flex flex-col overflow-hidden"
                                        style={{
                                            position: 'fixed',
                                            top: dropdownPos.top,
                                            left: dropdownPos.left,
                                            width: dropdownPos.width,
                                            zIndex: 9999,
                                        }}
                                    >
                                        {/* Search */}
                                        <div className="p-2 bg-slate-50 border-b border-slate-200">
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Buscar país o prefijo..."
                                                value={countrySearch}
                                                onChange={e => setCountrySearch(e.target.value)}
                                                className="w-full h-9 px-3 text-xs font-bold text-black bg-white rounded-lg border border-slate-200 outline-none focus:border-black"
                                            />
                                        </div>

                                        {/* Country list */}
                                        <div className="overflow-y-auto max-h-52">
                                            {filteredCountries.length === 0 ? (
                                                <p className="px-4 py-5 text-xs font-bold text-slate-400 text-center uppercase tracking-widest">
                                                    Sin resultados
                                                </p>
                                            ) : (
                                                filteredCountries.map(country => {
                                                    const isSelected = selectedCountry.name === country.name;
                                                    return (
                                                        <button
                                                            key={`${country.dialCode}-${country.name}`}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedCountry(country);
                                                                setIsCountryOpen(false);
                                                                setCountrySearch('');
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-left transition-colors cursor-pointer ${isSelected ? 'bg-black text-white' : 'text-black hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            <span
                                                                className={`min-w-[22px] text-center text-[9px] font-black px-1 py-0.5 rounded leading-none shrink-0 ${isSelected ? 'bg-white text-black' : 'bg-black text-white'
                                                                    }`}
                                                            >
                                                                {country.iso}
                                                            </span>
                                                            <span className="flex-1 truncate">{country.name}</span>
                                                            <span className={`tabular-nums shrink-0 text-[11px] ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>
                                                                {country.dialCode}
                                                            </span>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>,
                                    document.body
                                )}
                            </div>

                            {/* Número local — sin borde propio, lo hereda el wrapper */}
                            <input
                                type="tel"
                                required
                                placeholder="Número sin 0 ni 15"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="flex-1 h-10 px-3 text-sm font-medium text-black bg-white placeholder:text-slate-400 outline-none min-w-0"
                            />
                        </div>

                        <p className="text-[11px] text-slate-400 mt-1.5">
                            Se abrirá WhatsApp al guardar para enviar el formulario
                        </p>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                        >
                            {isLoading
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <><Save className="w-4 h-4" /> Guardar y abrir WhatsApp</>
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Ruta propia (/bienvenida/nuevo), no un hijo de Bienvenida.tsx — mismo
// motivo que DetalleIngresante.tsx: necesita su propio ToastProvider,
// useToast() explota sin uno en el árbol.
const NuevoIngresante: React.FC = () => (
    <ToastProvider>
        <NuevoIngresanteContent />
    </ToastProvider>
);

export default NuevoIngresante;
