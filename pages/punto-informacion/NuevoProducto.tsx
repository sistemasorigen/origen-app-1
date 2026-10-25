import React, { useState } from 'react';
import { useStore } from '../../store';
import { ProductType, INFO_POINT_SIZES, NOMBRE_CORTO_DE_TIPO, codigoDeProducto } from '../../types';
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
    // Los números se guardan como TEXTO mientras se escriben. Como número, un
    // campo borrado volvía a 0 en el acto y no se podía dejar vacío para
    // escribir otro valor. Se convierten recién para mostrar y guardar.
    const VACIO = { type: ProductType.REMERA, size: '1', price: '', stock: '0', minStock: '1' };
    const [form, setForm] = useState(VACIO);
    const [guardando, setGuardando] = useState(false);
    const [revisando, setRevisando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /** Sólo dígitos: lo que se escribe en el campo. */
    const digitos = (texto: string) => texto.replace(/[^0-9]/g, '').slice(0, 7);
    /** El valor como número, para mostrar y guardar. Vacío es 0. */
    const numero = (texto: string) => {
        const n = parseInt(texto, 10);
        return Number.isNaN(n) ? 0 : n;
    };

    const codigo = codigoDeProducto(form.type, form.size);
    const yaExiste = products.some(p => p.code === codigo);

    // La Servolución no tiene precio propio: lleva el de las remeras, y la
    // base lo pone sola al crearla y lo actualiza cuando cambian las remeras.
    // Acá sólo se muestra, para que nadie escriba un precio que no va a quedar.
    const sigueARemeras = form.type === ProductType.SERVOLUCION;
    const precioDeRemeras = (() => {
        const cuenta = new Map<number, number>();
        products.filter(p => p.type === ProductType.REMERA)
            .forEach(p => cuenta.set(p.price ?? 0, (cuenta.get(p.price ?? 0) || 0) + 1));
        return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
    })();
    const precioFinal = sigueARemeras ? precioDeRemeras : numero(form.price);
    const stock = numero(form.stock);
    const minimo = numero(form.minStock);

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
            await addProduct({
                type: form.type, size: form.size, price: precioFinal, stock, minStock: minimo,
                code: codigo, name: `${form.type} Talle ${form.size}`,
            });
            toast.success(`${form.type} talle ${form.size} creado.`);
            setForm(VACIO);
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
                    Un talle de remera, de buzo o de remera Servolución. El nombre y el código se arman solos.
                </p>

                <form id="form-producto" onSubmit={revisar} className="space-y-4">
                    <Campo etiqueta="Qué es">
                        <Opciones
                            etiquetaGrupo="Qué prenda"
                            valor={form.type}
                            opciones={Object.values(ProductType).map(t => ({ valor: t, etiqueta: NOMBRE_CORTO_DE_TIPO[t] }))}
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

                    <Campo
                        etiqueta="Precio"
                        para="producto-precio"
                        ayuda={sigueARemeras ? 'Sigue al precio de las remeras: cambia cuando cambian ellas.' : undefined}
                    >
                        <input
                            id="producto-precio" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" required
                            placeholder="15000"
                            value={sigueARemeras ? String(precioDeRemeras) : form.price}
                            readOnly={sigueARemeras}
                            aria-readonly={sigueARemeras}
                            onChange={e => { if (!sigueARemeras) setForm({ ...form, price: digitos(e.target.value) }); }}
                            className={`${campo} ${sigueARemeras ? 'text-slate-500' : ''}`}
                        />
                    </Campo>

                    <ParDeCampos juntos>
                        <Campo etiqueta="Cuántos hay" para="producto-stock">
                            <input
                                id="producto-stock" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" required
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: digitos(e.target.value) })}
                                className={campo}
                            />
                        </Campo>
                        <Campo etiqueta="Avisar cuando queden" para="producto-minimo" ayuda="O menos.">
                            <input
                                id="producto-minimo" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" required
                                value={form.minStock}
                                onChange={e => setForm({ ...form, minStock: digitos(e.target.value) })}
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
                detalle={yaExiste ? 'Ya existe' : `${stock} en stock · $${precioFinal.toLocaleString('es-AR')}`}
                deshabilitado={yaExiste}
            />
            <HojaDeRevision
                abierta={revisando}
                titulo="Revisá el producto"
                bajada="El nombre y el código se arman solos."
                grupos={[{ filas: [
                    { etiqueta: 'Producto', valor: `${form.type} talle ${form.size}` },
                    { etiqueta: 'Código', valor: codigo },
                    { etiqueta: 'Precio', valor: `$${precioFinal.toLocaleString('es-AR')}${sigueARemeras ? ' (el de las remeras)' : ''}` },
                    { etiqueta: 'Cuántos hay', valor: String(stock) },
                    { etiqueta: 'Avisar con', valor: `${minimo} o menos` },
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
