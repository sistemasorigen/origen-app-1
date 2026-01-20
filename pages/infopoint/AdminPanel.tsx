import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType } from '../../types';
import { useToast } from './context/ToastContext';

const AdminPanel: React.FC = () => {
    const { products } = useStore();
    const { toast } = useToast();
    const [priceUpdate, setPriceUpdate] = useState({ type: ProductType.REMERA, price: 0 });

    const handleUpdatePrices = async () => {
        if (confirm(`¿Actualizar el precio de todos los productos tipo "${priceUpdate.type}" a $${priceUpdate.price}?`)) {
            const { dbAPI } = await import('../../services/db');
            await dbAPI.updateProductPricesByType(priceUpdate.type, priceUpdate.price);
            toast.success('Precios actualizados masivamente.');
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
        <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn pb-10">
            <h2 className="text-3xl font-black text-black uppercase tracking-tight mb-8 border-b-4 border-black inline-block pb-1">
                Panel de Configuración
            </h2>

            {/* MASS PRICE UPDATE */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xl font-black mb-6 text-black uppercase tracking-tight border-b-2 border-black pb-2">
                    Actualización Masiva
                </h3>
                <div className="space-y-4">
                    <p className="text-xs font-bold uppercase text-neutral-500 mb-2">Selecciona el tipo y el nuevo precio:</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-black uppercase tracking-widest mb-1 block">Tipo</label>
                            <select
                                value={priceUpdate.type}
                                onChange={e => setPriceUpdate({ ...priceUpdate, type: e.target.value as ProductType })}
                                className="w-full h-12 px-3 border-2 border-black rounded-none bg-white text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
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
                                className="w-full h-12 px-3 border-2 border-black rounded-none bg-white text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleUpdatePrices}
                        className="w-full h-12 bg-black text-white border-2 border-black font-black uppercase tracking-widest hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all mt-2"
                    >
                        Ejecutar Actualización
                    </button>
                </div>
            </div>

            {/* EXPORT DATA */}
            <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="text-xl font-black mb-6 text-black uppercase tracking-tight border-b-2 border-black pb-2">
                    Exportar Datos
                </h3>
                <p className="text-xs font-bold uppercase text-neutral-500 mb-4">Descarga el inventario completo en formato CSV compatible con Excel.</p>
                <button
                    onClick={downloadCSV}
                    className="w-full h-12 bg-[#118f46] text-white border-2 border-black font-black uppercase tracking-widest hover:bg-white hover:text-[#118f46] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                    Descargar Inventario CSV
                </button>
            </div>
        </div>
    );
};

export default AdminPanel;