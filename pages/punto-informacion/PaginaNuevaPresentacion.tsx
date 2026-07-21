import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { PendingStatus } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { formatDateForInput } from '../../services/dateUtils';
import { ArrowLeft, Baby, Loader2 } from 'lucide-react';

const PaginaNuevaPresentacionContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { presentations, addPresentation, updatePresentation, showNotification } = useStore();
    const [form, setForm] = useState({
        childName: '', childSurname: '',
        motherName: '', motherSurname: '',
        fatherName: '', fatherSurname: '',
        email: '', phone: '',
        scheduledDate: formatDateForInput(new Date().toISOString())
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (editId) {
            const existing = presentations.find(p => p.id === editId);
            if (existing) {
                setForm({
                    childName: existing.childName, childSurname: existing.childSurname,
                    motherName: existing.motherName, motherSurname: existing.motherSurname,
                    fatherName: existing.fatherName, fatherSurname: existing.fatherSurname,
                    email: existing.email, phone: existing.phone,
                    scheduledDate: formatDateForInput(existing.scheduledDate)
                });
            }
        }
    }, [editId, presentations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editId) {
                const existing = presentations.find(p => p.id === editId);
                if (existing) {
                    await updatePresentation({ ...existing, ...form });
                    showNotification('¡Datos de presentación actualizados!');
                }
            } else {
                await addPresentation({
                    id: safeUUID(),
                    ...form,
                    isPending: 1,
                    status: PendingStatus.PENDING
                });
                showNotification('¡Presentación agendada exitosamente!');
            }
            navigate('/punto-de-informacion?view=PRESENTATIONS');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=PRESENTATIONS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Presentaciones
                </button>

                <div className="bg-white p-6 md:p-8 border border-slate-200 rounded-lg shadow-sm">
                    <h1 className="font-black text-xl mb-6 text-slate-900 uppercase tracking-tight flex items-center gap-2 border-b border-slate-200 pb-4">
                        <Baby className="w-6 h-6 text-slate-400" />
                        {editId ? 'Editar Presentación' : 'Nueva Presentación'}
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1 border-b border-dashed border-slate-200 pb-3">
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">Datos del Niño/a</span>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                                <div>
                                    <label htmlFor="pres-childName" className="sr-only">Nombre del niño/a</label>
                                    <input id="pres-childName" type="text" autoComplete="off" placeholder="Nombre" required value={form.childName} onChange={e => setForm({ ...form, childName: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                                </div>
                                <div>
                                    <label htmlFor="pres-childSurname" className="sr-only">Apellido del niño/a</label>
                                    <input id="pres-childSurname" type="text" autoComplete="off" placeholder="Apellido" required value={form.childSurname} onChange={e => setForm({ ...form, childSurname: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Madre</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="pres-motherName" className="sr-only">Nombre de la madre</label>
                                    <input id="pres-motherName" type="text" autoComplete="off" placeholder="Nombre" value={form.motherName} onChange={e => setForm({ ...form, motherName: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                                </div>
                                <div>
                                    <label htmlFor="pres-motherSurname" className="sr-only">Apellido de la madre</label>
                                    <input id="pres-motherSurname" type="text" autoComplete="off" placeholder="Apellido" value={form.motherSurname} onChange={e => setForm({ ...form, motherSurname: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Padre</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label htmlFor="pres-fatherName" className="sr-only">Nombre del padre</label>
                                    <input id="pres-fatherName" type="text" autoComplete="off" placeholder="Nombre" value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                                </div>
                                <div>
                                    <label htmlFor="pres-fatherSurname" className="sr-only">Apellido del padre</label>
                                    <input id="pres-fatherSurname" type="text" autoComplete="off" placeholder="Apellido" value={form.fatherSurname} onChange={e => setForm({ ...form, fatherSurname: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label htmlFor="pres-scheduledDate" className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Fecha Agendada</label>
                            <input
                                id="pres-scheduledDate"
                                type="date"
                                required
                                value={form.scheduledDate}
                                onChange={e => setForm({ ...form, scheduledDate: e.target.value })}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors"
                            />
                        </div>

                        <div className="pt-2 space-y-2 border-t border-dashed border-slate-200">
                            <div className="space-y-1 mt-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contacto</span>
                                <div>
                                    <label htmlFor="pres-email" className="sr-only">Email de contacto</label>
                                    <input id="pres-email" type="email" autoComplete="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                                </div>
                                <div>
                                    <label htmlFor="pres-phone" className="sr-only">Teléfono de contacto</label>
                                    <input id="pres-phone" type="tel" autoComplete="tel" placeholder="Teléfono" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors mt-2" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 py-3 bg-black text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editId ? 'Guardar' : 'Agendar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// Wrapper que provee el Store Context — mismo patrón
// que PuntoInformacion.tsx usa para sus vistas
// internas, ya que esta página es una ruta suelta
// que no hereda ese Provider.
const PaginaNuevaPresentacion: React.FC = () => {
    const { user } = useAuth();
    return (
        <AppProvider currentUser={user}>
            <PaginaNuevaPresentacionContent />
        </AppProvider>
    );
};

export default PaginaNuevaPresentacion;
