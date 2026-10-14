import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType, INFO_POINT_SIZES } from '../../types';
import { useToast } from './context/ContextoToast';
import {
    Campo, ParDeCampos, BotonGuardar, Opciones, campo,
} from '../../components/info-point/FormularioDelPunto';

/**
 * Alta de un producto del Punto.
 *
 * Vive adentro del panel —no es una ruta suelta—, así que no lleva cabecera
 * propia ni botón de volver: la tarjeta es el formulario.
 */
const NewProduct: React.FC = () => {
    const { addProduct, products } = useStore();
    const toast = useToast();
    const [form, setForm] = useState({
        type: ProductType.REMERA,
        size: '1',
        price: 0,
        stock: 0,
        minStock: 5,
    });
    const [guardando, setGuardando] = useState(false);

    const numero = (texto: string) => {
        const n = parseInt(texto.replace(/[^0-9]/g, ''), 10);
        return Number.isNaN(n) ? 0 : n;
    };

    const codigo = `${form.type.toUpperCase()}-${form.size}`;
    const yaExiste = products.some(p => p.code === codigo);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (yaExiste) {
            toast.error(`Ya hay un producto de ${form.type} talle ${form.size}.`);
            return;
        }
        setGuardando(true);
        try {
            await addProduct({ ...form, code: codigo, name: `${form.type} Talle ${form.size}` });
            toast.success(`${form.type} talle ${form.size} creado.`);
            setForm({ type: ProductType.REMERA, size: '1', price: 0, stock: 0, minStock: 5 });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div id="punto-formulario" className="animate-fadeIn">
            <div className="w-full max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
                <h2 className="text-[22px] font-bold tracking-tight text-black leading-none">Nuevo producto</h2>
                <p className="text-sm text-slate-500 mt-1.5 mb-6">
                    Un talle de remera o de buzo. El nombre y el código se arman solos.
                </p>

                <form onSubmit={guardar} className="space-y-4">
                    <Campo etiqueta="Qué es">
                        <Opciones
                            etiquetaGrupo="Remera o buzo"
                            valor={form.type}
                            opciones={Object.values(ProductType).map(t => ({ valor: t }))}
                            onElegir={v => setForm({ ...form, type: v as ProductType })}
                        />
                    </Campo>

                    <Campo etiqueta="Talle" para="producto-talle">
                        <select
                            id="producto-talle"
                            className={`${campo} cursor-pointer`}
                            value={form.size}
                            onChange={e => setForm({ ...form, size: e.target.value })}
                        >
                            {INFO_POINT_SIZES.map(s => <option key={s} value={s}>Talle {s}</option>)}
                        </select>
                    </Campo>

                    <Campo etiqueta="Precio" para="producto-precio">
                        <input
                            id="producto-precio" type="number" inputMode="numeric" min={0} required
                            placeholder="15000"
                            value={form.price}
                            onChange={e => setForm({ ...form, price: numero(e.target.value) })}
                            className={campo}
                        />
                    </Campo>

                    <ParDeCampos juntos>
                        <Campo etiqueta="Cuántos hay" para="producto-stock">
                            <input
                                id="producto-stock" type="number" inputMode="numeric" min={0} required
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: numero(e.target.value) })}
                                className={campo}
                            />
                        </Campo>
                        <Campo etiqueta="Avisar cuando queden" para="producto-minimo" ayuda="O menos.">
                            <input
                                id="producto-minimo" type="number" inputMode="numeric" min={0} required
                                value={form.minStock}
                                onChange={e => setForm({ ...form, minStock: numero(e.target.value) })}
                                className={campo}
                            />
                        </Campo>
                    </ParDeCampos>

                    <div className={`rounded-xl px-4 py-3 text-[13px] ${yaExiste ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
                        {yaExiste
                            ? `Ya existe ${form.type} talle ${form.size}. Cambiá el talle o editá el stock desde Inventario.`
                            : <>Se va a crear <span className="font-semibold text-black">{form.type} talle {form.size}</span>.</>}
                    </div>

                    <div className="pt-1">
                        <BotonGuardar guardando={guardando} deshabilitado={yaExiste}>
                            Crear el producto
                        </BotonGuardar>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewProduct;
