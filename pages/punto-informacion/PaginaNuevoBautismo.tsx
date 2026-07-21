import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { PendingStatus } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { ArrowLeft, Droplets, Loader2 } from 'lucide-react';

const PaginaNuevoBautismoContent: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('id');

    const { baptisms, addBaptism, updateBaptism, showNotification } = useStore();
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (editId) {
            const existing = baptisms.find(b => b.id === editId);
            if (existing) {
                setForm({
                    firstName: existing.firstName,
                    lastName: existing.lastName,
                    email: existing.email,
                    phone: existing.phone
                });
            }
        }
    }, [editId, baptisms]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editId) {
                const existing = baptisms.find(b => b.id === editId);
                if (existing) {
                    await updateBaptism({ ...existing, ...form });
                    showNotification('¡Datos de bautismo actualizados!');
                }
            } else {
                await addBaptism({
                    id: safeUUID(),
                    ...form,
                    isPending: 1,
                    status: PendingStatus.PENDING,
                    registrationDate: new Date().toISOString()
                });
                showNotification('¡Inscripción a bautismo exitosa!');
            }
            navigate('/punto-de-informacion?view=BAPTISMS');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=BAPTISMS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Bautismos
                </button>

                <div className="bg-white p-6 md:p-8 border border-slate-200 rounded-lg shadow-sm">
                    <h1 className="font-black text-xl mb-6 text-slate-900 uppercase tracking-tight flex items-center gap-2 border-b border-slate-200 pb-4">
                        <Droplets className="w-6 h-6 text-slate-400" />
                        {editId ? 'Editar Bautismo' : 'Registro de Bautismo'}
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="bautismo-firstName" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Nombre</label>
                                <input id="bautismo-firstName" type="text" autoComplete="given-name" placeholder="Nombre" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                            </div>
                            <div>
                                <label htmlFor="bautismo-lastName" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Apellido</label>
                                <input id="bautismo-lastName" type="text" autoComplete="family-name" placeholder="Apellido" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="bautismo-email" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Email</label>
                            <input id="bautismo-email" type="email" autoComplete="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                        </div>
                        <div>
                            <label htmlFor="bautismo-phone" className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Teléfono</label>
                            <input id="bautismo-phone" type="tel" autoComplete="tel" placeholder="Teléfono" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex-1 py-3 bg-black text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {editId ? 'Actualizar' : 'Registrar'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// useStore requiere el store del Punto de Info. Esta página vive
// como ruta suelta (fuera de PuntoInformacion.tsx), así que provee
// su propio AppProvider — mismo patrón que PuntoInformacion.
const PaginaNuevoBautismo: React.FC = () => {
    const { user } = useAuth();
    return (
        <AppProvider currentUser={user}>
            <PaginaNuevoBautismoContent />
        </AppProvider>
    );
};

export default PaginaNuevoBautismo;
