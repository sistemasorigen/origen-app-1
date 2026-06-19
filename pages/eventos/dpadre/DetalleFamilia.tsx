import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabaseService } from '../../../services/supabaseService';
import { DpadreFamilia, User } from '../../../types';
import { ChevronLeft, Plus, Minus, Loader2, Check } from 'lucide-react';

interface Props { currentUser: User; }

const DetalleFamilia: React.FC<Props> = ({ currentUser }) => {
    const { id }         = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const zona           = (searchParams.get('zona') || 'trivia') as 'trivia' | 'futbol';
    const navigate       = useNavigate();

    const [familia, setFamilia] = useState<DpadreFamilia | null>(null);
    const [loading, setLoading] = useState(true);
    const [delta,   setDelta]   = useState<number>(0);
    const [saving,  setSaving]  = useState(false);
    const [saved,   setSaved]   = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        supabaseService.getFamilia(id)
            .then(setFamilia)
            .finally(() => setLoading(false));
    }, [id]);

    const handleAplicar = async () => {
        if (!familia || delta === 0) return;
        setSaving(true);
        setError(null);
        const ok = await supabaseService.ajustarPuntosFamilia(
            familia.id, delta, zona, currentUser.id
        );
        if (ok) {
            setFamilia(f => f ? { ...f, totalPoints: Math.max(0, f.totalPoints + delta) } : f);
            setDelta(0);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } else {
            setError('Error al guardar. Intentá de nuevo.');
        }
        setSaving(false);
    };

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
    );

    if (!familia) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <p className="text-gray-400 text-sm">Familia no encontrada.</p>
        </div>
    );

    const btnBase = `w-11 h-11 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 active:scale-95 transition-all`;

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-lg mx-auto px-4 py-10">

                {/* Back */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-8 font-medium"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Volver
                </button>

                {/* Header */}
                <div className="mb-8">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-1.5">
                        {zona === 'trivia' ? 'Zona de Trivia' : 'Fútbol Tenis'}
                    </p>
                    <h1 className="text-3xl font-semibold text-gray-900 tracking-tight leading-tight">
                        {familia.padreNombre} {familia.padreApellido}
                    </h1>
                </div>

                {/* Puntos actuales */}
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-6 mb-6 text-center">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-2">
                        Puntos acumulados
                    </p>
                    <p className="text-5xl font-semibold text-gray-900 tabular-nums tracking-tight">
                        {familia.totalPoints}
                    </p>
                </div>

                {/* Miembros */}
                <div className="mb-8">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-3">
                        Familia
                    </p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                                <span className="text-xs font-semibold text-gray-500">P</span>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900">
                                    {familia.padreNombre} {familia.padreApellido}
                                </p>
                                <p className="text-[11px] text-gray-400 font-normal">Padre</p>
                            </div>
                        </div>

                        {(familia.hijos || []).map(hijo => (
                            <div key={hijo.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-100">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-semibold text-gray-400">H</span>
                                </div>
                                <p className="text-sm font-medium text-gray-700">
                                    {hijo.nombre} {hijo.apellido}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Panel de puntos */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-4">
                        Ajustar puntos
                    </p>

                    {/* Control +/- */}
                    <div className="flex items-center justify-center gap-6 mb-6">
                        <button
                            type="button"
                            onClick={() => setDelta(d => d - 1)}
                            aria-label="Restar un punto"
                            className={btnBase}
                        >
                            <Minus className="w-4 h-4" aria-hidden="true" />
                        </button>

                        <div className="text-center min-w-[80px]" aria-live="polite" aria-atomic="true">
                            <p className={`text-4xl font-semibold tabular-nums transition-colors ${
                                delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-300'
                            }`}>
                                {delta > 0 ? '+' : ''}{delta}
                            </p>
                            <p className="text-[11px] text-gray-300 font-medium mt-0.5">puntos</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setDelta(d => d + 1)}
                            aria-label="Sumar un punto"
                            className={btnBase}
                        >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>

                    {/* Shortcuts */}
                    <div className="flex gap-2 mb-5 flex-wrap justify-center">
                        {[5, 10, 25, 50].map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setDelta(v)}
                                aria-label={`Sumar ${v} puntos`}
                                className="px-4 py-2.5 min-h-[44px] rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-900 active:scale-95 transition-all"
                            >
                                +{v}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <p className="text-sm text-red-500 text-center mb-4">{error}</p>
                    )}

                    {/* Botón aplicar */}
                    <button
                        type="button"
                        onClick={handleAplicar}
                        disabled={delta === 0 || saving}
                        className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                            saved
                                ? 'bg-green-500 text-white'
                                : delta !== 0 && !saving
                                    ? 'bg-gray-900 text-white hover:bg-black'
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <><Check className="w-4 h-4" /> Guardado</>
                        ) : (
                            'Aplicar puntos'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DetalleFamilia;
