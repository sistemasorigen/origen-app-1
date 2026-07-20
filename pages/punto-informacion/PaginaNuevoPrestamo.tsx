import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { ProductType, INFO_POINT_SIZES } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { ArrowLeft, Shirt, Loader2 } from 'lucide-react';

const PaginaNuevoPrestamoContent: React.FC = () => {
    const navigate = useNavigate();
    const { addLoan, showNotification } = useStore();
    const [form, setForm] = useState({
        lenderName: '',
        lenderSurname: '',
        itemType: ProductType.REMERA,
        itemSize: '1'
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await addLoan({
                id: safeUUID(),
                ...form,
                loanDate: new Date().toISOString(),
                status: 'ACTIVE'
            });
            showNotification('¡Préstamo registrado exitosamente!');
            navigate('/punto-de-informacion?view=LOANS');
        } catch (error) {
            console.error(error);
            showNotification('Error al crear préstamo', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=LOANS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Préstamos
                </button>

                <div className="bg-white p-6 md:p-8 border border-slate-200 rounded-lg shadow-sm">
                    <h1 className="font-black text-xl mb-6 text-slate-900 uppercase tracking-tight flex items-center gap-2 border-b border-slate-200 pb-4">
                        <Shirt className="w-6 h-6 text-slate-400" />
                        Nuevo Préstamo
                    </h1>

                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="text" placeholder="Nombre" required value={form.lenderName} onChange={e => setForm({ ...form, lenderName: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                            <input type="text" placeholder="Apellido" required value={form.lenderSurname} onChange={e => setForm({ ...form, lenderSurname: e.target.value })} className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-black transition-colors" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Prenda</label>
                                <select
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-bold text-slate-900 focus:border-black transition-colors cursor-pointer"
                                    value={form.itemType}
                                    onChange={e => setForm({ ...form, itemType: e.target.value as ProductType })}
                                >
                                    {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Talle</label>
                                <select
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-bold text-slate-900 focus:border-black transition-colors cursor-pointer"
                                    value={form.itemSize}
                                    onChange={e => setForm({ ...form, itemSize: e.target.value })}
                                >
                                    {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-3 bg-black text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-800 transition-colors mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Prestado
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// useStore requiere el store del Punto de Info. Esta página vive
// como ruta suelta (fuera de PuntoInformacion.tsx), así que provee
// su propio AppProvider — mismo patrón que PuntoInformacion.
const PaginaNuevoPrestamo: React.FC = () => {
    const { user } = useAuth();
    return (
        <AppProvider currentUser={user}>
            <PaginaNuevoPrestamoContent />
        </AppProvider>
    );
};

export default PaginaNuevoPrestamo;
