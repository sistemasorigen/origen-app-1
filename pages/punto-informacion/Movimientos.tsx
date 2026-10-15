import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store';
import { MovementType, Movement } from '../../types';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Trash2, Plus, Receipt, ClipboardCheck, ChevronDown } from 'lucide-react';

/**
 * El historial de movimientos del Punto.
 *
 * Es el libro del mostrador: qué se movió, cuándo y cómo se pagó. Antes cada
 * movimiento ocupaba media pantalla —un número enorme abajo a la izquierda y
 * el tacho al otro extremo—, así que de un vistazo no entraban ni tres.
 *
 * Ahora cada uno es una línea: el icono dice la dirección, el nombre y la hora
 * van juntos, y la cantidad va a la derecha donde se la busca. Las líneas se
 * agrupan por día, que es la pregunta que uno se hace parado ahí: "¿qué se
 * movió hoy?".
 *
 * Un reporte de stock entra como UNA línea y no como veinte: contar el stock
 * genera un ajuste por cada talle, y así el día de un reporte tapaba todo lo
 * demás. Se despliega para ver qué pasó con cada uno.
 */

const ZONA_ARG = 'America/Argentina/Buenos_Aires';

/** El día de un movimiento, como 'YYYY-MM-DD' argentino. */
const diaDe = (fecha: string) =>
    new Date(fecha).toLocaleDateString('en-CA', { timeZone: ZONA_ARG });

/** "Hoy", "Ayer", o "sábado 11 de octubre". */
const nombreDelDia = (dia: string) => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA_ARG });
    if (dia === hoy) return 'Hoy';

    const ayer = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: ZONA_ARG });
    if (dia === ayer) return 'Ayer';

    // El mediodía evita que la zona horaria corra la fecha un día.
    const d = new Date(`${dia}T12:00:00`);
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const hora = (fecha: string) =>
    new Date(fecha).toLocaleTimeString('es-AR', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: ZONA_ARG,
    });

/**
 * Verde entra, rojo sale, ámbar corrige. Son los tonos suaves que ya usa la
 * app para avisar cosas (bg-*-50 con texto *-700), no colores nuevos.
 */
const PINTA: Record<string, { icono: React.ElementType; fondo: string; texto: string }> = {
    [MovementType.IN]: { icono: ArrowUpRight, fondo: 'bg-emerald-50', texto: 'text-emerald-700' },
    [MovementType.OUT]: { icono: ArrowDownLeft, fondo: 'bg-red-50', texto: 'text-red-700' },
    [MovementType.ADJUST]: { icono: RefreshCw, fondo: 'bg-amber-50', texto: 'text-amber-700' },
};

/** Lo que muestra la cápsula de la derecha. */
const importe = (m: Movement) => {
    if (m.type === MovementType.IN) return `+${m.quantity}`;
    if (m.type === MovementType.OUT) return `−${m.quantity}`;
    return `Quedó en ${m.quantity}`;
};

/** Una línea del historial: un movimiento suelto, o un reporte entero. */
interface Entrada {
    clave: string;
    movimiento?: Movement;
    reporte?: { id: string; fecha: string; autor: string | null; items: Movement[] };
}

/** Una línea del historial: un movimiento suelto, o un reporte entero. */
interface Entrada {
    clave: string;
    movimiento?: Movement;
    reporte?: { id: string; fecha: string; autor: string | null; items: Movement[] };
}

