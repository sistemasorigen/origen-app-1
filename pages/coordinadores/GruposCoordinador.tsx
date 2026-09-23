import React, { useEffect, useMemo, useState } from 'react';
import { dondeSeReune } from '../../src/utils/modalidad';
import { GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    AMBAR_BARRA,
    GrupoConDatos,
    PastillaEstado,
    TarjetaVacia,
    TortaTramos,
    VERDE,
    armarTorta,
    conComa,
    fechaLarga,
    fechasDeEncuentro,
    iniciales,
    leerSenal,
    nombreAnfitrion,
    primeraReunion,
} from './comunes';

/**
 * Grupos de las categorías que coordina.
 *
 * Dos pantallas: el listado y la ficha de un grupo. La ficha es de lectura,
 * salvo por una cosa: sacar a alguien del grupo, que el panel anterior ya
 * permitía y sigue estando acá, ahora con una confirmación en la misma fila
 * en vez de borrar al primer toque.
 *
 * La ficha ya no lleva la tarjeta "Cómo viene" ni su botón de WhatsApp. El
 * diagnóstico de cada grupo sigue estando en el listado (la pastilla sale del
 * mismo `leerSenal`) y los llamados viven en la pestaña de Asistencia, que es
 * donde se decide a quién escribirle.
 *
 * La asistencia de cada miembro se cuenta de verdad, reunión por reunión:
 * un inscripto figura presente si su id está en la fila de esa fecha. Las
 * parejas se cuentan aparte, con el sufijo "-partner", igual que en el
 * reporte de un grupo.
 */

interface Props {
    datos: GrupoConDatos[];
    promedioIglesia: number;
    nombreCategorias: string;
    preseleccionado: string | null;
    onLimpiarPreseleccion: () => void;
    onRefrescar: () => void;
}

/** Alto del área de barras. Fijo, así el eje de fechas queda siempre alineado. */
const ALTO_PISTA = 118;

interface DiaDeEncuentro {
    fecha: string;
    cargada: boolean;
    presentes: number;
    /** Cayó fuera de la grilla semanal: una reunión corrida de día. */
    fueraDeGrilla: boolean;
}

/**
 * La temporada de un grupo, encuentro por encuentro.
 *
 * Equivale a "Un grupo en detalle" de /reportes/gcx, pero acá la altura de
 * cada barra sí significa algo. Allá el gráfico es de UN grupo dentro de un
 * tablero que cuenta grupos, así que cada día vale 0 o 1 y el eje se oculta;
 * en esta ficha tenemos los presentes de cada reunión, y desperdiciar la
 * altura en un sí/no sería tirar el único dato que el coordinador vino a ver.
 *
 * Los colores son los del panel, no los del tablero de reportes: verde es
 * "esto viene bien" y ámbar es "acá hay que llamar a alguien". Un día sin
 * cargar es exactamente lo segundo.
 *
 * Un día sin cargar no se dibuja como barra baja: sería indistinguible de una
 * reunión a la que fue una sola persona. Se dibuja como la columna entera
 * teñida de ámbar — un hueco, no un valor.
 *
 * Reemplaza a "Últimas reuniones", que mostraba lo mismo pero sólo de los seis
 * últimos reportes y sin los días que el grupo dejó pasar — que son justamente
 * los que hay que mirar. El promedio que vivía en aquella tarjeta quedó en el
 * copete de ésta, y los presentes de cada fecha, en el detalle de abajo.
 *
 * Vive en la columna angosta de la ficha, así que la tira de columnas se
 * desliza también en escritorio cuando la temporada es larga. Es el mismo
 * comportamiento que ya tenía en el teléfono.
 */
