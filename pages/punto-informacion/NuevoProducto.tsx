
import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType, INFO_POINT_SIZES } from '../../types';
import { useToast } from './context/ContextoToast';

const NewProduct: React.FC = () => {
    const { addProduct, products } = useStore();
    const { toast } = useToast();
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
            <div className="bg-white border-2 md:border-4 border-black p-6 md:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest border-b-2 border-black mb-2 inline-block">Tipo</label>
                            <select
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value as ProductType })}
                                className="w-full p-3 bg-white border-2 border-black rounded-lg text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none cursor-pointer"
                            >
                                {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest border-b-2 border-black mb-2 inline-block">Talle</label>
                            <select
                                value={form.size}
                                onChange={e => setForm({ ...form, size: e.target.value })}
                                className="w-full p-3 bg-white border-2 border-black rounded-lg text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none cursor-pointer"
                            >
                                {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest border-b-2 border-black mb-2 inline-block">Precio</label>
                            <input
                                type="number"
                                required
                                value={form.price}
                                onChange={e => setForm({ ...form, price: parseInt(e.target.value) })}
                                className="w-full p-3 bg-white border-2 border-black rounded-lg text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest border-b-2 border-black mb-2 inline-block">Stock Inicial</label>
                            <input
                                type="number"
                                required
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: parseInt(e.target.value) })}
                                className="w-full p-3 bg-white border-2 border-black rounded-lg text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest border-b-2 border-black mb-2 inline-block">Min. Alerta</label>
                            <input
                                type="number"
                                required
                                value={form.minStock}
                                onChange={e => setForm({ ...form, minStock: parseInt(e.target.value) })}
                                className="w-full p-3 bg-white border-2 border-black rounded-lg text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            />
                        </div>
                    </div>

                    <div className="p-4 border-2 border-dashed border-black bg-neutral-50 text-sm font-bold text-center">
                        Se creará: <span className="uppercase font-black">{form.type} Talle {form.size}</span>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-black text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
                    >
                        Crear Producto
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewProduct;
