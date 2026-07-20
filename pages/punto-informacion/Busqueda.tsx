import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType, INFO_POINT_SIZES } from '../../types';
import { Search as SearchIcon, Package } from 'lucide-react';

const Search: React.FC = () => {
    const { products } = useStore();
    const [selectedType, setSelectedType] = useState<ProductType>(ProductType.REMERA);
    const [selectedSize, setSelectedSize] = useState('1');

    // Find specific stock
    const targetCode = `${selectedType.toUpperCase()}-${selectedSize}`;
    const product = products.find(p => p.code === targetCode);
    const stock = product ? product.stock : 0;

    return (
        <div className="max-w-xl mx-auto space-y-8 animate-fadeIn pt-10 p-1">
            <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Prenda</label>
                        <select
                            value={selectedType}
                            onChange={e => setSelectedType(e.target.value as ProductType)}
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-bold text-slate-900 uppercase cursor-pointer focus:border-black transition-colors"
                        >
                            {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Talle</label>
                        <select
                            value={selectedSize}
                            onChange={e => setSelectedSize(e.target.value)}
                            className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none text-sm font-bold text-slate-900 uppercase cursor-pointer focus:border-black transition-colors"
                        >
                            {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="text-center py-8 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Stock disponible</p>
                    <div className={`text-7xl font-black transition-colors ${stock > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                        {stock}
                    </div>
                </div>
            </div>

            <div className="text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                Selecciona el tipo y talle para ver disponibilidad
            </div>
        </div>
    );
};

export default Search;