import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { MovementType, ProductType, INFO_POINT_SIZES } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import { ArrowLeft, Loader2 } from 'lucide-react';

const PaginaNuevoMovimientoContent: React.FC = () => {
    const navigate = useNavigate();
    const { products, addMovement, showNotification } = useStore();
    const [form, setForm] = useState({
        type: ProductType.REMERA,
        size: '1',
        moveType: MovementType.IN,
        quantity: 1,
        paymentMethod: 'Efectivo' as 'Efectivo' | 'Mercado Pago'
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const targetCode = `${form.type.toUpperCase()}-${form.size}`;
        const product = products.find(p => p.code === targetCode);

        if (!product) {
            showNotification(`Error: No existe el producto ${form.type} Talle ${form.size}. Créalo primero.`, 'error');
            return;
        }

        setIsSaving(true);
        try {
            await addMovement({
                id: safeUUID(),
                productCode: targetCode,
                productName: `${form.type} Talle ${form.size}`,
                type: form.moveType,
                quantity: form.quantity,
                date: new Date().toISOString(),
                paymentMethod: form.moveType === MovementType.OUT ? form.paymentMethod : undefined
            });
            showNotification('¡Movimiento registrado con éxito!');
            navigate('/punto-de-informacion?view=MOVEMENTS');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/punto-de-informacion?view=MOVEMENTS')}
                    className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Movimientos
                </button>

                <div className="bg-white p-6 md:p-8 border border-slate-200 rounded-lg shadow-sm">
                    <h1 className="font-black text-xl mb-2 text-slate-900 uppercase tracking-tight border-b border-slate-200 pb-4">Registrar movimiento</h1>
                    <p className="text-xs font-medium text-slate-500 mb-6 uppercase tracking-wide bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4">Al confirmar, el stock se actualiza automáticamente.</p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Producto</label>
                                <select
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-bold text-slate-900 focus:border-black transition-colors cursor-pointer"
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value as ProductType })}
                                >
                                    {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Talle</label>
                                <select
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-bold text-slate-900 focus:border-black transition-colors cursor-pointer"
                                    value={form.size}
                                    onChange={e => setForm({ ...form, size: e.target.value })}
                                >
                                    {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Tipo de movimiento</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[MovementType.IN, MovementType.OUT, MovementType.ADJUST].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setForm({ ...form, moveType: type })}
                                        className={`py-2.5 text-xs font-bold uppercase tracking-tight rounded-lg border transition-colors ${form.moveType === type
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Cantidad</label>
                            <input
                                type="number" min="1"
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none font-black text-xl text-slate-900 focus:border-black transition-colors"
                                value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) })}
                                required
                            />
                        </div>

                        {form.moveType === MovementType.OUT && (
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Método de pago</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, paymentMethod: 'Efectivo' })}
                                        className={`py-2.5 text-xs font-bold uppercase tracking-tight rounded-lg border transition-colors ${form.paymentMethod === 'Efectivo'
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        Efectivo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, paymentMethod: 'Mercado Pago' })}
                                        className={`py-2.5 text-xs font-bold uppercase tracking-tight rounded-lg border transition-colors ${form.paymentMethod === 'Mercado Pago'
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        Mercado Pago
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-3 bg-black text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-800 transition-colors mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Confirmar
                        </button>
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
const PaginaNuevoMovimiento: React.FC = () => {
    const { user } = useAuth();
    return (
        <AppProvider currentUser={user}>
            <PaginaNuevoMovimientoContent />
        </AppProvider>
    );
};

export default PaginaNuevoMovimiento;
