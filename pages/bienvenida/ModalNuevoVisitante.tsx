import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Save, ChevronDown } from 'lucide-react';
import { useToast } from '../punto-informacion/context/ContextoToast';
import NeoModal from '../../components/ui/NeoModal';

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

// Mismos tokens que pages/bienvenida/Formulario.tsx — el selector de país y
// los campos de este modal comparten casi textual el patrón visual con ese
// formulario, así que se replican literalmente para que no se note ninguna
// diferencia de tratamiento entre los dos.
const labelCls = 'block text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white mb-1';
const inputCls = 'w-full h-12 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white font-semibold text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:border-slate-400 dark:focus:border-zinc-600 focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all';

interface NewVisitorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const NewVisitorModal: React.FC<NewVisitorModalProps> = ({ isOpen, onClose, onSuccess }) => {
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
    const [selectedCountry, setSelectedCountry] =
        useState<Country>(COUNTRIES[0]); // Argentina por defecto
    const [isCountryOpen, setIsCountryOpen] =
        useState(false);
    const [countrySearch, setCountrySearch] =
        useState('');
    const countryRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 288 });

    // Calcular posición del dropdown relativa al botón
    const openDropdown = () => {
        if (btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setDropdownPos({ top: r.bottom + 4, left: r.left, width: 288 });
        }
        setIsCountryOpen(o => !o);
        setCountrySearch('');
    };

    // Cerrar dropdown al hacer click fuera
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

    const filteredCountries = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(
            countrySearch.toLowerCase()
        ) ||
        c.dialCode.includes(countrySearch)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Construir número completo con prefijo internacional
            // Se elimina el 0 inicial del número local si existe
            // (ej: Argentina "011..." → "11...")
            const localDigits = formData.phone
                .replace(/\D/g, '')
                .replace(/^0+/, '');
            const dialDigits = selectedCountry.dialCode
                .replace(/\D/g, '');
            const phoneClean = `${dialDigits}${localDigits}`;

            // Número completo para guardar en DB
            const phoneForDB =
                `${selectedCountry.dialCode} ${formData.phone.trim()}`;

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
                    age: formData.age
                        ? parseInt(formData.age)
                        : null,
                    phone: phoneForDB,
                    stage: 'NEW',
                    accepted_jesus: formData.accepted_jesus || null,
                    localidad: formData.localidad.trim() || null
                });

            if (error) throw error;

            toast.success('Guardado. Abriendo WhatsApp...');
            onSuccess();
            onClose();
            setFormData({
                firstName: '', lastName: '',
                age: '', phone: '',
                accepted_jesus: '',
                localidad: ''
            });
            setSelectedCountry(COUNTRIES[0]);
        } catch (err: any) {
            console.error('Error in NewVisitorModal:', err);
            toast.error(
                'Error al registrar visitante: ' +
                (err.message || 'Error desconocido')
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <NeoModal isOpen={isOpen} onClose={onClose} title="Nuevo Ingresante">
            <form onSubmit={handleSubmit} className="space-y-5 pt-1">

                {/* ── Datos personales ──────────────────────────── */}
                <fieldset>
                    <legend className="w-full text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                        <span className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                        Datos personales
                        <span className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>
                                Nombre <span className="text-red-500">*</span>
                            </label>
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
                            <label className={labelCls}>
                                Apellido <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Ej: González"
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                className={inputCls}
                            />
                        </div>
                    </div>
                </fieldset>

                {/* ── Edad + Localidad ──────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>
                            Edad
                        </label>
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
                        <label className={labelCls}>
                            Localidad o barrio
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: Palermo, Lomas..."
                            value={formData.localidad}
                            onChange={e => setFormData({ ...formData, localidad: e.target.value })}
                            className={inputCls}
                        />
                    </div>
                </div>

                {/* ── Decisión de Fe ────────────────────────── */}
                {/* Llenado por el equipo de bienvenida,
                    NO aparece en el /form público */}
                <div>
                    <label className={labelCls}>
                        Decisión de Fe
                    </label>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 mb-2 leading-snug tracking-wide">
                        ¿Tomó una decisión en la reunión de hoy?
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {(
                            [
                                { value: 'Si',         label: 'Aceptó hoy' },
                                { value: 'No, antes',  label: 'Ya era cristiano' },
                                { value: 'Cristiano',  label: 'Sin decisión' },
                            ] as { value: '' | 'Si' | 'No, antes' | 'Cristiano'; label: string }[]
                        ).map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                    setFormData({
                                        ...formData,
                                        accepted_jesus:
                                            formData.accepted_jesus === opt.value
                                                ? ''
                                                : opt.value
                                    })
                                }
                                className={`h-10 rounded-xl border text-[10px] font-bold uppercase tracking-wide transition-colors ${
                                    formData.accepted_jesus === opt.value
                                        ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                        : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 hover:border-slate-400 dark:hover:border-zinc-500'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Contacto ─────────────────────────────────── */}
                <fieldset>
                    <legend className="w-full text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500 mb-3 flex items-center gap-2">
                        <span className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                        Contacto
                        <span className="flex-1 h-px bg-slate-200 dark:bg-zinc-700" />
                    </legend>

                    <label className={labelCls}>
                        WhatsApp <span className="text-red-500">*</span>
                    </label>

                    <div className="flex rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus-within:ring-4 focus-within:ring-slate-900/10 dark:focus-within:ring-white/10 focus-within:border-slate-400 dark:focus-within:border-zinc-600 overflow-hidden transition-all">

                        {/* Selector de país */}
                        <div ref={countryRef} className="relative shrink-0">
                            <button
                                ref={btnRef}
                                type="button"
                                onClick={openDropdown}
                                className="h-12 px-3 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border-r border-slate-200 dark:border-zinc-700 transition-colors flex items-center gap-2 text-slate-900 dark:text-white focus:outline-none cursor-pointer"
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

                            {/* Dropdown renderizado en body para superponer el modal */}
                            {isCountryOpen && createPortal(
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
                                    {/* Search */}
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

                                    {/* Country list */}
                                    <div className="overflow-y-auto max-h-52">
                                        {filteredCountries.length === 0 ? (
                                            <p className="px-4 py-5 text-xs font-bold text-slate-400 dark:text-zinc-500 text-center uppercase tracking-widest">
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
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-left transition-colors cursor-pointer ${
                                                            isSelected ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`min-w-[22px] text-center text-[9px] font-black px-1 py-0.5 rounded leading-none shrink-0 ${
                                                                isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                                            }`}
                                                        >
                                                            {country.iso}
                                                        </span>
                                                        <span className="flex-1 truncate">{country.name}</span>
                                                        <span className={`tabular-nums shrink-0 text-[11px] ${isSelected ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400 dark:text-zinc-500'}`}>
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
                            className="flex-1 h-12 px-3 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-zinc-900 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none min-w-0"
                        />
                    </div>

                    <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 mt-1.5 tracking-wide">
                        Se abrirá WhatsApp al guardar para enviar el formulario
                    </p>
                </fieldset>

                {/* ── Submit ────────────────────────────────────── */}
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {isLoading
                            ? <Loader2 size={16} className="animate-spin" />
                            : <><Save size={16} /> Guardar y abrir WhatsApp</>
                        }
                    </button>
                </div>
            </form>
        </NeoModal>
    );
};

export default NewVisitorModal;
