import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { MESES } from './datosDeAudiencia';

/**
 * El período de Audiencia de Servicios: un botón con el rango elegido que abre
 * un calendario.
 *
 * Reemplaza a los dos selects de año y mes. Con ellos sólo se podía mirar un
 * mes entero o un año entero; "las últimas seis semanas" o "de Pascua a hoy"
 * no había forma de pedirlo. Los atajos de arriba cubren lo que hacían los
 * selects, en un toque.
 *
 * Se elige sobre un borrador, en dos toques —el día en que empieza y el día en
 * que termina—, y nada cambia en la planilla hasta "Aplicar": un rango a medio
 * elegir no hace saltar los números de abajo.
 *
 * Los días con un servicio cargado llevan un punto. Es lo que se viene a
 * buscar, y sin él no se sabe si un rango agarra algo hasta aplicarlo.
 *
 * En escritorio son dos meses lado a lado en un panel que cuelga del botón; en
 * el teléfono, un mes por vez en una hoja que sube desde abajo, porque dos
 * meses no entran a lo ancho.
 */

export interface Rango { desde: string; hasta: string; }

// ── Fechas como 'YYYY-MM-DD', siempre en hora local ───────────────────────
// Nada de new Date('2026-10-05'): eso es UTC y en Argentina cae el día anterior.

const dos = (n: number) => String(n).padStart(2, '0');
export const isoDe = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const fechaDeIso = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const hoyIso = () => isoDe(new Date());
/** Último día del mes; `m` empieza en 0. */
const ultimoDia = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const diasEntre = (a: string, b: string) =>
    Math.round((fechaDeIso(b).getTime() - fechaDeIso(a).getTime()) / 86400000);

/** Un mes como un número corrido (año × 12 + mes), para sumar y comparar meses. */
const mesDe = (iso: string) => {
    const d = fechaDeIso(iso);
    return d.getFullYear() * 12 + d.getMonth();
};

const MES_CORTO = MESES.map(m => m.slice(0, 3).toLowerCase());
const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** El año entero, o hasta hoy si es el año en curso: el futuro no tiene servicios. */
export const rangoDelAnio = (anio: number): Rango => {
    const hoy = hoyIso();
    const fin = `${anio}-12-31`;
    return { desde: `${anio}-01-01`, hasta: fin > hoy && hoy.startsWith(String(anio)) ? hoy : fin };
};

/**
 * Cómo se nombra un rango: en el botón y en el título de la pantalla.
 *
 * Un año o un mes enteros se dicen por su nombre —"Todo 2026", "Septiembre
 * 2026"—, como los nombraban los selects de antes. El año o el mes en curso
 * cuentan como enteros si llegan hasta hoy.
 */
export const etiquetaDeRango = ({ desde, hasta }: Rango): string => {
    const a = fechaDeIso(desde);
    const b = fechaDeIso(hasta);
    const hoy = hoyIso();
    const [ya, ma, yb, mb] = [a.getFullYear(), a.getMonth(), b.getFullYear(), b.getMonth()];

    if (desde === `${ya}-01-01` && ya === yb && (hasta === `${ya}-12-31` || hasta === hoy)) return `Todo ${ya}`;
    if (a.getDate() === 1 && ya === yb && ma === mb && (b.getDate() === ultimoDia(yb, mb) || hasta === hoy)) {
        return `${MESES[ma]} ${ya}`;
    }
    if (desde === hasta) return `${a.getDate()} ${MES_CORTO[ma]} ${ya}`;
    if (ya === yb) return `${a.getDate()} ${MES_CORTO[ma]} – ${b.getDate()} ${MES_CORTO[mb]} ${yb}`;
    return `${a.getDate()} ${MES_CORTO[ma]} ${ya} – ${b.getDate()} ${MES_CORTO[mb]} ${yb}`;
};

/** Los atajos: los rangos que más se piden, y un año por cada año con datos. */
export const atajosDeRango = (anios: number[]): { etiqueta: string; rango: Rango }[] => {
    const h = new Date();
    const hoy = isoDe(h);
    const [y, m] = [h.getFullYear(), h.getMonth()];
    return [
        { etiqueta: 'Este mes', rango: { desde: isoDe(new Date(y, m, 1)), hasta: hoy } },
        { etiqueta: 'Mes pasado', rango: { desde: isoDe(new Date(y, m - 1, 1)), hasta: isoDe(new Date(y, m, 0)) } },
        { etiqueta: 'Últimos 3 meses', rango: { desde: isoDe(new Date(y, m - 3, h.getDate() + 1)), hasta: hoy } },
        ...anios.map(a => ({ etiqueta: String(a), rango: rangoDelAnio(a) })),
    ];
};

