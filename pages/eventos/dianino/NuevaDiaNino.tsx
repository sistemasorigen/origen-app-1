import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkDianinoDniAvailable, registerDianinoSession, getDianinoSessionDetail, checkinDianinoTicket } from '../../../services/supabaseService';
import { safeUUID } from '../../../services/uuidUtils';
import { DiaNinoChildInput } from '../../../types';
import { ChevronLeft, Plus, Trash2, Save, Loader2, UserCheck } from 'lucide-react';

interface ChildForm extends DiaNinoChildInput {
    localId: string;
    dniError?: string;
    dniChecking?: boolean;
}

const NuevaDiaNino: React.FC = () => {
    const navigate = useNavigate();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [dni, setDni] = useState('');
    const [dniError, setDniError] = useState<string | null>(null);
    const [dniChecking, setDniChecking] = useState(false);

    const [children, setChildren] = useState<ChildForm[]>([]);
    const [declaracionAceptada, setDeclaracionAceptada] = useState(true);

    // Prende por default: la inscripción manual la carga el staff con la
    // familia ahí mismo delante — el caso común es que ya llegaron. Se
    // puede apagar para el caso menos común de cargar a alguien que
    // todavía no está en el predio.
    const [autoAcreditar, setAutoAcreditar] = useState(true);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAdultDniBlur = async () => {
        if (!dni.trim()) return;
        setDniChecking(true);
        const available = await checkDianinoDniAvailable(dni.trim());
        setDniChecking(false);
        setDniError(available ? null : 'Este DNI ya está inscripto.');
    };

    const handleChildDniBlur = async (localId: string, childDni: string) => {
        if (!childDni.trim()) return;
        setChildren(prev => prev.map(c => c.localId === localId ? { ...c, dniChecking: true } : c));
        const available = await checkDianinoDniAvailable(childDni.trim());
        setChildren(prev => prev.map(c => c.localId === localId
            ? { ...c, dniChecking: false, dniError: available ? undefined : 'Este DNI ya está inscripto.' }
            : c
        ));
    };

    const addChild = () => {
        setChildren(prev => [...prev, { localId: safeUUID(), firstName: '', lastName: '', dni: '' }]);
    };

    const removeChild = (localId: string) => {
        setChildren(prev => prev.filter(c => c.localId !== localId));
    };

    const updateChild = (localId: string, field: keyof DiaNinoChildInput, value: string) => {
        setChildren(prev => prev.map(c => c.localId === localId ? { ...c, [field]: value, dniError: field === 'dni' ? undefined : c.dniError } : c));
    };

    const canSubmit =
        firstName.trim() && lastName.trim() && email.trim() && dni.trim() && !dniError && !dniChecking &&
        children.every(c => c.firstName.trim() && c.lastName.trim() && c.dni.trim() && !c.dniError && !c.dniChecking);

    const handleSubmit = async () => {
        setError(null);
        setSaving(true);

        const result = await registerDianinoSession(
            email.trim(),
            declaracionAceptada,
            { firstName: firstName.trim(), lastName: lastName.trim(), dni: dni.trim() },
            children.map(c => ({ firstName: c.firstName.trim(), lastName: c.lastName.trim(), dni: c.dni.trim() }))
        );

        if (result.sessionId) {
            // Acredita a todos (adulto + niños) antes de navegar — no en
            // paralelo con la navegación — para que la página de detalle,
            // que trae sus propios datos al montar, ya los encuentre
            // CHECKED_IN en vez de mostrar PENDING un instante y corregirse
            // sola. Mismo criterio que ya usa el escaneo del QR maestro:
            // el adulto se acredita junto con los niños, no queda aparte.
            if (autoAcreditar) {
                const detail = await getDianinoSessionDetail(result.sessionId);
                if (detail) {
                    await Promise.all(detail.tickets.map(t => checkinDianinoTicket(t.id)));
                }
            }

            setSaving(false);
            navigate(`/eventos/admin/diadelnino/${result.sessionId}`);
            return;
        }

        setSaving(false);

        if (result.errorDni) {
            setError(`El DNI ${result.errorDni} ya está inscripto. Revisá los datos.`);
            return;
        }

        setError('Hubo un error al guardar. Probá de nuevo.');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-xl mx-auto">
                <button
                    onClick={() => navigate('/eventos/admin/diadelnino')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Día del Niño
                </button>

                <h1 className="text-2xl font-black uppercase tracking-tight text-black mb-6">
                    Inscripción manual
                </h1>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">

                    <div>
                        <p className="text-xs font-bold uppercase text-slate-400 mb-3">Adulto responsable</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <input type="text" placeholder="Nombre" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" />
                            <input type="text" placeholder="Apellido" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm" />
                        </div>
                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm mb-3" />
                        <div>
                            <input
                                type="text" placeholder="DNI" value={dni}
                                onChange={e => { setDni(e.target.value); setDniError(null); }}
                                onBlur={handleAdultDniBlur}
                                className={`w-full px-3 py-2.5 border rounded-lg outline-none text-sm ${dniError ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-black'}`}
                            />
                            {dniChecking && <p className="text-xs text-slate-400 mt-1">Verificando...</p>}
                            {dniError && <p className="text-xs text-red-600 font-medium mt-1">{dniError}</p>}
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-3">Niños</p>
                        <div className="space-y-3">
                            {children.map((child, idx) => (
                                <div key={child.localId} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Niño/a {idx + 1}</span>
                                        <button onClick={() => removeChild(child.localId)} className="text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="text" placeholder="Nombre" value={child.firstName} onChange={e => updateChild(child.localId, 'firstName', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-black text-sm bg-white" />
                                        <input type="text" placeholder="Apellido" value={child.lastName} onChange={e => updateChild(child.localId, 'lastName', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-black text-sm bg-white" />
                                    </div>
                                    <input
                                        type="text" placeholder="DNI" value={child.dni}
                                        onChange={e => updateChild(child.localId, 'dni', e.target.value)}
                                        onBlur={() => handleChildDniBlur(child.localId, child.dni)}
                                        className={`w-full px-3 py-2 border rounded-lg outline-none text-sm bg-white ${child.dniError ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-black'}`}
                                    />
                                    {child.dniChecking && <p className="text-xs text-slate-400">Verificando...</p>}
                                    {child.dniError && <p className="text-xs text-red-600 font-medium">{child.dniError}</p>}
                                </div>
                            ))}
                        </div>
                        <button onClick={addChild} className="mt-3 w-full py-2.5 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 border-2 border-dashed border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            <Plus className="w-4 h-4" /> Agregar niño
                        </button>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={declaracionAceptada}
                                onChange={e => setDeclaracionAceptada(e.target.checked)}
                                className="w-4 h-4 accent-black"
                            />
                            <span className="text-sm text-slate-700">¿Aceptó la Declaración de Conformidad?</span>
                        </label>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${autoAcreditar ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <UserCheck className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">Acreditar automáticamente</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        {autoAcreditar
                                            ? 'Al guardar, el adulto y los niños quedan marcados como ingresados.'
                                            : 'Van a quedar pendientes hasta escanearlos o acreditarlos a mano.'}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                role="switch"
                                aria-checked={autoAcreditar}
                                aria-label="Acreditar automáticamente al guardar"
                                onClick={() => setAutoAcreditar(v => !v)}
                                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 ${autoAcreditar ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${autoAcreditar ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

                    <button
                        disabled={!canSubmit || saving}
                        onClick={handleSubmit}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {autoAcreditar ? 'Guardar y acreditar' : 'Guardar inscripción'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NuevaDiaNino;
