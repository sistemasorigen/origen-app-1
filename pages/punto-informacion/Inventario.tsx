import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { AlertCircle, Trash2, Package, PlusCircle, Search } from 'lucide-react';

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
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-bold uppercase tracking-widest rounded-lg shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                        <Search className="w-4 h-4" />
                        Buscar
                    </button>
                    <button
                        onClick={() => navigate('/punto-de-informacion?view=NEW_PRODUCT')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Desktop Table (Hidden on Mobile) */}
            <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Producto</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Talle</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Stock</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Precio</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(p => {
                            const lowStock = p.stock <= p.minStock;
                            return (
                                <tr key={p.code} className={`transition-colors hover:bg-slate-50/80 ${lowStock ? 'bg-red-50/30' : 'bg-white'}`}>
                                    <td className="px-4 py-3 align-middle font-black text-sm text-slate-900 uppercase">{p.type}</td>
                                    <td className="px-4 py-3 align-middle">
                                        <span className="inline-block text-[10px] text-slate-500 font-bold uppercase tracking-wide bg-slate-100 px-1.5 py-px rounded border border-slate-200">
                                            Talle {p.size}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-middle">
                                        <div className={`flex items-center gap-1.5 text-sm font-black tabular-nums ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>
                                            {lowStock && <AlertCircle className="w-4 h-4" />}
                                            {p.stock}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-middle text-sm font-bold text-slate-700 tabular-nums">${p.price}</td>
                                    <td className="px-4 py-3 align-middle text-right">
                                        <button
                                            type="button"
                                            onClick={(e) => handleDelete(p.code, e)}
                                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                            title="Eliminar producto"
                                            aria-label={`Eliminar ${p.type} talle ${p.size}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MOBILE FEED */}
            <div className="md:hidden space-y-3 px-1">
                {filtered.map(p => {
                    const lowStock = p.stock <= p.minStock;
                    return (
                        <div key={p.code} className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${lowStock ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}>
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <h3 className="font-black text-base uppercase leading-tight text-slate-900">{p.type}</h3>
                                    <span className="inline-block mt-1 text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase font-bold tracking-wide border border-slate-200">
                                        Talle {p.size}
                                    </span>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(p.code, e)}
                                    className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                    aria-label={`Eliminar ${p.type} talle ${p.size}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-0.5">Precio</p>
                                    <p className="text-sm font-black text-slate-900 tabular-nums">${p.price}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-0.5">Stock</p>
                                    <div className={`flex items-center gap-1 text-sm font-black tabular-nums ${lowStock ? 'text-red-600' : 'text-slate-900'}`}>
                                        {lowStock && <AlertCircle className="w-3.5 h-3.5" />}
                                        {p.stock}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold text-sm uppercase tracking-wide">No se encontraron productos</p>
                </div>
            )}
        </div>
    );
};

export default Inventory;
