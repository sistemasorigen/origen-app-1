import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabaseService } from '../../../services/supabaseService';
import { Plus, Trash2, Loader2, CheckCircle, Trophy } from 'lucide-react';

const InscripcionDPadre: React.FC = () => {
    const navigate = useNavigate();
    const [screen, setScreen] = useState<'form' | 'success'>('form');

    const [padreNombre,   setPadreNombre]   = useState('');
    const [padreApellido, setPadreApellido] = useState('');
    const [hijos, setHijos] = useState<{ nombre: string; apellido: string }[]>([
        { nombre: '', apellido: '' }
    ]);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState<string | null>(null);

    const addHijo = () =>
        setHijos(h => [...h, { nombre: '', apellido: '' }]);

    const removeHijo = (idx: number) =>
        setHijos(h => h.filter((_, i) => i !== idx));

    const updateHijo = (idx: number, field: 'nombre' | 'apellido', value: string) =>
        setHijos(h => h.map((item, i) => i === idx ? { ...item, [field]: value } : item));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!padreNombre.trim() || !padreApellido.trim()) {
            setError('Completá el nombre y apellido del padre.');
            return;
        }

        const hijosValidos = hijos.filter(h => h.nombre.trim() && h.apellido.trim());

        setLoading(true);
        const result = await supabaseService.inscribirFamilia(
            padreNombre,
            padreApellido,
            hijosValidos
        );
        setLoading(false);

        if (result.success) {
            setScreen('success');
        } else {
            setError(result.error || 'Error al inscribirse. Intentá de nuevo.');
        }
    };

    const inputClass = `w-full h-11 px-4 rounded-xl border border-gray-200
        text-sm font-medium text-gray-900 placeholder:text-gray-300
        focus:outline-none focus:border-gray-400 focus:ring-2
        focus:ring-gray-100 transition-all`;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
            <AnimatePresence mode="wait">

                {/* ── FORMULARIO ─── */}
                {screen === 'form' && (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }}
                        className="w-full max-w-md"
                    >
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="w-14 h-14 bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-gray-100 flex items-center justify-center mx-auto mb-4 p-3">
                                <img src="/favicon.png" alt="Origen" className="w-full h-full object-contain" />
                            </div>
                            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">
                                Día del Padre
                            </h1>
                            <p className="text-sm text-gray-400">
                                Inscribí a tu familia para participar
                            </p>
                        </div>

                        {/* Card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 md:p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">

                                {/* ── PADRE ── */}
                                <div>
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-3">
                                        Padre
                                    </p>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Nombre"
                                            aria-label="Nombre del padre"
                                            autoComplete="given-name"
                                            required
                                            value={padreNombre}
                                            onChange={e => setPadreNombre(e.target.value)}
                                            className={inputClass}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Apellido"
                                            aria-label="Apellido del padre"
                                            autoComplete="family-name"
                                            required
                                            value={padreApellido}
                                            onChange={e => setPadreApellido(e.target.value)}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-gray-100" />

                                {/* ── HIJOS ── */}
                                <div>
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-3">
                                        Hijo/s
                                    </p>

                                    <div className="space-y-3">
                                        <AnimatePresence>
                                            {hijos.map((hijo, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="flex gap-2 items-start"
                                                >
                                                    <div className="flex-1 space-y-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Nombre"
                                                            aria-label={`Nombre del hijo ${idx + 1}`}
                                                            autoComplete="given-name"
                                                            value={hijo.nombre}
                                                            onChange={e => updateHijo(idx, 'nombre', e.target.value)}
                                                            className={inputClass}
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="Apellido"
                                                            aria-label={`Apellido del hijo ${idx + 1}`}
                                                            autoComplete="family-name"
                                                            value={hijo.apellido}
                                                            onChange={e => updateHijo(idx, 'apellido', e.target.value)}
                                                            className={inputClass}
                                                        />
                                                    </div>

                                                    {hijos.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeHijo(idx)}
                                                            aria-label={`Eliminar hijo ${idx + 1}`}
                                                            className="mt-1 w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all shrink-0"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>

                                        <button
                                            type="button"
                                            onClick={addHijo}
                                            className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Agregar hijo
                                        </button>
                                    </div>
                                </div>

                                {/* Error */}
                                {error && (
                                    <p className="text-sm text-red-500 font-medium text-center bg-red-50 rounded-xl px-4 py-3">
                                        {error}
                                    </p>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-black active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : 'Inscribirse'
                                    }
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}

                {/* ── ÉXITO ── */}
                {screen === 'success' && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
                        className="w-full max-w-md text-center"
                    >
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                                <CheckCircle className="w-8 h-8 text-green-500" aria-hidden="true" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">
                                ¡Inscripción exitosa!
                            </h2>
                            <p className="text-sm text-gray-400 leading-relaxed mb-6">
                                La familia{' '}
                                <span className="font-semibold text-gray-700">
                                    {padreNombre} {padreApellido}
                                </span>{' '}
                                quedó registrada.
                                ¡Buena suerte en las actividades!
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate('/eventos/ranking-diadelpadre')}
                                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
                            >
                                <Trophy className="w-4 h-4" aria-hidden="true" />
                                Ver Ranking en vivo
                            </button>
                        </div>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
};

export default InscripcionDPadre;
