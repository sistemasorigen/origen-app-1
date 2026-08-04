import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkInfluosNameExists, registerInfluosDia } from '../../../services/supabaseService';
import { InfluosDiaTribu } from '../../../types';
import { ChevronLeft, Save, Loader2, AlertCircle, Check } from 'lucide-react';

const TRIBUS: { value: InfluosDiaTribu; label: string }[] = [
    { value: 'Garra', label: 'Garra' },
    { value: 'Trueno', label: 'Trueno' },
    { value: 'No tengo', label: 'No tengo' },
];

const NuevaInfluosDia: React.FC = () => {
    const navigate = useNavigate();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [tribu, setTribu] = useState<InfluosDiaTribu | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState(false);
    const [checkingDuplicate, setCheckingDuplicate] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLastNameBlur = async () => {
        if (!firstName.trim() || !lastName.trim()) return;
        setCheckingDuplicate(true);
        const exists = await checkInfluosNameExists(firstName.trim(), lastName.trim());
        setCheckingDuplicate(false);
        setDuplicateWarning(exists);
    };

    const canSubmit = firstName.trim() && lastName.trim() && age.trim() && Number(age) > 0 && Number(age) < 100 && tribu;

    const handleSubmit = async () => {
        if (!tribu) return;
        setError(null);
        setSaving(true);

        const id = await registerInfluosDia(firstName.trim(), lastName.trim(), Number(age), tribu);

        setSaving(false);

        if (id) {
            navigate('/eventos/admin/tribal-wars');
            return;
        }

        setError('Hubo un error al guardar. Probá de nuevo.');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-md mx-auto">
                <button
                    onClick={() => navigate('/eventos/admin/tribal-wars')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Día de Influos
                </button>

                <h1 className="text-2xl font-black uppercase tracking-tight text-black mb-6">
                    Inscripción manual
                </h1>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Nombre" value={firstName} onChange={e => { setFirstName(e.target.value); setDuplicateWarning(false); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" />
                        <input
                            type="text" placeholder="Apellido" value={lastName}
                            onChange={e => { setLastName(e.target.value); setDuplicateWarning(false); }}
                            onBlur={handleLastNameBlur}
                            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                        />
                    </div>

                    {checkingDuplicate && <p className="text-xs text-slate-400 font-medium">Verificando...</p>}
                    {duplicateWarning && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-medium text-amber-700">
                                Ya hay una inscripción con este nombre. Puede ser la misma persona o un homónimo —
                                confirmá antes de guardar de nuevo.
                            </p>
                        </div>
                    )}

                    <input type="number" placeholder="Edad" min="1" max="99" value={age} onChange={e => setAge(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" />

                    <div>
                        <p className="text-xs font-bold uppercase text-slate-400 mb-2">Tribu</p>
                        <div className="grid grid-cols-3 gap-2">
                            {TRIBUS.map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => setTribu(t.value)}
                                    className={`py-2.5 rounded-lg text-xs font-bold uppercase border transition-colors flex items-center justify-center gap-1 ${tribu === t.value ? 'bg-black text-white border-black' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                                >
                                    {tribu === t.value && <Check className="w-3 h-3" />}
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

                    <button
                        disabled={!canSubmit || saving}
                        onClick={handleSubmit}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar inscripción
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NuevaInfluosDia;
