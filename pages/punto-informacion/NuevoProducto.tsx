
import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType, INFO_POINT_SIZES } from '../../types';
import { useToast } from './context/ContextoToast';

const NewProduct: React.FC = () => {
    const { addProduct, products } = useStore();
    const toast = useToast();
    const [form, setForm] = useState({
        type: ProductType.REMERA,
        size: '1',
        price: 0,
        stock: 0,
        minStock: 5
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Auto-generate ID and Name
        const generatedCode = `${form.type.toUpperCase()}-${form.size}`;
        const generatedName = `${form.type} Talle ${form.size}`;

        // Check duplicate
        const exists = products.some(p => p.code === generatedCode);
        if (exists) {
            toast.error(`Error: Ya existe un producto de tipo ${form.type} y talle ${form.size}.`);
            return;
        }

        await addProduct({
            ...form,
            code: generatedCode,
            name: generatedName
        });
        toast.success('¡Producto creado exitosamente!');
        setForm({ type: ProductType.REMERA, size: '1', price: 0, stock: 0, minStock: 5 });
    };

    return (
        <div className="max-w-xl mx-auto animate-fadeIn p-1">
            <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8 shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Tipo</label>
                            <select
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value as ProductType })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-black transition-colors cursor-pointer"
                            >
                                {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Talle</label>
                            <select
                                value={form.size}
                                onChange={e => setForm({ ...form, size: e.target.value })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-black transition-colors cursor-pointer"
                            >
                                {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Precio</label>
                            <input
                                type="number"
                                required
                                value={form.price}
                                onChange={e => setForm({ ...form, price: parseInt(e.target.value) })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-black transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Stock inicial</label>
                            <input
                                type="number"
                                required
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: parseInt(e.target.value) })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-black transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Min. alerta</label>
                            <input
                                type="number"
                                required
                                value={form.minStock}
                                onChange={e => setForm({ ...form, minStock: parseInt(e.target.value) })}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-black transition-colors"
                            />
                        </div>
                    </div>

                    <div className="p-4 border border-dashed border-slate-300 rounded-lg bg-slate-50 text-sm font-medium text-slate-600 text-center">
                        Se creará: <span className="uppercase font-bold text-slate-900">{form.type} Talle {form.size}</span>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-black text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        Crear producto
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewProduct;
