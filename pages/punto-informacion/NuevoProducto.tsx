import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType, INFO_POINT_SIZES } from '../../types';
import { useToast } from './context/ContextoToast';
import {
    Campo, ParDeCampos, BarraDeRevisar, HojaDeRevision, Opciones, campo,
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
    const [revisando, setRevisando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const numero = (texto: string) => {
        const n = parseInt(texto.replace(/[^0-9]/g, ''), 10);
        return Number.isNaN(n) ? 0 : n;
    };

    const codigo = `${form.type.toUpperCase()}-${form.size}`;
    const yaExiste = products.some(p => p.code === codigo);

    // Enviar el formulario no crea: abre la revisión.
    const revisar = (e: React.FormEvent) => {
        e.preventDefault();
        if (yaExiste) {
            toast.error(`Ya hay un producto de ${form.type} talle ${form.size}.`);
            return;
        }
        setError(null);
        setRevisando(true);
    };

    const guardar = async () => {
        setGuardando(true);
        setError(null);
        try {
            await addProduct({ ...form, code: codigo, name: `${form.type} Talle ${form.size}` });
            toast.success(`${form.type} talle ${form.size} creado.`);
            setForm({ type: ProductType.REMERA, size: '1', price: 0, stock: 0, minStock: 5 });
            setRevisando(false);
        } catch (err) {
            console.error('[Punto] producto:', err);
            setError('No se pudo guardar. Revisá la conexión y probá de nuevo: los datos siguen acá.');
        } finally {
            setGuardando(false);
        }
    };

    return (
        // pb-24: lo último del formulario no queda debajo de la barra.
        <div id="punto-formulario" className="animate-fadeIn pb-24">
            <div className="w-full max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
                <p className="text-sm text-slate-500 mb-6">
                    Un talle de remera o de buzo. El nombre y el código se arman solos.
                </p>

                <form id="form-producto" onSubmit={revisar} className="space-y-4">
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
                </form>
            </div>

            <BarraDeRevisar
                form="form-producto"
                resumen={`${form.type} talle ${form.size}`}
                detalle={yaExiste ? 'Ya existe' : `${form.stock} en stock · $${form.price.toLocaleString('es-AR')}`}
                deshabilitado={yaExiste}
            />
            <HojaDeRevision
                abierta={revisando}
                titulo="Revisá el producto"
                bajada="El nombre y el código se arman solos."
                grupos={[{ filas: [
                    { etiqueta: 'Producto', valor: `${form.type} talle ${form.size}` },
                    { etiqueta: 'Código', valor: codigo },
                    { etiqueta: 'Precio', valor: `$${form.price.toLocaleString('es-AR')}` },
                    { etiqueta: 'Cuántos hay', valor: String(form.stock) },
                    { etiqueta: 'Avisar con', valor: `${form.minStock} o menos` },
                ] }]}
                textoConfirmar="Crear el producto"
                guardando={guardando}
                error={error}
                onCorregir={() => setRevisando(false)}
                onConfirmar={guardar}
            />
        </div>
    );
};

export default NewProduct;
