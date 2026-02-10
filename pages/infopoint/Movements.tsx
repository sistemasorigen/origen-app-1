import React, { useState } from 'react';
import { useStore } from '../../store';
import { MovementType, ProductType, INFO_POINT_SIZES } from '../../types';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Trash2 } from 'lucide-react';
import { safeUUID } from '../../services/uuidUtils';

const Movements: React.FC = () => {
    const { products, movements, addMovement, deleteMovement, showNotification } = useStore();
    const [form, setForm] = useState({
        type: ProductType.REMERA,
        size: '1',
        moveType: MovementType.IN,
        quantity: 1,
        paymentMethod: 'Efectivo' as 'Efectivo' | 'Mercado Pago'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Find product by composite key
        const targetCode = `${form.type.toUpperCase()}-${form.size}`;
        const product = products.find(p => p.code === targetCode);

        // Allow creating movements even if product doesn't exist in local store context (might be creating initial stock)
        // But the previous code blocked it. Let's respect business logic?
        // Actually, for inventory, usually you want products to exist.

        if (!product) {
            showNotification(`Error: No existe el producto ${form.type} Talle ${form.size}. Créalo primero.`, 'error');
            return;
        }

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
        // Reset form but keep type/size for quick consecutive entry
        setForm({ ...form, quantity: 1 });
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteMovement(id);
        showNotification('Movimiento eliminado y stock revertido.');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn p-1">
            {/* Form */}
            <div className="lg:col-span-1">
                <div className="bg-white p-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sticky top-4">
                    <h3 className="font-black text-xl mb-4 text-black uppercase tracking-tight border-b-2 border-black pb-2">Registrar Movimiento</h3>
                    <p className="text-xs font-bold text-neutral-500 mb-6 uppercase tracking-wide bg-neutral-100 p-2 border-l-4 border-black">Al confirmar, el stock se actualiza automáticamente.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Producto</label>
                                <select
                                    className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none cursor-pointer"
                                    value={form.type}
                                    onChange={e => setForm({ ...form, type: e.target.value as ProductType })}
                                >
                                    {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Talle</label>
                                <select
                                    className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none cursor-pointer"
                                    value={form.size}
                                    onChange={e => setForm({ ...form, size: e.target.value })}
                                >
                                    {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Tipo de Movimiento</label>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                                {[MovementType.IN, MovementType.OUT, MovementType.ADJUST].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setForm({ ...form, moveType: type })}
                                        className={`py-2 text-xs font-black uppercase tracking-tight border-2 border-black transition-all ${form.moveType === type
                                            ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                            : 'bg-white text-neutral-500 hover:bg-neutral-100'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Cantidad</label>
                            <input
                                type="number" min="1"
                                className="w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-black text-xl focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                                value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) })}
                                required
                            />
                        </div>

                        {/* Payment Method Switch - Only for OUT movements */}
                        {form.moveType === MovementType.OUT && (
                            <div>
                                <label className="text-xs font-black uppercase tracking-widest border-b-2 border-black mb-1 inline-block">Método de Pago</label>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, paymentMethod: 'Efectivo' })}
                                        className={`py-2 text-xs font-black uppercase tracking-tight border-2 border-black transition-all ${form.paymentMethod === 'Efectivo'
                                            ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                            : 'bg-white text-neutral-500 hover:bg-neutral-100'
                                            }`}
                                    >
                                        Efectivo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, paymentMethod: 'Mercado Pago' })}
                                        className={`py-2 text-xs font-black uppercase tracking-tight border-2 border-black transition-all ${form.paymentMethod === 'Mercado Pago'
                                            ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                            : 'bg-white text-neutral-500 hover:bg-neutral-100'
                                            }`}
                                    >
                                        Mercado Pago
                                    </button>
                                </div>
                            </div>
                        )}

                        <button type="submit" className="w-full py-3 bg-blue-600 text-white font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-500 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all mt-4">Confirmar</button>
                    </form>
                </div>
            </div>

            {/* List */}
            <div className="lg:col-span-2">
                <h2 className="text-2xl font-black text-black uppercase tracking-tight mb-6 border-b-4 border-black inline-block pb-1">Historial</h2>
                <div className="space-y-4">
                    {[...movements].reverse().map(m => (
                        <div key={m.id} className="bg-white p-4 border-2 border-black flex justify-between items-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-1">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${m.type === MovementType.IN ? 'bg-emerald-300 text-black' :
                                    m.type === MovementType.OUT ? 'bg-red-300 text-black' : 'bg-amber-200 text-black'
                                    }`}>
                                    {m.type === MovementType.IN ? <ArrowUpRight className="w-6 h-6" /> :
                                        m.type === MovementType.OUT ? <ArrowDownLeft className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h4 className="font-black text-lg text-black uppercase tracking-tight">{m.productName}</h4>
                                    <p className="text-xs font-bold text-neutral-500 uppercase">{new Date(m.date).toLocaleString()}</p>
                                    {m.paymentMethod && (
                                        <p className="text-[10px] font-black text-blue-600 uppercase mt-0.5 bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-200">
                                            💳 {m.paymentMethod}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <span className="font-black text-3xl font-mono border-b-2 border-black">{m.quantity}</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleDelete(m.id, e)}
                                    className="p-2 bg-white text-black border-2 border-black hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                    title="Eliminar Registro"
                                >
                                    <Trash2 className="w-5 h-5 pointer-events-none" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {movements.length === 0 && (
                        <div className="p-12 text-center border-4 border-dashed border-neutral-300">
                            <p className="text-neutral-400 font-bold uppercase tracking-widest">Sin movimientos registrados</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Movements;
