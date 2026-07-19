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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 w-full max-w-sm mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                            <h2 className="text-lg font-black uppercase tracking-tighter">Confirmar actualización</h2>
                        </div>
                        <p className="text-sm font-bold text-slate-600 mb-2">
                            Se actualizarán <span className="text-black font-black">todos</span> los productos de tipo:
                        </p>
                        <div className="flex items-center gap-3 mb-6 p-3 border-4 border-black bg-slate-50">
                            <span className="text-base font-black uppercase">{priceUpdate.type}</span>
                            <span className="text-slate-400 font-bold">→</span>
                            <span className="text-base font-black">${priceUpdate.price.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="flex-1 py-3 border-4 border-black font-black uppercase text-sm hover:bg-slate-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeUpdate}
                                className="flex-1 py-3 bg-black text-white border-4 border-black font-black uppercase text-sm hover:bg-neutral-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MASS PRICE UPDATE */}
            <div className="bg-white border-2 border-black rounded-xl p-4 md:p-6 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-black mb-4 text-black uppercase tracking-tight border-b-2 border-black pb-2 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5" />
                    Actualización Masiva
                </h3>
                <div className="space-y-4">
                    <p className="text-xs font-bold uppercase text-neutral-500">Selecciona el tipo y el nuevo precio:</p>
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest mb-1 block">Tipo</label>
                            <select
                                value={priceUpdate.type}
                                onChange={e => setPriceUpdate({ ...priceUpdate, type: e.target.value as ProductType })}
                                className="w-full h-12 px-3 border-2 border-black rounded-lg bg-white text-black font-bold outline-none focus:ring-2 focus:ring-black transition-all cursor-pointer"
                            >
                                {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest mb-1 block">Precio ($)</label>
                            <input
                                type="number"
                                value={priceUpdate.price}
                                onChange={e => setPriceUpdate({ ...priceUpdate, price: parseInt(e.target.value) })}
                                className="w-full h-12 px-3 border-2 border-black rounded-lg bg-white text-black font-bold outline-none focus:ring-2 focus:ring-black transition-all"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setConfirmOpen(true)}
                        className="w-full h-12 bg-black text-white border-2 border-black rounded-lg font-black uppercase tracking-widest active:scale-[0.98] transition-all"
                    >
                        Ejecutar Actualización
                    </button>
                </div>
            </div>

            {/* EXPORT DATA */}
            <div className="bg-white border-2 border-black rounded-xl p-4 md:p-6 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-lg font-black mb-4 text-black uppercase tracking-tight border-b-2 border-black pb-2 flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Exportar Datos
                </h3>
                <p className="text-xs font-bold uppercase text-neutral-500 mb-4">Descarga el inventario completo en formato CSV compatible con Excel.</p>
                <button
                    onClick={downloadCSV}
                    className="w-full h-12 bg-emerald-600 text-white border-2 border-black rounded-lg font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Descargar Inventario CSV
                </button>
            </div>
        </div>
    );
};

export default AdminPanel;
