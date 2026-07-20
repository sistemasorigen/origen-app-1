import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { AlertCircle, Trash2, Package, Shirt, PlusCircle, Search } from 'lucide-react';
import { ProductType } from '../../types';

const Inventory: React.FC = () => {
    const navigate = useNavigate();
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
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Filtros</span>
                </div>

                {/* Filter */}
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="w-full md:w-auto px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-bold outline-none focus:border-black shadow-sm transition-colors cursor-pointer"
                >
                    <option value="ALL">Todo el Inventario</option>
                    <option value="Remeras">Remeras</option>
                    <option value="Buzos">Buzos</option>
                </select>

                {/* Acciones — antes vivían como ítems sueltos
                    del Menú Principal, ahora integradas acá */}
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => navigate('/punto-de-informacion?view=SEARCH')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-700 text-sm font-bold rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-colors"
                    >
                        <Search className="w-4 h-4" />
                        Buscar
                    </button>
                    <button
                        onClick={() => navigate('/punto-de-informacion?view=NEW_PRODUCT')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-black bg-black text-white text-sm font-bold rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Desktop Table (Hidden on Mobile) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                        <tr>
                            <th className="px-6 py-3">Producto (Tipo)</th>
                            <th className="px-6 py-3">Talle</th>
                            <th className="px-6 py-3">Stock</th>
                            <th className="px-6 py-3">Precio</th>
                            <th className="px-6 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(p => (
                            <tr key={p.code} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold uppercase text-slate-900 text-sm">{p.type}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase">
                                        Talle {p.size}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className={`flex items-center gap-2 font-black text-lg ${p.stock <= p.minStock ? 'text-red-600' : 'text-slate-900'}`}>
                                        {p.stock <= p.minStock && <AlertCircle className="w-5 h-5" />}
                                        {p.stock}
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-black text-lg text-slate-900">${p.price}</td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        type="button"
                                        onClick={(e) => handleDelete(p.code, e)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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

            {/* MOBILE FEED */}
            <div className="md:hidden space-y-3 px-1">
                {filtered.map(p => (
                    <div key={p.code} className="w-full bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                        {/* Header: Type and Price */}
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                                    {p.type === ProductType.REMERA ? <Shirt className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                                </div>
                                <div>
                                    <h3 className="font-black text-xl uppercase leading-none mb-1 text-slate-900">{p.type}</h3>
                                    <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider">
                                        Talle {p.size}
                                    </span>
                                </div>
                            </div>
                            <span className="font-black text-2xl text-slate-900">${p.price}</span>
                        </div>

                        {/* Footer: Stock & Actions */}
                        <div className="flex justify-between items-end pt-4 border-t border-slate-200">
                            <div className={`flex flex-col ${p.stock <= p.minStock ? 'text-red-600' : 'text-slate-900'}`}>
                                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Stock Actual</span>
                                <div className="flex items-center gap-2 font-black text-3xl leading-none">
                                    {p.stock <= p.minStock && <AlertCircle className="w-6 h-6" />}
                                    {p.stock}
                                </div>
                            </div>

                            <button
                                onClick={(e) => handleDelete(p.code, e)}
                                className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="p-12 text-center border border-dashed border-slate-200 rounded-lg bg-white">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No se encontraron productos</p>
                </div>
            )}
        </div>
    );
};

export default Inventory;
