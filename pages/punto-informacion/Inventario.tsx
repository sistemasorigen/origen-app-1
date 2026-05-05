import React, { useState } from 'react';
import { useStore } from '../../store';
import { AlertCircle, Trash2, Package, Shirt } from 'lucide-react';
import { ProductType } from '../../types';

const Inventory: React.FC = () => {
    const { products, deleteProduct } = useStore();
    const [filterType, setFilterType] = useState('ALL');

    const filtered = products.filter(p => {
        if (filterType === 'ALL') return true;
        return p.type === filterType;
    });

    const handleDelete = async (code: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteProduct(code);
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-24 md:pb-0 p-1">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-1 md:px-0 pt-4 md:pt-0">
                <div className="md:hidden w-full">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-2 text-black">Filtros</h2>
                </div>

                {/* Filter */}
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="w-full md:w-auto px-4 py-3 rounded-lg border-2 border-black bg-white text-black font-black uppercase tracking-tight outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:translate-y-1 focus:shadow-none transition-all cursor-pointer"
                >
                    <option value="ALL">Todo el Inventario</option>
                    <option value="Remeras">Remeras</option>
                    <option value="Buzos">Buzos</option>
                </select>

                <h2 className="hidden md:block text-3xl font-black uppercase tracking-tight text-black">Inventario Total</h2>
            </div>

            {/* Desktop Table (Hidden on Mobile) */}
            <div className="hidden md:block bg-white border-2 lg:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-black text-white text-xs uppercase font-black tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Producto (Tipo)</th>
                            <th className="px-6 py-4">Talle</th>
                            <th className="px-6 py-4">Stock</th>
                            <th className="px-6 py-4">Precio</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-neutral-200">
                        {filtered.map(p => (
                            <tr key={p.code} className="hover:bg-yellow-50 transition-colors">
                                <td className="px-6 py-4 font-black uppercase text-black">{p.type}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-block px-3 py-1 border-2 border-black bg-white text-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                        Talle {p.size}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`flex items-center gap-2 font-black text-lg ${p.stock <= p.minStock ? 'text-red-600' : 'text-black'}`}>
                                        {p.stock <= p.minStock && <AlertCircle className="w-5 h-5" />}
                                        {p.stock}
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-black text-lg">${p.price}</td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(p.code, e)}
                                        className="p-2 border-2 border-transparent hover:border-black hover:bg-black hover:text-white rounded-none transition-all"
                                        title="Eliminar Producto"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MOBILE FEED (Neo-Brutalist Cards) */}
            <div className="md:hidden space-y-4 px-1">
                {filtered.map(p => (
                    <div key={p.code} className="w-full bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {/* Header: Type and Price */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 border-2 border-black flex items-center justify-center bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    {p.type === ProductType.REMERA ? <Shirt className="w-6 h-6 text-black" /> : <Package className="w-6 h-6 text-black" />}
                                </div>
                                <div>
                                    <h3 className="font-black text-xl uppercase leading-none mb-1 text-black">{p.type}</h3>
                                    <span className="inline-block px-2 py-0.5 border-2 border-black bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                                        Talle {p.size}
                                    </span>
                                </div>
                            </div>
                            <span className="font-black text-2xl">${p.price}</span>
                        </div>

                        {/* Footer: Stock & Actions */}
                        <div className="flex justify-between items-end pt-4 border-t-2 border-black border-dashed">
                            <div className={`flex flex-col ${p.stock <= p.minStock ? 'text-red-600' : 'text-black'}`}>
                                <span className="text-[10px] uppercase font-black text-neutral-500 mb-1">Stock Actual</span>
                                <div className="flex items-center gap-2 font-black text-3xl leading-none">
                                    {p.stock <= p.minStock && <AlertCircle className="w-6 h-6" />}
                                    {p.stock}
                                </div>
                            </div>

                            <button
                                onClick={(e) => handleDelete(p.code, e)}
                                className="p-3 bg-white text-black border-2 border-black hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="p-12 text-center border-4 border-dashed border-neutral-300">
                    <p className="text-neutral-400 font-bold uppercase tracking-widest">No se encontraron productos</p>
                </div>
            )}
        </div>
    );
};

export default Inventory;