const LineaDeAsistencia: React.FC<{ dato: GrupoConDatos; inscriptos: number }> = ({ dato, inscriptos }) => {
    const { grupo } = dato;

    const dias = useMemo<DiaDeEncuentro[]>(() => {
        const presentesPorFecha = new Map(dato.reportes.map(r => [r.fecha, r.presentes]));
        const deLaGrilla = fechasDeEncuentro(grupo);
        const enGrilla = new Set(deLaGrilla);

        // Se suman las reuniones cargadas en fechas que no son su día de
        // encuentro: una reunión corrida pasó igual, y esconderla haría que
        // este gráfico contradiga a la lista de reportes de la ficha.
        const corridas = dato.reportes.map(r => r.fecha).filter(f => !enGrilla.has(f));

        return [...deLaGrilla, ...corridas]
            .sort((a, b) => a.localeCompare(b))
            .map(fecha => ({
                fecha,
                cargada: presentesPorFecha.has(fecha),
                presentes: presentesPorFecha.get(fecha) ?? 0,
                fueraDeGrilla: !enGrilla.has(fecha),
            }));
    }, [grupo, dato.reportes]);

    const cargadas = dias.filter(d => d.cargada).length;
    const sinCargar = dias.length - cargadas;

    // Arranca en el último encuentro: es el que al coordinador le importa hoy.
    const [elegida, setElegida] = useState<string | null>(null);
    const activa = dias.find(d => d.fecha === elegida) || dias[dias.length - 1] || null;

    if (dias.length === 0) {
        const primera = primeraReunion(grupo);
        return (
            <div className="rounded-[20px] bg-white px-[22px] py-5">
                <p className="text-[15px] font-semibold text-[#0a0a0a]">Asistencia, reunión por reunión</p>
                <p className="mt-[7px] text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                    {primera
                        ? <>Todavía no tuvo su primer encuentro: se reúne por primera vez el <span className="font-semibold text-[#0a0a0a]">{fechaLarga(primera)}</span>. Desde ese día va a poder cargar asistencia.</>
                        : 'Este grupo no tiene fecha de arranque o día de encuentro cargados, así que no se puede saber qué reuniones le tocaban.'}
                </p>
            </div>
        );
    }

    // La escala es la cantidad de inscriptos: lo mismo contra lo que se mide
    // la asistencia en el resto de la ficha. El máximo real la respalda por si
    // en alguna reunión entró gente que después se dio de baja.
    const tope = Math.max(1, inscriptos, ...dias.map(d => d.presentes));

    return (
        <div className="rounded-[20px] bg-white px-[22px] py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
                <p className="text-[15px] font-semibold text-[#0a0a0a]">Asistencia, reunión por reunión</p>
                <div className="flex items-center gap-3.5">
                    {([['Presentes', VERDE], ['Sin cargar', AMBAR_BARRA]] as const).map(([texto, color]) => (
                        <span key={texto} className="flex items-center gap-[7px]">
                            <span className="h-[9px] w-[9px] flex-none rounded-[2px]" style={{ background: color }} />
                            <span className="text-[12px] font-semibold text-black/[.62]">{texto}</span>
                        </span>
                    ))}
                </div>
            </div>

            <p className="mt-[5px] text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                Cada columna es un día en el que le tocaba reunirse; la altura es cuánta gente fue, sobre{' '}
                {inscriptos} {inscriptos === 1 ? 'inscripto' : 'inscriptos'}.{' '}
                {cargadas === 0
                    ? 'Nunca cargó una asistencia.'
                    : <>Cargó {cargadas} {cargadas === 1 ? 'reunión' : 'reuniones'}{sinCargar > 0 ? ` y le ${sinCargar === 1 ? 'falta' : 'faltan'} ${sinCargar}` : ', sin dejar ninguna afuera'}. Promedia {conComa(dato.promedio)} presentes.</>}
            </p>

            {/* En el teléfono la temporada entera no entra: se desliza en vez
                de apretar veinte columnas en trescientos píxeles. */}
            <div className="mt-5 -mx-1 overflow-x-auto px-1 pb-1">
                <div className="flex min-w-full items-stretch gap-1">
                    {dias.map(d => {
                        const esActiva = activa?.fecha === d.fecha;
                        const alto = d.cargada ? Math.max(3, Math.round((d.presentes / tope) * ALTO_PISTA)) : 0;
                        return (
                            <button
                                key={d.fecha}
                                onClick={() => setElegida(d.fecha)}
                                aria-pressed={esActiva}
                                aria-label={`${fechaLarga(d.fecha)}: ${d.cargada ? `${d.presentes} de ${inscriptos} presentes` : 'sin cargar'}`}
                                className="group flex min-w-[30px] flex-1 flex-col items-center gap-[7px] rounded-[7px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                <span
                                    className="flex w-full items-end overflow-hidden rounded-[5px] transition-colors"
                                    style={{
                                        height: ALTO_PISTA,
                                        background: d.cargada ? '#f4f3f1' : '#fbf0dd',
                                        boxShadow: esActiva ? 'inset 0 0 0 1.5px rgba(10,10,10,.34)' : undefined,
                                    }}
                                >
                                    {d.cargada && (
                                        <span
                                            className="block w-full rounded-[5px]"
                                            style={{ height: alto, background: VERDE, opacity: esActiva ? 1 : 0.88 }}
                                        />
                                    )}
                                </span>
                                <span className={`text-[10px] font-semibold tabular-nums ${esActiva ? 'text-[#0a0a0a]' : 'text-black/[.45]'}`}>
                                    {new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Alto fijo: el detalle cambia al tocar una columna y no tiene que
                mover el resto de la ficha cada vez. */}
            {activa && (
                <div className="mt-4 flex min-h-[54px] flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[16px] bg-[#f7f7f5] px-4 py-3">
                    <span className="text-[13px] font-semibold capitalize text-[#0a0a0a]">{fechaLarga(activa.fecha)}</span>
                    <span className="text-[12.5px] font-medium text-black/[.66]">
                        {activa.cargada
                            ? `${activa.presentes} ${activa.presentes === 1 ? 'presente' : 'presentes'} de ${inscriptos}`
                            : 'Sin cargar — no sabemos si se reunieron'}
                    </span>
                    {activa.fueraDeGrilla && (
                        <span className="text-[12px] font-semibold text-black/[.5]">
                            · Reunión corrida de día
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * Cuántas veces vino cada inscripto a ESTE grupo.
 *
 * Es la torta "Asistencia de personas" de /reportes/gcx, que mira a toda la
 * iglesia, recortada a un solo grupo. Los tramos son los mismos y en el mismo
 * orden, así un coordinador que mira los dos tableros lee lo mismo: "a todas"
 * es haber estado en todas las reuniones que el grupo cargó, no en todas las
 * que le tocaban — a las que no cargó nadie les falta el dato, no la gente.
 *
 * Sin ninguna reunión cargada no se dibuja la torta. Saldría 0% con todo el
 * anillo en "Ninguna", que se lee como "no viene nadie" cuando lo que pasa es
 * que no sabemos: es la diferencia entre un cero y un dato que falta.
 */
const AsistenciaDePersonas: React.FC<{
    personas: { presentes: number }[];
    reuniones: number;
}> = ({ personas, reuniones }) => {
    const torta = useMemo(() => armarTorta(personas.map(p => ({
        veces: p.presentes,
        completo: reuniones > 0 && p.presentes >= reuniones,
    }))), [personas, reuniones]);

    if (torta.total === 0) return null;

    if (reuniones === 0) {
        return (
            <div className="rounded-[20px] bg-white px-[22px] py-5">
                <p className="text-[15px] font-semibold text-[#0a0a0a]">Asistencia de personas</p>
                <p className="mt-[7px] text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                    Todavía no cargó ninguna reunión, así que no se sabe quién está viniendo. No es que no venga
                    nadie: falta el dato.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-[20px] bg-white px-[22px] py-5">
            <p className="text-[15px] font-semibold text-[#0a0a0a]">Asistencia de personas</p>
            <p className="mt-[5px] text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                Cuántas veces vino cada inscripto, sobre las {reuniones}{' '}
                {reuniones === 1 ? 'reunión cargada' : 'reuniones cargadas'}.
            </p>
            <div className="mt-5">
                <TortaTramos {...torta} etiqueta="asiste" rotuloBase="Personas" />
            </div>
        </div>
    );
};

const GruposCoordinador: React.FC<Props> = ({
    datos,
    promedioIglesia,
    nombreCategorias,
    preseleccionado,
    onLimpiarPreseleccion,
    onRefrescar,
}) => {
    const [busqueda, setBusqueda] = useState('');
    const [abiertoId, setAbiertoId] = useState<string | null>(null);
    const [aviso, setAviso] = useState('');

    // Llegar desde una alerta de Inicio o desde el calendario abre la ficha
    // directamente.
    useEffect(() => {
        if (!preseleccionado) return;
        const encontrado = datos.find(d => d.grupo.id === preseleccionado);
        if (encontrado) setAbiertoId(encontrado.grupo.id);
        onLimpiarPreseleccion();
    }, [preseleccionado, datos, onLimpiarPreseleccion]);

    // `datos` ya viene recortado al año y la temporada elegidos arriba: el
    // viejo "Activos / Finalizados" quedó dentro de ese filtro. Cada grupo
    // sigue diciendo en su pastilla si está activo o finalizado.
    const delFiltro = datos;

    const listados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return delFiltro;
        return delFiltro.filter(d =>
            (d.grupo.name || '').toLowerCase().includes(q) ||
            nombreAnfitrion(d.grupo).toLowerCase().includes(q)
        );
    }, [delFiltro, busqueda]);

    const abierto = useMemo(() => datos.find(d => d.grupo.id === abiertoId) || null, [datos, abiertoId]);

    if (abierto) {
        return (
            <FichaGrupo
                dato={abierto}
                onVolver={() => setAbiertoId(null)}
                onRefrescar={onRefrescar}
                aviso={aviso}
                setAviso={setAviso}
            />
        );
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-[42px] w-full min-w-0 items-center gap-2.5 rounded-full bg-white pl-[17px] pr-2 md:w-auto md:min-w-[260px] md:flex-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.58)" strokeWidth={2.2} strokeLinecap="round" className="flex-none">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l4 4" />
                    </svg>
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por grupo o anfitrión"
                        className="campo-desnudo min-w-0 flex-1 text-[13.5px] font-medium text-[#0a0a0a]"
                    />
                    {busqueda && (
                        <button
                            onClick={() => setBusqueda('')}
                            aria-label="Limpiar la búsqueda"
                            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#f2f2f0]"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth={2.4} strokeLinecap="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <p className="mx-0.5 mt-3.5 text-[12px] font-semibold text-black/[.62]">
                {listados.length} de {delFiltro.length} grupos de tus categorías en esta temporada
            </p>

            {listados.length === 0 ? (
                <div className="mt-3">
                    <TarjetaVacia
                        titulo={delFiltro.length === 0 ? 'No hay grupos en esta temporada' : 'Ningún grupo coincide'}
                        texto={delFiltro.length === 0
                            ? `Probá con otro año o temporada arriba para ver los grupos de ${nombreCategorias || 'tus categorías'}.`
                            : `Recordá que solo ves los grupos de tus categorías: ${nombreCategorias}.`}
                    >
                        {busqueda && (
                            <button
                                onClick={() => setBusqueda('')}
                                className="mt-[18px] h-[46px] rounded-full bg-[#f2f2f0] px-[22px] text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Limpiar la búsqueda
                            </button>
                        )}
                    </TarjetaVacia>
                </div>
            ) : (
                <div className="mt-3 grid gap-3 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                    {listados.map(d => (
                        <TarjetaGrupo
                            key={d.grupo.id}
                            dato={d}
                            promedioIglesia={promedioIglesia}
                            onAbrir={() => setAbiertoId(d.grupo.id)}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

// ── Tarjeta del listado ───────────────

const TarjetaGrupo: React.FC<{
    dato: GrupoConDatos;
    promedioIglesia: number;
    onAbrir: () => void;
}> = ({ dato, promedioIglesia, onAbrir }) => {
    const [fotoRota, setFotoRota] = useState(false);
    const { grupo, finalizado } = dato;
    const senal = leerSenal(dato, promedioIglesia);
    const anfitrion = nombreAnfitrion(grupo);
    const pct = dato.capacidad > 0 ? Math.min(100, Math.round((dato.ocupados / dato.capacidad) * 100)) : 0;
    const donde = dondeSeReune(grupo, 'Online');

    return (
        <button
            onClick={onAbrir}
            className="block w-full min-w-0 rounded-[20px] bg-white px-[18px] py-4 text-left transition-shadow hover:shadow-[0_2px_14px_rgba(0,0,0,.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
        >
            <div className="flex items-start gap-3">
                <div
                    className={`relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[14px] bg-[#f2f2f0] text-[12.5px] font-semibold text-black/[.58] ${finalizado ? 'grayscale' : ''}`}
                >
                    {iniciales(grupo.name || '')}
                    {grupo.imageUrl && !fotoRota && (
                        <img
                            src={grupo.imageUrl}
                            alt=""
                            onError={() => setFotoRota(true)}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-semibold ${finalizado ? 'text-black/[.6]' : 'text-[#0a0a0a]'}`}>
                        {grupo.name || 'Sin nombre'}
                    </p>
                    <p className="mt-[3px] truncate text-[12.5px] font-medium text-black/[.62]">{dato.categoria}</p>
                </div>
                <PastillaEstado finalizado={finalizado} estado={grupo.status} />
            </div>

            <p className="mt-3 truncate text-[13px] font-medium text-black/[.66]">{anfitrion}</p>
            <p className="mt-1 truncate text-[13px] font-medium text-black/[.66]">
                {grupo.meetingDay} {grupo.meetingTime} · {donde}
            </p>

            <div className="mt-3 flex items-center gap-[11px]">
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                    <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct}%`, background: finalizado ? '#c9c8c4' : '#0a0a0a' }}
                    />
                </span>
                <span className="whitespace-nowrap text-[12.5px] font-semibold text-black/[.66]">
                    {dato.ocupados}/{dato.capacidad || '—'}
                </span>
            </div>

            <p
                className="mt-3 border-t border-[#f4f3f1] pt-[11px] text-[12px] font-semibold"
                style={{ color: senal.tono === 'verde' ? '#0b7a53' : '#7a4f10' }}
            >
                {senal.texto}
            </p>
        </button>
    );
};

// ── Ficha de un grupo ─────────────────

const FichaGrupo: React.FC<{
    dato: GrupoConDatos;
    onVolver: () => void;
    onRefrescar: () => void;
    aviso: string;
    setAviso: (v: string) => void;
}> = ({ dato, onVolver, onRefrescar, aviso, setAviso }) => {
    const { grupo, finalizado } = dato;
    const [busquedaMiembro, setBusquedaMiembro] = useState('');
    const [porQuitar, setPorQuitar] = useState<string | null>(null);
    const [quitando, setQuitando] = useState<string | null>(null);
    const [fotoRota, setFotoRota] = useState(false);
    // En el teléfono la ficha entera empuja la asistencia fuera de la pantalla,
    // y la asistencia es a lo que el coordinador viene. Los datos del grupo se
    // guardan detrás de "Más información"; en escritorio siguen siempre a la
    // vista, que ahí van en su propia columna y no estorban.
    const [verFicha, setVerFicha] = useState(false);

    const anfitrion = nombreAnfitrion(grupo);
    const donde = dondeSeReune(grupo, 'Online');

    // Cada inscripción aprobada son una o dos personas. La asistencia se
    // cuenta por persona, con el mismo id que guarda group_attendance.
    const personas = useMemo(() => {
        const reuniones = dato.reportes.length;
        const presentesDe = (id: string) => dato.reportes.filter(r => r.ids.includes(id)).length;

        const lista: {
            claveFila: string;
            registro: GroupRegistration;
            nombre: string;
            esPareja: boolean;
            pendiente: boolean;
            presentes: number;
            reuniones: number;
        }[] = [];

        (grupo.registrations || []).forEach(r => {
            const pendiente = r.status === 'PENDING';
            if (r.status === 'REJECTED') return;

            lista.push({
                claveFila: r.id,
                registro: r,
                nombre: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Sin nombre',
                esPareja: false,
                pendiente,
                presentes: presentesDe(String(r.id)),
                reuniones,
            });

            if (r.partnerData) {
                lista.push({
                    claveFila: `${r.id}-partner`,
                    registro: r,
                    nombre: `${r.partnerData.firstName || ''} ${r.partnerData.lastName || ''}`.trim() || 'Su pareja',
                    esPareja: true,
                    pendiente,
                    presentes: presentesDe(`${r.id}-partner`),
                    reuniones,
                });
            }
        });

        return lista.sort((a, b) => b.presentes - a.presentes);
    }, [grupo.registrations, dato.reportes]);

    const miembros = useMemo(() => {
        const q = busquedaMiembro.trim().toLowerCase();
        if (!q) return personas;
        return personas.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.registro.email || '').toLowerCase().includes(q)
        );
    }, [personas, busquedaMiembro]);

    const quitar = async (registro: GroupRegistration) => {
        setQuitando(registro.id);
        setAviso('');
        try {
            const ok = await supabaseService.deleteGroupRegistration(registro.id, grupo.id);
            if (ok) {
                setPorQuitar(null);
                setAviso(`${registro.firstName} salió del grupo.`);
                onRefrescar();
            } else {
                setAviso('No se pudo sacar a esa persona. Probá de nuevo en un momento.');
            }
        } catch (error) {
            console.error('[Coordinadores] Error quitando inscripción:', error);
            setAviso('No se pudo sacar a esa persona. Probá de nuevo en un momento.');
        } finally {
            setQuitando(null);
        }
    };

    const fila = (etiqueta: string, valor: string) => (
        <div className="flex items-center justify-between gap-3.5 border-b border-[#f4f3f1] py-[11px] last:border-b-0">
            <span className="flex-none text-[12.5px] font-medium text-black/[.62]">{etiqueta}</span>
            <span className="text-right text-[12.5px] font-semibold text-[#0a0a0a]">{valor}</span>
        </div>
    );

    return (
        <>
            <button
                onClick={onVolver}
                className="flex h-9 items-center gap-[7px] rounded-full bg-white pl-[11px] pr-3.5 text-[12.5px] font-semibold text-black/[.64] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 6l-6 6 6 6" />
                </svg>
                Todos los grupos
            </button>

            {aviso && (
                <p className="mt-3 rounded-[16px] bg-white px-4 py-3 text-[13px] font-medium text-[#0a0a0a]">{aviso}</p>
            )}

            <div className="mt-3 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1.4fr)_minmax(0,1fr)]">

                {/* Ficha */}
                <div className="min-w-0 overflow-hidden rounded-[20px] bg-white">
                    <div className="flex h-[130px] items-center justify-center bg-[#f2f2f0] md:h-[170px]">
                        {grupo.imageUrl && !fotoRota ? (
                            <img
                                src={grupo.imageUrl}
                                alt={`Portada de ${grupo.name}`}
                                onError={() => setFotoRota(true)}
                                className={`h-full w-full object-cover ${finalizado ? 'grayscale' : ''}`}
                            />
                        ) : (
                            <span className="text-[12px] font-medium text-black/[.5]">Sin foto cargada</span>
                        )}
                    </div>
                    <div className="px-[22px] py-5">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-[20px] font-semibold tracking-[-0.018em] text-[#0a0a0a]">
                                {grupo.name || 'Sin nombre'}
                            </h2>
                            <PastillaEstado finalizado={finalizado} estado={grupo.status} />
                        </div>

                        <button
                            onClick={() => setVerFicha(v => !v)}
                            aria-expanded={verFicha}
                            aria-controls="ficha-del-grupo"
                            className="mt-4 flex h-[42px] w-full items-center justify-between gap-3 rounded-full bg-[#f7f7f5] pl-[18px] pr-[15px] text-[13px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:hidden"
                        >
                            {verFicha ? 'Menos información' : 'Más información'}
                            <svg
                                width="15" height="15" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                                className={`flex-none transition-transform ${verFicha ? '-rotate-180' : ''}`}
                                aria-hidden="true"
                            >
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                        </button>

                        <div id="ficha-del-grupo" className={`${verFicha ? '' : 'hidden'} md:block`}>
                            <div className="mt-4">
                                {fila('Anfitrión', anfitrion)}
                                {fila('Día y horario', `${grupo.meetingDay || '—'} ${grupo.meetingTime || ''}`.trim())}
                                {fila('Ubicación', donde)}
                                {fila('Categoría', dato.categoria)}
                                {fila('Cupo', dato.capacidad ? `${dato.ocupados} de ${dato.capacidad} lugares` : `${dato.ocupados} inscriptos`)}
                                {fila('Bajas', dato.bajas === 0 ? 'Ninguna' : `${dato.bajas} en la temporada`)}
                                {fila('Reuniones reportadas', dato.reportes.length === 0 ? 'Ninguna' : String(dato.reportes.length))}
                            </div>

                            {grupo.description && (
                                <p className="mt-4 border-t border-[#f0efec] pt-3.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                                    {grupo.description}
                                </p>
                            )}

                            <p className="mt-4 border-t border-[#f0efec] pt-3.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                                Como coordinador podés mirar y acompañar. Editar la ficha o aprobar inscripciones le
                                corresponde al anfitrión.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Asistencia + miembros */}
                <div className="flex min-w-0 flex-col gap-3.5">
                    <LineaDeAsistencia dato={dato} inscriptos={personas.length} />

                    {/* Las dos caras de la misma asistencia: arriba, reunión
                        por reunión; acá, persona por persona. Va justo antes
                        de la lista porque es el resumen de esa lista. */}
                    <AsistenciaDePersonas personas={personas} reuniones={dato.reportes.length} />

                    <div className="rounded-[20px] bg-white px-[22px] py-5">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <p className="min-w-[110px] flex-1 text-[15px] font-semibold text-[#0a0a0a]">
                                Miembros
                                <span className="ml-2 text-[12.5px] font-medium text-black/[.62]">{personas.length}</span>
                            </p>
                            {personas.length > 6 && (
                                <div className="flex h-[38px] w-full items-center gap-2 rounded-full bg-[#f7f7f5] px-3.5 md:w-[180px]">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.58)" strokeWidth={2.2} strokeLinecap="round" className="flex-none">
                                        <circle cx="11" cy="11" r="6.5" />
                                        <path d="M16 16l4 4" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={busquedaMiembro}
                                        onChange={e => setBusquedaMiembro(e.target.value)}
                                        placeholder="Buscar"
                                        className="campo-desnudo min-w-0 flex-1 text-[13px] font-medium text-[#0a0a0a]"
                                    />
                                </div>
                            )}
                        </div>

                        {dato.reportes.length > 0 && (
                            <p className="mt-2 text-[12px] font-medium text-black/[.58]">
                                Asistencia sobre {dato.reportes.length} {dato.reportes.length === 1 ? 'reunión reportada' : 'reuniones reportadas'}.
                            </p>
                        )}

                        <div className="mt-4 flex flex-col gap-3">
                            {miembros.length === 0 ? (
                                <p className="py-6 text-center text-[13px] font-medium text-black/[.6]">
                                    {personas.length === 0 ? 'Todavía no hay nadie inscripto.' : 'Nadie coincide con esa búsqueda.'}
                                </p>
                            ) : (
                                miembros.map(p => (
                                    <div key={p.claveFila} className="flex items-center gap-[11px]">
                                        <div className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11.5px] font-semibold ${p.esPareja ? 'bg-[#fbeef4] text-[#9d1d5c]' : 'bg-[#f2f2f0] text-black/[.6]'}`}>
                                            {iniciales(p.nombre)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium text-black/[.8]">{p.nombre}</p>
                                            {(p.esPareja || p.pendiente) && (
                                                <p className="mt-[2px] text-[11.5px] font-semibold text-black/[.58]">
                                                    {[p.esPareja ? 'Pareja' : '', p.pendiente ? 'Pendiente de aprobar' : ''].filter(Boolean).join(' · ')}
                                                </p>
                                            )}
                                        </div>

                                        {porQuitar === p.claveFila ? (
                                            <div className="flex flex-none items-center gap-1.5">
                                                <button
                                                    onClick={() => quitar(p.registro)}
                                                    disabled={quitando === p.registro.id}
                                                    className="h-8 rounded-full bg-[#fdecea] px-3 text-[12px] font-semibold text-[#a32218] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                >
                                                    {quitando === p.registro.id ? 'Sacando…' : 'Sacar'}
                                                </button>
                                                <button
                                                    onClick={() => setPorQuitar(null)}
                                                    className="h-8 rounded-full bg-[#f2f2f0] px-3 text-[12px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="flex-none whitespace-nowrap text-[12px] font-semibold text-black/[.62]">
                                                    {dato.reportes.length > 0 ? `${p.presentes}/${p.reuniones}` : 'Sin datos'}
                                                </span>
                                                <button
                                                    onClick={() => { setPorQuitar(p.claveFila); setAviso(''); }}
                                                    aria-label={`Sacar a ${p.nombre} del grupo`}
                                                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-black/[.45] transition-colors hover:bg-[#fdecea] hover:text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                                                        <path d="M6 6l12 12M18 6L6 18" />
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {porQuitar && (
                            <p className="mt-4 rounded-[16px] bg-[#fdfaf4] px-4 py-3 text-[12.5px] font-medium leading-[1.55] text-black/[.66]">
                                Sacar a alguien borra su inscripción del grupo. No se le avisa por mail y no se puede
                                deshacer desde acá.
                            </p>
                        )}
                    </div>

                </div>
            </div>
        </>
    );
};

export default GruposCoordinador;
