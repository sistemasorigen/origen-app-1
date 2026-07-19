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
            <div className="bg-white border-2 md:border-4 border-black p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all">
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest border-b-2 border-black mb-2 inline-block">Prenda</label>
                        <select
                            value={selectedType}
                            onChange={e => setSelectedType(e.target.value as ProductType)}
                            className="w-full p-4 bg-white border-2 border-black rounded-lg outline-none text-lg font-black uppercase cursor-pointer focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none"
                        >
                            {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest border-b-2 border-black mb-2 inline-block">Talle</label>
                        <select
                            value={selectedSize}
                            onChange={e => setSelectedSize(e.target.value)}
                            className="w-full p-4 bg-white border-2 border-black rounded-lg outline-none text-lg font-black uppercase cursor-pointer focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all appearance-none"
                        >
                            {INFO_POINT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="text-center py-6 border-4 border-black bg-neutral-50 relative overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>

                    <p className="text-sm font-black uppercase tracking-widest text-black mb-2 relative z-10">Stock Disponible</p>
                    <div className={`text-7xl font-black transition-colors relative z-10 ${stock > 0 ? 'text-black' : 'text-neutral-300'}`}>
                        {stock}
                    </div>
                </div>
            </div>

            <div className="text-center text-black font-bold uppercase text-xs tracking-widest opacity-60">
                Selecciona el tipo y talle para ver disponibilidad
            </div>
        </div>
    );
};

export default Search;