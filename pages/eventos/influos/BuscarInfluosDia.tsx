import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchInfluosDia, InfluosDiaSearchResult } from '../../../services/supabaseService';
import { InfluosDiaTribu } from '../../../types';
import { ArrowLeft, Search, Loader2, User, CheckCircle2 } from 'lucide-react';

// --------------- ANIMATION STYLES ---------------
// Mismo bloque que InscripcionInfluosDia.tsx — ambas páginas del
// mismo evento comparten vocabulario visual y viven bajo el mismo
// override de inputs de index.html.
const ANIMATION_STYLES = `
    @keyframes floatY {
        0%, 100% { transform: translateY(0px); }
        50%       { transform: translateY(-12px); }
    }
    .anim-floatY {
        animation: floatY 3s ease-in-out infinite;
    }
    .stagger-1 { animation-delay: 0.1s; }
    .stagger-2 { animation-delay: 0.22s; }
    .stagger-3 { animation-delay: 0.36s; }

    @media (prefers-reduced-motion: reduce) {
        .anim-floatY { animation: none; }
    }

    /* Ver nota igual en InscripcionInfluosDia.tsx: index.html fuerza
       TODOS los inputs a fondo blanco con !important (especificidad
       0,9,1 por los 9 :not([type=...])). Se iguala esa cadena y se
       le suma scope + clase repetida para ganar siempre. */
    .influos-dia-form.influos-dia-form input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="image"]) {
        background-color: #171717 !important;
        color: #ffffff !important;
        border: 2px solid #404040 !important;
        border-radius: 0 !important;
    }
    .influos-dia-form.influos-dia-form input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]):not([type="color"]):not([type="image"]):focus {
        border-color: #a78bfa !important;
        outline: 2px solid transparent !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.3) !important;
    }
    .influos-dia-form.influos-dia-form input::placeholder {
        color: #737373 !important;
    }
`;

// --------------- TRIBU THEMES ---------------
// Mismas 3 entradas que InscripcionInfluosDia.tsx / InfluosAcceso.tsx.
const TRIBU_THEMES: Record<string, { bg: string; text: string; border: string }> = {
    'Garra':    { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500/40' },
    'Trueno':   { bg: 'bg-sky-400',    text: 'text-white', border: 'border-sky-400/40' },
    'No tengo': { bg: 'bg-violet-600', text: 'text-white', border: 'border-violet-600/40' },
};
const getTribuTheme = (tribu: string) => TRIBU_THEMES[tribu] ?? TRIBU_THEMES['No tengo'];

const inputClass = 'w-full px-5 py-4 text-lg font-bold bg-neutral-900 border-2 border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 transition-all duration-200';
const labelClass = 'block text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-2';
const primaryBtn = 'w-full py-5 font-black uppercase tracking-widest text-sm border-4 border-white bg-white text-black hover:bg-neutral-100 transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black';

// Esferas borrosas de fondo — misma atmósfera que /influos-acceso y
// la inscripción.
const Ambience: React.FC = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full opacity-[0.07] bg-violet-500 blur-3xl anim-floatY stagger-1" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 rounded-full opacity-[0.07] bg-orange-500 blur-3xl anim-floatY stagger-3" />
        <div className="absolute top-3/4 left-1/3 w-40 h-40 rounded-full opacity-[0.05] bg-sky-500 blur-3xl anim-floatY stagger-2" />
    </div>
);

const ResultCard: React.FC<{ r: InfluosDiaSearchResult }> = ({ r }) => {
    const theme = getTribuTheme(r.tribu);
    return (
        <div className={`bg-neutral-900 border-2 ${theme.border} p-5 flex items-center gap-4`}>
            <div className="w-11 h-11 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-neutral-400" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-black text-white uppercase truncate">{r.firstName} {r.lastName}</p>
                <p className="text-xs text-neutral-500 font-bold">{r.age} años</p>
            </div>
            <span className={`shrink-0 px-3 py-1.5 ${theme.bg} ${theme.text} text-[10px] font-black uppercase tracking-wide`}>
                {r.tribu === 'No tengo' ? 'Sin tribu' : (r.tribu as InfluosDiaTribu)}
            </span>
        </div>
    );
};

const BuscarInfluosDia: React.FC = () => {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [results, setResults] = useState<InfluosDiaSearchResult[]>([]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSearched(false);
        const data = await searchInfluosDia(firstName.trim(), lastName.trim());
        setResults(data);
        setSearched(true);
        setLoading(false);
    };

    return (
        <>
            <style>{ANIMATION_STYLES}</style>
            <div className="influos-dia-form w-full min-h-screen bg-black py-8 px-4 relative overflow-hidden">
                <Ambience />

                <div className="relative z-10 max-w-md mx-auto">
                    <button
                        onClick={() => navigate('/dia-de-influos')}
                        className="min-h-[44px] px-3 -mx-3 -my-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-neutral-600 hover:text-white transition-colors mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Volver a la inscripción
                    </button>

                    <div className="text-center mb-8">
                        <img src="/origen-logo.png" alt="Origen" className="h-8 w-auto object-contain invert opacity-50 mx-auto mb-6" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-500 mb-2">
                            Influos 2026
                        </p>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white leading-none">
                            Buscá tu inscripción
                        </h1>
                        <p className="text-sm text-neutral-500 mt-3">Ingresá los datos con los que te anotaste</p>
                    </div>

                    <form onSubmit={handleSearch} className="space-y-5">
                        <div>
                            <label htmlFor="bi-firstName" className={labelClass}>Nombre</label>
                            <input
                                id="bi-firstName" type="text" placeholder="Nombre..." autoComplete="given-name" required
                                value={firstName} onChange={e => setFirstName(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="bi-lastName" className={labelClass}>Apellido</label>
                            <input
                                id="bi-lastName" type="text" placeholder="Apellido..." autoComplete="family-name" required
                                value={lastName} onChange={e => setLastName(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <button type="submit" disabled={loading} className={primaryBtn}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                    </form>

                    <div className="mt-6" aria-live="polite">
                        {searched && !loading && (
                            results.length === 0 ? (
                                <div className="border-2 border-dashed border-neutral-700 p-8 text-center">
                                    <p className="text-neutral-400 font-bold uppercase text-sm">
                                        No encontramos ninguna inscripción con esos datos.
                                    </p>
                                    <p className="text-xs text-neutral-600 mt-2">
                                        Verificá que estén escritos igual a como los cargaste al anotarte.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs font-black uppercase tracking-widest text-neutral-500">
                                        Encontramos {results.length} inscripción{results.length !== 1 ? 'es' : ''}:
                                    </p>
                                    {results.map(r => <ResultCard key={r.id} r={r} />)}
                                    <div className="flex items-center gap-2 text-xs text-neutral-600 font-bold justify-center pt-2">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Inscripción confirmada
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default BuscarInfluosDia;