const fechaEnCampo = (iso: string | null) => {
    if (!iso) return '';
    const d = fechaDeIso(iso);
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const useEsMovil = () => {
    const consulta = '(max-width: 767px)';
    const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
    useEffect(() => {
        const mq = window.matchMedia(consulta);
        const cambiar = () => setEs(mq.matches);
        mq.addEventListener('change', cambiar);
        return () => mq.removeEventListener('change', cambiar);
    }, []);
    return es;
};

/**
 * El barrido: cuando el rango queda elegido, la franja se pinta día por día
 * desde el inicio hasta el fin, para que se vea qué días entran en la cuenta.
 * El paso se ajusta a cuántos días del rango hay a la vista: una semana se
 * pinta despacio, dos meses llenos más rápido, y nunca tarda más de ~0,6 s.
 * Con "reducir movimiento" activado en el sistema, la franja aparece entera
 * y sin animación.
 */
const ESTILOS = `
@keyframes rango-barrido { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes rango-punta { 0% { transform: scale(.55); opacity: .35; } 70% { transform: scale(1.07); opacity: 1; } 100% { transform: scale(1); } }
@keyframes rango-panel { from { transform: translateY(-6px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes rango-hoja { from { transform: translateY(32px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes rango-velo { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .rango-anim { animation: none !important; } }
`;

type Editando = 'nuevo' | 'desde' | 'hasta';

interface Props {
    valor: Rango;
    onCambiar: (r: Rango) => void;
    /** Cuántos servicios hay cargados en cada día ('YYYY-MM-DD' → cantidad). */
    serviciosPorDia: Map<string, number>;
    atajos: { etiqueta: string; rango: Rango }[];
}

const SelectorDeRango: React.FC<Props> = ({ valor, onCambiar, serviciosPorDia, atajos }) => {
    const [abierto, setAbierto] = useState(false);
    const [desde, setDesde] = useState<string | null>(valor.desde);
    const [hasta, setHasta] = useState<string | null>(valor.hasta);
    // 'nuevo': el próximo toque arranca un rango. 'desde' / 'hasta': se tocó
    // ese campo y el próximo toque cambia sólo esa punta.
    const [editando, setEditando] = useState<Editando>('nuevo');
    const [sobre, setSobre] = useState<string | null>(null);
    /** El mes de la derecha (en el teléfono, el único que se ve). */
    const [mesVisible, setMesVisible] = useState(() => mesDe(valor.hasta));
    /** Cambia cada vez que hay que volver a pasar el barrido. */
    const [barrido, setBarrido] = useState(0);

    const esMovil = useEsMovil();
    const raiz = useRef<HTMLDivElement>(null);
    const hoy = hoyIso();
    const mesDeHoy = mesDe(hoy);

    useBloqueoDeFondo(abierto && esMovil);

    /** Lleva el calendario hasta ese día, si no está a la vista. */
    const mostrar = (iso: string) => {
        const m = mesDe(iso);
        setMesVisible(v => {
            const primero = esMovil ? v : v - 1;
            if (m >= primero && m <= v) return v;
            return Math.min(esMovil ? m : m + 1, mesDeHoy);
        });
    };

    const abrir = () => {
        setDesde(valor.desde);
        setHasta(valor.hasta);
        setEditando('nuevo');
        setSobre(null);
        setMesVisible(Math.min(mesDe(valor.hasta), mesDeHoy));
        setBarrido(b => b + 1);
        setAbierto(true);
    };
    const cerrar = () => { setAbierto(false); setSobre(null); };
    const aplicar = () => {
        if (!desde || !hasta) return;
        onCambiar({ desde, hasta });
        cerrar();
    };

    useEffect(() => {
        if (!abierto) return;
        const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
        // En el teléfono lo cierra el velo de atrás; en escritorio, tocar
        // fuera del panel. Cerrar es cancelar: el borrador se descarta.
        const fuera = (e: MouseEvent) => {
            if (!esMovil && raiz.current && !raiz.current.contains(e.target as Node)) cerrar();
        };
        document.addEventListener('keydown', tecla);
        document.addEventListener('mousedown', fuera);
        return () => {
            document.removeEventListener('keydown', tecla);
            document.removeEventListener('mousedown', fuera);
        };
    }, [abierto, esMovil]);

    const elegirDia = (iso: string) => {
        if (editando === 'hasta' && desde) {
            if (iso < desde) {
                // Antes del inicio: se toma como un inicio nuevo.
                setDesde(iso);
                setHasta(null);
                return;
            }
            setHasta(iso);
            setEditando('nuevo');
            setBarrido(b => b + 1);
            return;
        }
        if (editando === 'desde' && hasta && iso <= hasta) {
            setDesde(iso);
            setEditando('nuevo');
            setBarrido(b => b + 1);
            return;
        }
        setDesde(iso);
        setHasta(null);
        setEditando('hasta');
    };

    const elegirAtajo = (r: Rango) => {
        setDesde(r.desde);
        setHasta(r.hasta);
        setEditando('nuevo');
        setSobre(null);
        setMesVisible(Math.min(mesDe(r.hasta), mesDeHoy));
        setBarrido(b => b + 1);
    };

    // Lo que se pinta: el rango elegido o, mientras falta el fin, lo que
    // quedaría si se tocara el día que está bajo el mouse.
    const puntaA = desde;
    const puntaB = hasta ?? (desde && sobre && sobre >= desde ? sobre : null);
    const completo = !!(desde && hasta);

    const meses = esMovil ? [mesVisible] : [mesVisible - 1, mesVisible];

    // El barrido se mide sobre la parte del rango que está a la vista, no
    // sobre el rango entero: con "2025" elegido se ven noviembre y diciembre,
    // y medido desde el 1 de enero todos esos días llegaban al tope a la vez —
    // la franja aparecía de golpe, sin barrido.
    const primerDiaVisible = `${Math.floor(meses[0] / 12)}-${dos((meses[0] % 12) + 1)}-01`;
    const ultimoMes = meses[meses.length - 1];
    const ultimoDiaVisible = `${Math.floor(ultimoMes / 12)}-${dos((ultimoMes % 12) + 1)}-${dos(ultimoDia(Math.floor(ultimoMes / 12), ultimoMes % 12))}`;
    const inicioBarrido = completo ? (desde! > primerDiaVisible ? desde! : primerDiaVisible) : '';
    const finBarrido = completo ? (hasta! < ultimoDiaVisible ? hasta! : ultimoDiaVisible) : '';
    const pasoMs = completo && inicioBarrido <= finBarrido
        ? Math.max(6, Math.min(26, 560 / (diasEntre(inicioBarrido, finBarrido) + 1)))
        : 0;

    const resumen = useMemo(() => {
        if (!desde) return 'Tocá el día en que empieza.';
        if (!hasta) return 'Ahora tocá el día en que termina.';
        let servicios = 0;
        serviciosPorDia.forEach((n, dia) => { if (dia >= desde && dia <= hasta) servicios += n; });
        const dias = diasEntre(desde, hasta) + 1;
        return `${servicios} ${servicios === 1 ? 'servicio' : 'servicios'} en ${dias} ${dias === 1 ? 'día' : 'días'}`;
    }, [desde, hasta, serviciosPorDia]);

    const atajoActivo = atajos.find(a => a.rango.desde === desde && a.rango.hasta === hasta);

    const mes = (corrido: number, i: number) => {
        const y = Math.floor(corrido / 12);
        const m = corrido % 12;
        const total = ultimoDia(y, m);
        const hueco = (new Date(y, m, 1).getDay() + 6) % 7; // la semana arranca el lunes
        const celdas: (number | null)[] = [
            ...Array(hueco).fill(null),
            ...Array.from({ length: total }, (_, k) => k + 1),
        ];

        const primeroVisible = i === 0;
        const ultimoVisible = i === meses.length - 1;

        return (
            <div key={corrido} className="min-w-0">
                <div className="mb-2 flex h-9 items-center">
                    {primeroVisible ? (
                        <button
                            type="button"
                            onClick={() => setMesVisible(v => v - 1)}
                            aria-label="Mes anterior"
                            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#0a0a0a] transition-colors hover:bg-black/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                        >
                            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
                        </button>
                    ) : <span className="w-9 flex-none" />}
                    <p className="flex-1 text-center text-[13px] font-semibold uppercase tracking-[0.07em] text-[#0a0a0a]">
                        {MESES[m]} {y}
                    </p>
                    {ultimoVisible ? (
                        <button
                            type="button"
                            onClick={() => setMesVisible(v => Math.min(v + 1, mesDeHoy))}
                            disabled={mesVisible >= mesDeHoy}
                            aria-label="Mes siguiente"
                            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[#0a0a0a] transition-colors hover:bg-black/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] disabled:cursor-default disabled:text-black/20 disabled:hover:bg-transparent"
                        >
                            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
                        </button>
                    ) : <span className="w-9 flex-none" />}
                </div>

                <div className="grid grid-cols-7">
                    {DIAS_SEMANA.map(d => (
                        <span key={d} className="pb-1.5 text-center text-[11.5px] font-medium text-black/[.42]">{d}</span>
                    ))}
                    {celdas.map((dia, k) => {
                        if (dia === null) return <span key={`h${k}`} />;
                        const iso = `${y}-${dos(m + 1)}-${dos(dia)}`;
                        const columna = k % 7;
                        const futuro = iso > hoy;
                        const esHoy = iso === hoy;
                        const esIni = iso === puntaA;
                        const esFin = iso === puntaB;
                        const punta = esIni || esFin;
                        const enRango = !!(puntaA && puntaB && iso >= puntaA && iso <= puntaB);
                        // La media franja de una punta une con el día de al lado. Si
                        // la punta abre o cierra una fila, del otro lado no hay
                        // nada que unir y asomaba un muñón gris junto al círculo.
                        const conFranja = enRango && !(esIni && esFin)
                            && !(esFin && (columna === 0 || dia === 1))
                            && !(esIni && (columna === 6 || dia === total));
                        const servicios = serviciosPorDia.get(iso) || 0;
                        const fecha = fechaDeIso(iso);

                        return (
                            <div
                                key={iso}
                                className="relative flex h-[46px] items-center justify-center md:h-11"
                                onMouseEnter={() => { if (!futuro) setSobre(iso); }}
                            >
                                {conFranja && (
                                    <span
                                        aria-hidden
                                        className={[
                                            'rango-anim absolute inset-y-[5px] md:inset-y-1',
                                            (columna === 0 || dia === 1) && !esIni ? 'rounded-l-full' : '',
                                            (columna === 6 || dia === total) && !esFin ? 'rounded-r-full' : '',
                                        ].join(' ')}
                                        style={{
                                            left: esIni ? '50%' : 0,
                                            right: esFin ? '50%' : 0,
                                            background: completo ? '#ecebe7' : '#f3f2ef',
                                            transformOrigin: 'left center',
                                            animation: completo
                                                ? `rango-barrido 240ms cubic-bezier(.2,.7,.3,1) ${Math.max(0, diasEntre(inicioBarrido, iso)) * pasoMs}ms both`
                                                : undefined,
                                        }}
                                    />
                                )}
                                <button
                                    type="button"
                                    disabled={futuro}
                                    onClick={() => elegirDia(iso)}
                                    onFocus={() => setSobre(iso)}
                                    aria-pressed={punta}
                                    aria-label={`${DIAS_LARGOS[fecha.getDay()]} ${dia} de ${MESES[m].toLowerCase()} de ${y}${servicios ? `, ${servicios} ${servicios === 1 ? 'servicio' : 'servicios'}` : ''}`}
                                    className={[
                                        'relative z-[1] flex h-9 w-9 items-center justify-center text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-1',
                                        esHoy && !punta ? 'rounded-[11px] ring-[1.5px] ring-inset ring-black/30' : 'rounded-full',
                                        futuro ? 'cursor-default text-black/25' : punta ? 'text-white' : 'text-[#0a0a0a] hover:bg-black/[.06]',
                                    ].join(' ')}
                                >
                                    {punta && (
                                        <span
                                            key={`${iso}-${barrido}`}
                                            aria-hidden
                                            className="rango-anim absolute inset-0 rounded-full bg-[#0a0a0a]"
                                            style={{ animation: 'rango-punta 280ms cubic-bezier(.2,.7,.3,1) both' }}
                                        />
                                    )}
                                    <span className="relative">{dia}</span>
                                    {servicios > 0 && (
                                        <span
                                            aria-hidden
                                            className="absolute bottom-[4px] left-1/2 h-[4px] w-[4px] -translate-x-1/2 rounded-full"
                                            style={{ background: punta ? '#fff' : '#2563eb' }}
                                        />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const campo = (cual: 'desde' | 'hasta') => {
        const iso = cual === 'desde' ? desde : hasta;
        const activo = cual === 'desde' ? editando !== 'hasta' : editando === 'hasta';
        return (
            <button
                type="button"
                onClick={() => {
                    if (cual === 'desde') {
                        setEditando('desde');
                        if (desde) mostrar(desde);
                    } else if (desde) {
                        setEditando('hasta');
                        mostrar(hasta || desde);
                    }
                }}
                aria-label={cual === 'desde' ? 'Día en que empieza' : 'Día en que termina'}
                className={`flex h-[46px] min-w-0 items-center gap-2 rounded-[14px] px-3.5 text-left text-[14px] font-semibold transition-colors focus-visible:outline-none ${
                    activo ? 'bg-white ring-[1.5px] ring-[#0a0a0a]' : 'bg-[#f2f2f0] hover:bg-[#ebeae6]'
                }`}
            >
                <span className={`min-w-0 flex-1 truncate ${iso ? 'text-[#0a0a0a]' : 'font-medium text-black/[.42]'}`}>
                    {iso ? fechaEnCampo(iso) : cual === 'desde' ? 'Desde…' : 'Hasta…'}
                </span>
                <CalendarDays className="h-4 w-4 flex-none text-black/[.55]" strokeWidth={2} />
            </button>
        );
    };

    const panel = (
        <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5">
                {campo('desde')}
                <ArrowRight className="h-[18px] w-[18px] text-black/[.45]" strokeWidth={2} aria-hidden />
                {campo('hasta')}
            </div>

            <div className="-mx-5 mt-3.5 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
                {atajos.map(a => {
                    const activo = atajoActivo === a;
                    return (
                        <button
                            key={a.etiqueta}
                            type="button"
                            onClick={() => elegirAtajo(a.rango)}
                            aria-pressed={activo}
                            className={`h-8 flex-none rounded-full px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1 ${
                                activo ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-[#0a0a0a] hover:bg-[#e6e5e1]'
                            }`}
                        >
                            {a.etiqueta}
                        </button>
                    );
                })}
            </div>

            <div
                key={barrido}
                className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2"
                onMouseLeave={() => setSobre(null)}
            >
                {meses.map(mes)}
            </div>
        </>
    );

    const pie = (
        <div className="flex items-center gap-3 border-t border-[#ecebe8] px-5 py-3.5">
            <p className="min-w-0 flex-1 text-[12.5px] font-medium text-black/[.58]" aria-live="polite">{resumen}</p>
            <button
                type="button"
                onClick={cerrar}
                className="h-10 flex-none rounded-full px-4 text-[13.5px] font-semibold text-[#0a0a0a] transition-colors hover:bg-black/[.05]"
            >
                Cancelar
            </button>
            <button
                type="button"
                onClick={aplicar}
                disabled={!completo}
                className="h-10 flex-none rounded-full bg-[#0a0a0a] px-5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#242424] disabled:cursor-default disabled:bg-[#c9c8c4]"
            >
                Aplicar
            </button>
        </div>
    );

    return (
        <div ref={raiz} className="relative min-w-0">
            <style>{ESTILOS}</style>
            <button
                type="button"
                onClick={() => (abierto ? cerrar() : abrir())}
                aria-haspopup="dialog"
                aria-expanded={abierto}
                className={`flex h-[42px] w-full items-center gap-2 rounded-full pl-4 pr-3.5 text-left text-[13px] font-semibold text-[#0a0a0a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${
                    abierto ? 'bg-white ring-[1.5px] ring-[#0a0a0a]' : 'bg-[#f2f2f0] hover:bg-[#ebeae6]'
                }`}
            >
                <span className="sr-only">Rango de fechas: </span>
                <span className="min-w-0 flex-1 truncate">{etiquetaDeRango(valor)}</span>
                <CalendarDays className="h-[17px] w-[17px] flex-none text-black/[.62]" strokeWidth={2} aria-hidden />
            </button>

            {abierto && !esMovil && (
                <div
                    role="dialog"
                    aria-label="Elegir el rango de fechas"
                    className="rango-anim absolute left-0 top-[calc(100%+8px)] z-40 w-[min(704px,calc(100vw-32px))] overflow-hidden rounded-[22px] border border-[#ecebe8] bg-white shadow-[0_18px_50px_rgba(0,0,0,.14)]"
                    style={{ animation: 'rango-panel 160ms ease-out both' }}
                >
                    <div className="px-5 pb-4 pt-5">{panel}</div>
                    {pie}
                </div>
            )}

            {abierto && esMovil && (
                <div className="fixed inset-0 z-[120]">
                    <div
                        className="rango-anim absolute inset-0 bg-black/35"
                        style={{ animation: 'rango-velo 180ms ease-out both' }}
                        onClick={cerrar}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Elegir el rango de fechas"
                        className="rango-anim absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[26px] bg-white"
                        style={{ animation: 'rango-hoja 220ms cubic-bezier(.2,.7,.3,1) both' }}
                    >
                        <div className="flex justify-center pb-1 pt-2.5">
                            <span className="h-1 w-10 rounded-full bg-black/[.14]" />
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">
                            <p className="mb-3.5 text-[17px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">Rango de fechas</p>
                            {panel}
                        </div>
                        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>{pie}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SelectorDeRango;
