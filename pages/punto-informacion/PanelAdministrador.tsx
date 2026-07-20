import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType } from '../../types';
import { useToast } from './context/ContextoToast';
import { RefreshCw, Download, AlertTriangle } from 'lucide-react';

const AdminPanel: React.FC = () => {
    const { products, refreshData } = useStore();
    const toast = useToast();
    const [priceUpdate, setPriceUpdate] = useState({ type: ProductType.REMERA, price: 0 });
    const [confirmOpen, setConfirmOpen] = useState(false);

    const executeUpdate = async () => {
        setConfirmOpen(false);
        try {
            const { dbAPI } = await import('../../services/db');
            await dbAPI.updateProductPricesByType(priceUpdate.type, priceUpdate.price);
            await refreshData();
            toast.success('Precios actualizados masivamente.');
        } catch {
            toast.error('Error al actualizar precios.');
        }
    };

    const downloadCSV = () => {
        const headers = ["Codigo", "Nombre", "Tipo", "Talle", "Stock", "Precio"];
        const rows = products.map(p => [p.code, p.name, p.type, p.size, p.stock, p.price]);
        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "inventario_origen.csv");
        document.body.appendChild(link);
        link.click();
        toast.success('Archivo CSV descargado.');
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 animate-fadeIn pb-10">

            {/* CONFIRM MODAL */}
            {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Confirmar actualización</h2>
                        </div>
                        <p className="text-sm font-medium text-slate-500 mb-2">
                            Se actualizarán <span className="text-slate-900 font-bold">todos</span> los productos de tipo:
                        </p>
                        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50">
                            <span className="text-base font-black uppercase text-slate-900">{priceUpdate.type}</span>
                            <span className="text-slate-400 font-bold">→</span>
                            <span className="text-base font-black text-slate-900">${priceUpdate.price.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-lg font-bold uppercase text-xs tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeUpdate}
                                className="flex-1 py-2.5 bg-black text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MASS PRICE UPDATE */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-base font-black mb-4 text-slate-900 uppercase tracking-tight border-b border-slate-200 pb-3 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-slate-400" />
                    Actualización masiva
                </h3>
                <div className="space-y-4">
                    <p className="text-xs font-medium uppercase text-slate-500">Selecciona el tipo y el nuevo precio:</p>
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Tipo</label>
                            <select
                                value={priceUpdate.type}
                                onChange={e => setPriceUpdate({ ...priceUpdate, type: e.target.value as ProductType })}
                                className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-900 font-bold outline-none focus:border-black transition-colors cursor-pointer"
                            >
                                {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Precio ($)</label>
                            <input
                                type="number"
                                value={priceUpdate.price}
                                onChange={e => setPriceUpdate({ ...priceUpdate, price: parseInt(e.target.value) })}
                                className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-900 font-bold outline-none focus:border-black transition-colors"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setConfirmOpen(true)}
                        className="w-full h-11 bg-black text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors"
                    >
                        Ejecutar actualización
                    </button>
                </div>
            </div>

            {/* EXPORT DATA */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-base font-black mb-4 text-slate-900 uppercase tracking-tight border-b border-slate-200 pb-3 flex items-center gap-2">
                    <Download className="w-5 h-5 text-slate-400" />
                    Exportar datos
                </h3>
                <p className="text-xs font-medium uppercase text-slate-500 mb-4">Descarga el inventario completo en formato CSV compatible con Excel.</p>
                <button
                    onClick={downloadCSV}
                    className="w-full h-11 bg-[#118f46] text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-[#0f7a3c] transition-colors flex items-center justify-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Descargar inventario CSV
                </button>
            </div>
        </div>
    );
};

export default AdminPanel;