const Movements: React.FC = () => {
    const navigate = useNavigate();
    const { movements, deleteMovement, showNotification } = useStore();
    const sinMovimiento = useReducedMotion();
    /** Qué reporte está desplegado. Uno a la vez. */
    const [abierto, setAbierto] = useState<string | null>(null);

    // Del más nuevo al más viejo, partido por día. Y adentro de cada día, los
    // movimientos de un mismo reporte entran juntos, en el lugar del más
    // nuevo de ellos.
    const porDia = useMemo(() => {
        const ordenados = [...movements].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        const dias: { dia: string; entradas: Entrada[] }[] = [];

        ordenados.forEach(m => {
            const dia = diaDe(m.date);
            let ultimo = dias[dias.length - 1];
            if (!ultimo || ultimo.dia !== dia) {
                ultimo = { dia, entradas: [] };
                dias.push(ultimo);
            }

            if (!m.reportId) {
                ultimo.entradas.push({ clave: m.id, movimiento: m });
                return;
            }
            const abierto = ultimo.entradas.find(e => e.reporte && e.reporte.id === m.reportId);
            if (abierto && abierto.reporte) abierto.reporte.items.push(m);
            else ultimo.entradas.push({
                clave: m.reportId,
                reporte: { id: m.reportId, fecha: m.date, autor: m.createdByName || null, items: [m] },
            });
        });

        return dias;
    }, [movements]);

    const borrar = async (m: Movement, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`¿Eliminar el movimiento de ${m.productName}? El stock revertido no se puede deshacer.`)) return;
        await deleteMovement(m.id);
        showNotification('Movimiento eliminado y stock revertido.');
    };

    return (
        <div className="animate-fadeIn">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-[22px] font-bold tracking-tight text-black leading-none">Historial</h2>
                        <p className="text-sm text-slate-500 mt-1.5">
                            Todo lo que entró, salió o se corrigió en el inventario.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/punto-de-informacion/movimientos/varios')}
                        className="shrink-0 w-full sm:w-auto px-5 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo movimiento
                    </button>
                </div>

                {porDia.map(({ dia, entradas }) => (
                    <section key={dia}>
                        {/* El día es el único rótulo de la lista, y dice algo:
                            abajo viene lo que pasó ese día. */}
                        <h3 className="sticky top-0 z-10 px-5 sm:px-6 py-2 bg-slate-50/95 backdrop-blur border-y border-slate-100 text-[13px] font-semibold text-slate-500 first-letter:uppercase">
                            {nombreDelDia(dia)}
                        </h3>

                        <ul className="divide-y divide-slate-100">
                            {entradas.map(e => {
                                // ── Un reporte de stock: una línea que se abre ──
                                if (e.reporte) {
                                    const r = e.reporte;
                                    const cambios = r.items.filter(m => m.type === MovementType.ADJUST).length;
                                    const estaAbierto = abierto === r.id;
                                    return (
                                        <li key={e.clave}>
                                            <button
                                                type="button"
                                                onClick={() => setAbierto(estaAbierto ? null : r.id)}
                                                aria-expanded={estaAbierto}
                                                aria-controls={`reporte-${r.id}`}
                                                className="w-full px-5 sm:px-6 py-3 flex items-center gap-3 text-left hover:bg-slate-50/60 transition-colors"
                                            >
                                                <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-700">
                                                    <ClipboardCheck className="w-[18px] h-[18px]" />
                                                </span>

                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-semibold text-[15px] text-black truncate leading-tight">Reporte de stock</h4>
                                                    <p className="mt-0.5 text-[13px] text-slate-400 truncate">
                                                        {r.autor ? `${r.autor} · ` : ''}{hora(r.fecha)} · {cambios === 1 ? '1 cambio' : `${cambios} cambios`}
                                                    </p>
                                                </div>

                                                <ChevronDown className={`shrink-0 w-4 h-4 text-slate-300 transition-transform duration-200 ${estaAbierto ? 'rotate-180' : ''}`} />
                                            </button>

                                            <AnimatePresence initial={false}>
                                                {estaAbierto && (
                                                    <motion.ul
                                                        id={`reporte-${r.id}`}
                                                        initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={sinMovimiento ? { opacity: 0 } : { height: 0, opacity: 0 }}
                                                        transition={{ duration: sinMovimiento ? 0 : 0.2, ease: 'easeOut' }}
                                                        className="overflow-hidden bg-slate-50/60 border-t border-slate-100 divide-y divide-slate-100"
                                                    >
                                                        {r.items.map(m => {
                                                            const tinte = PINTA[m.type] || PINTA[MovementType.ADJUST];
                                                            return (
                                                                <li key={m.id} className="pl-[68px] pr-5 sm:pr-6 py-2.5 flex items-center gap-3">
                                                                    <span className="min-w-0 flex-1 text-[14px] text-slate-600 truncate">{m.productName}</span>
                                                                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums ${tinte.fondo} ${tinte.texto}`}>
                                                                        {importe(m)}
                                                                    </span>
                                                                </li>
                                                            );
                                                        })}
                                                    </motion.ul>
                                                )}
                                            </AnimatePresence>
                                        </li>
                                    );
                                }

                                // ── Un movimiento suelto ──
                                const m = e.movimiento as Movement;
                                const pinta = PINTA[m.type] || PINTA[MovementType.ADJUST];
                                const Icono = pinta.icono;
                                return (
                                    <li key={e.clave} className="px-5 sm:px-6 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                                        <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${pinta.fondo} ${pinta.texto}`}>
                                            <Icono className="w-[18px] h-[18px]" />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <h4 className="font-semibold text-[15px] text-black truncate leading-tight">{m.productName}</h4>
                                            <p className="flex items-center gap-1.5 mt-0.5 text-[13px] text-slate-400">
                                                <span>{hora(m.date)}</span>
                                                {m.paymentMethod && (
                                                    <span className="text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 text-[11px] font-medium">
                                                        {m.paymentMethod}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${pinta.fondo} ${pinta.texto}`}>
                                            {importe(m)}
                                        </span>

                                        {/* Los de un reporte no se borran de a uno: sacar uno
                                            descuadraría el conteo entero. */}
                                        {!m.reportId && (
                                            <button
                                                type="button"
                                                onClick={ev => borrar(m, ev)}
                                                className="shrink-0 w-9 h-9 -mr-1.5 flex items-center justify-center rounded-full text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                aria-label={`Eliminar el movimiento de ${m.productName}`}
                                            >
                                                <Trash2 className="w-4 h-4 pointer-events-none" />
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}

                {movements.length === 0 && (
                    <div className="flex flex-col items-center text-center px-6 py-16 border-t border-slate-100">
                        <span className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <Receipt className="w-6 h-6 text-slate-400" />
                        </span>
                        <h3 className="text-lg font-bold tracking-tight text-black">Todavía no se movió nada</h3>
                        <p className="text-sm text-slate-500 mt-1.5 mb-6 max-w-xs">
                            Cuando cargues una entrada, una salida o un ajuste, va a aparecer acá.
                        </p>
                        <button
                            onClick={() => navigate('/punto-de-informacion/movimientos/varios')}
                            className="px-5 py-3.5 bg-black text-white font-semibold text-sm rounded-full hover:bg-neutral-800 active:scale-[0.99] transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Cargar el primero
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Movements;
