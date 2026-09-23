import React, { useMemo, useState } from 'react';
import { DropoutRequest, ModalidadGrupo } from '../../types';
import { MODALIDADES, NOMBRE_MODALIDAD, modalidadDe } from '../../src/utils/modalidad';
import {
    GrupoConDatos,
    Segmentado,
    Rotulo,
    TortaDeTramos,
    TortaTramos,
    armarTorta,
    conComa,
    estaAprobado,
    fechasDeEncuentro,
    iniciales,
    personasDeInscripcion,
    yaArranco,
} from './comunes';

/**
 * Inicio del panel de coordinación.
 *
 * Arranca por la única pregunta que un coordinador se hace cada semana: a
 * quién llamar. Los números vienen después, y el gráfico al final, porque
 * sirven para entender, no para decidir.
 *
 * El feed de actividad del panel anterior se conserva abajo: es el registro
 * de quién entró y quién se dio de baja, y ninguna de las tarjetas nuevas lo
 * reemplaza.
 */

interface Props {
    datos: GrupoConDatos[];
    dropouts: DropoutRequest[];
    promedioIglesia: number;
    onAbrirGrupo: (groupId: string) => void;
    onVerAsistencia: () => void;
}

const POR_PAGINA = 20;

const PLURAL_MODALIDAD: Record<ModalidadGrupo, string> = {
    presencial: 'presenciales',
    online: 'online',
    hibrido: 'híbridos',
};

/**
 * Cuántas veces vino cada persona de estos grupos.
 *
 * Es la torta "Asistencia de personas" de /reportes/gcx recortada a las
 * categorías del coordinador. Una persona cuenta UNA vez aunque esté en dos
 * de sus grupos: se la identifica por su cuenta, o por su mail si no tiene,
 * y sus veces se suman entre todos sus grupos. Sin ese cuidado, quien está en
 * dos grupos pesaría el doble en la torta.
 *
 * Un grupo que nunca cargó nada no le suma "posibles" a su gente, pero sí les
 * marca `sinCarga`: son personas de las que no sabemos nada, y no pueden caer
 * en "A todas" por no tener ninguna reunión en contra.
 */
const tortaDePersonas = (grupos: GrupoConDatos[]): TortaDeTramos => {
    const porPersona = new Map<string, { veces: number; posibles: number; sinCarga: boolean }>();

    grupos.forEach(d => {
        const cargadas = d.reportes.length;

        const vecesPorId = new Map<string, number>();
        d.reportes.forEach(r => r.ids.forEach(id => {
            const clave = String(id);
            vecesPorId.set(clave, (vecesPorId.get(clave) || 0) + 1);
        }));

        (d.grupo.registrations || []).forEach(r => {
            // Sólo aprobadas, la misma base que el indicador "Inscriptos" y
            // que el tablero de reportes: así el total de esta torta y el de
            // la tarjeta hablan de la misma gente.
            if (r.status !== 'APPROVED') return;

            personasDeInscripcion(r).forEach(({ clave, id }) => {
                const acc = porPersona.get(clave) || { veces: 0, posibles: 0, sinCarga: false };
                if (cargadas > 0) {
                    acc.veces += vecesPorId.get(id) || 0;
                    acc.posibles += cargadas;
                } else {
                    acc.sinCarga = true;
                }
                porPersona.set(clave, acc);
            });
        });
    });

    return armarTorta([...porPersona.values()].map(p => ({
        veces: p.veces,
        completo: !p.sinCarga && p.posibles > 0 && p.veces >= p.posibles,
    })));
};

/**
 * Cuántas de sus reuniones cargó cada grupo.
 *
 * "A todas" es no haberse salteado ninguna de las fechas que le tocaban según
 * su día de encuentro. Se mira el hueco, no el total: un grupo que corrió una
 * reunión de día tiene la misma cantidad de cargas que fechas, y comparando
 * totales figuraría al día con una fecha sin cargar a la vista.
 */
const tortaDeGrupos = (grupos: GrupoConDatos[]): TortaDeTramos => armarTorta(grupos.map(d => {
    const cargadas = new Set(d.reportes.map(r => r.fecha));
    const faltan = fechasDeEncuentro(d.grupo).filter(f => !cargadas.has(f)).length;
    return { veces: cargadas.size, completo: cargadas.size > 0 && faltan === 0 };
}));

const InicioCoordinador: React.FC<Props> = ({ datos, dropouts, promedioIglesia, onAbrirGrupo, onVerAsistencia }) => {
    const [metrica, setMetrica] = useState<'inscriptos' | 'bajas'>('inscriptos');
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);

    // `datos` ya viene recortado al año y la temporada elegidos arriba: los
    // indicadores y el gráfico hablan de todos esos grupos. "En curso" son
    // los que ya arrancaron y todavía no terminaron, y sólo con ellos tiene
    // sentido decidir a quién llamar: en una temporada pasada o por arrancar
    // esa tarjeta no aparece.
    const enCurso = useMemo(() => datos.filter(d => !d.finalizado && yaArranco(d.grupo) && estaAprobado(d.grupo)), [datos]);
    // Los cuatro grupos de la tarjeta "Grupos" no se pisan entre sí, así la
    // línea de abajo da siempre el total: sin aprobar primero, y el resto
    // repartido entre por arrancar, en curso y finalizados.
    const sinAprobar = useMemo(() => datos.filter(d => !estaAprobado(d.grupo)), [datos]);
    const porArrancar = useMemo(() => datos.filter(d => estaAprobado(d.grupo) && !yaArranco(d.grupo)), [datos]);
    const finalizados = useMemo(() => datos.filter(d => estaAprobado(d.grupo) && d.finalizado), [datos]);
    // Un grupo que no arrancó no "falta reportar": no tuvo reuniones. Uno sin
    // aprobar tampoco: no puede cargarlas aunque quiera.
    const sinReportar = useMemo(() => datos.filter(d => !d.reporta && yaArranco(d.grupo) && estaAprobado(d.grupo)), [datos]);
    const conReporte = useMemo(() => datos.filter(d => d.reporta), [datos]);

    // "Inscriptos" cuenta PERSONAS, con la misma identidad que "Personas
    // únicas" de /reportes/gcx: quien está en dos de sus grupos es una sola
    // persona. Por eso no es la suma de las barras de abajo — cada barra
    // cuenta a esa persona en su grupo — y `repetidos` lo dice en la tarjeta
    // en vez de dejar la diferencia sin explicar.
    const { inscriptos, repetidos } = useMemo(() => {
        const veces = new Map<string, number>();
        datos.forEach(d => d.personas.forEach(clave => veces.set(clave, (veces.get(clave) || 0) + 1)));
        let enVarios = 0;
        veces.forEach(v => { if (v > 1) enVarios += 1; });
        return { inscriptos: veces.size, repetidos: enVarios };
    }, [datos]);

    const promedio = conReporte.length
        ? conReporte.reduce((s, d) => s + d.promedio, 0) / conReporte.length
        : 0;
    const delta = promedio - promedioIglesia;

    // ── A quién llamar ────────────────
    // Se ordena por gravedad y, dentro de la misma gravedad, por tamaño: un
    // grupo de doce que dejó de reportar deja a más gente sin seguimiento
    // que uno de cuatro.
    const { alertas, necesitanLlamada } = useMemo(() => {
        const puntaje = (d: GrupoConDatos) => {
            if (!d.reporta) return 3;
            if (promedioIglesia > 0 && d.promedio < promedioIglesia) return 2;
            if (d.bajas >= 3) return 1;
            return 0;
        };

        const marcados = enCurso
            .map(d => ({ d, p: puntaje(d) }))
            .filter(x => x.p > 0)
            .sort((a, b) => (b.p - a.p) || (b.d.personas.length - a.d.personas.length));

        // Se nombran tres: una lista de veinte no es una lista de llamados,
        // es otra tabla. El total va en el título y el resto, en Asistencia.
        return {
            necesitanLlamada: marcados.length,
            alertas: marcados.slice(0, 3).map(({ d, p }) => ({
                id: d.grupo.id,
                grupo: d.grupo.name || 'Sin nombre',
                motivo: p === 3
                    ? (d.bajas > 0
                        ? `${d.bajas} ${d.bajas === 1 ? 'baja' : 'bajas'} y nunca reportó`
                        : 'Nunca cargó asistencia')
                    : p === 2
                        ? `Promedio ${conComa(d.promedio)} · por debajo de ${conComa(promedioIglesia)}`
                        : `${d.bajas} bajas en la temporada`,
            })),
        };
    }, [enCurso, promedioIglesia]);

    const resumenAlerta = useMemo(() => {
        const partes: string[] = [];
        const sinReportarEnCurso = enCurso.filter(d => !d.reporta).length;
        if (sinReportarEnCurso > 0) {
            partes.push(`${sinReportarEnCurso === 1 ? 'Uno nunca cargó' : `${sinReportarEnCurso} nunca cargaron`} asistencia`);
        }
        const bajos = enCurso.filter(d => d.reporta && promedioIglesia > 0 && d.promedio < promedioIglesia).length;
        if (bajos > 0) {
            partes.push(`${bajos === 1 ? 'uno viene' : `${bajos} vienen`} por debajo de ${conComa(promedioIglesia)} personas por reunión`);
        }
        const sanos = enCurso.length - sinReportarEnCurso - bajos;
        const cola = sanos > 0 ? ` El resto está funcionando bien.` : '';
        return partes.length ? `${partes.join(' y ')}.${cola}` : '';
    }, [enCurso, promedioIglesia]);

    // ── Gráfico ───────────────────────
    const barras = useMemo(() => {
        const valor = (d: GrupoConDatos) => metrica === 'inscriptos' ? d.personas.length : d.bajas;
        const maximo = Math.max(1, ...datos.map(valor));
        return [...datos]
            .sort((a, b) => valor(b) - valor(a))
            .map(d => {
                const v = valor(d);
                const alerta = metrica === 'bajas' ? v >= 3 : v <= 5;
                return {
                    id: d.grupo.id,
                    nombre: d.grupo.name || 'Sin nombre',
                    valor: v,
                    pct: Math.round((v / maximo) * 100),
                    color: alerta ? '#e8b96a' : '#0b7a53',
                };
            });
    }, [datos, metrica]);

    // ── Las tortas de la temporada ────
    // Miran los grupos que YA ARRANCARON, finalizados incluidos. Los que
    // todavía no tuvieron su primer encuentro no tienen asistencia que medir:
    // contarlos hundiría las tres tortas al abrir una temporada por empezar.
    // Los que esperan aprobación tampoco: no pueden cargar una reunión, así
    // que figurarían como grupos que nunca reportaron.
    const conArranque = useMemo(() => datos.filter(d => yaArranco(d.grupo) && estaAprobado(d.grupo)), [datos]);

    const personasTemporada = useMemo(() => tortaDePersonas(conArranque), [conArranque]);
    const gruposTemporada = useMemo(() => tortaDeGrupos(conArranque), [conArranque]);

    const porModalidad = useMemo(() => MODALIDADES.map(m => {
        const suyos = conArranque.filter(d => modalidadDe(d.grupo) === m);
        return {
            modalidad: m,
            cantidad: suyos.length,
            personas: tortaDePersonas(suyos),
        };
    }), [conArranque]);

    // ── Últimos movimientos ───────────
    const movimientos = useMemo(() => {
        const items: {
            id: string;
            persona: string;
            accion: string;
            grupo: string;
            fecha: string;
            tipo: 'baja' | 'alta';
        }[] = [];

        dropouts.forEach(d => {
            items.push({
                id: `baja-${d.id}`,
                persona: d.targetUserName || 'Miembro',
                accion: d.requestType === 'SELF_DROPOUT' ? 'Se dio de baja' : 'Baja pedida por el anfitrión',
                grupo: d.groupName || 'Grupo desconocido',
                fecha: d.createdAt,
                tipo: 'baja',
            });
        });

        datos.forEach(({ grupo }) => {
            (grupo.registrations || []).forEach(r => {
                if (r.status !== 'APPROVED') return;
                items.push({
                    id: `alta-${r.id}`,
                    persona: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Sin nombre',
                    accion: 'Se inscribió',
                    grupo: grupo.name || 'Sin nombre',
                    fecha: r.createdAt || r.timestamp || '',
                    tipo: 'alta',
                });
            });
        });

        items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        const q = busqueda.trim().toLowerCase();
        return q
            ? items.filter(i => i.persona.toLowerCase().includes(q) || i.grupo.toLowerCase().includes(q))
            : items;
    }, [dropouts, datos, busqueda]);

    const paginas = Math.max(1, Math.ceil(movimientos.length / POR_PAGINA));
    const paginaActual = Math.min(pagina, paginas);
    const visibles = movimientos.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

    const cuandoFue = (iso: string) => {
        if (!iso) return '';
        const fecha = new Date(iso);
        if (isNaN(fecha.getTime())) return '';
        const horas = Math.floor((Date.now() - fecha.getTime()) / 3600000);
        if (horas < 1) return 'Recién';
        if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
        const dias = Math.floor(horas / 24);
        if (dias === 1) return 'Ayer';
        if (dias < 30) return `Hace ${dias} días`;
        return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    };

    return (
        <>
            {/* A quién llamar */}
            {alertas.length > 0 && (
                <div className="mb-3.5 rounded-[20px] bg-[#0a0a0a] px-[22px] py-5">
                    <div className="flex flex-wrap items-start gap-[18px]">
                        <div className="min-w-[220px] flex-1">
                            <Rotulo className="text-white/[.55]">A quién llamar esta semana</Rotulo>
                            <p className="mt-[11px] text-[19px] font-semibold leading-[1.35] tracking-[-0.018em] text-white md:text-[21px]">
                                {necesitanLlamada === 1
                                    ? 'Uno de tus grupos necesita una llamada'
                                    : `${necesitanLlamada} de tus ${enCurso.length} grupos en curso necesitan una llamada`}
                            </p>
                            {resumenAlerta && (
                                <p className="mt-2.5 text-[13.5px] font-medium leading-[1.65] text-white/70">{resumenAlerta}</p>
                            )}
                        </div>
                        <div className="flex min-w-[230px] flex-1 flex-col gap-2">
                            {alertas.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => onAbrirGrupo(a.id)}
                                    className="flex w-full items-center gap-[11px] rounded-[14px] bg-white/[.08] px-3.5 py-3 text-left transition-colors hover:bg-white/[.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    <span className="h-2 w-2 flex-none rounded-full bg-[#e8b96a]" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13.5px] font-semibold text-white">{a.grupo}</span>
                                        <span className="mt-[3px] block text-[12px] font-medium text-white/[.62]">{a.motivo}</span>
                                    </span>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                                        <path d="M9 6l6 6-6 6" />
                                    </svg>
                                </button>
                            ))}
                            {necesitanLlamada > alertas.length && (
                                <button
                                    onClick={onVerAsistencia}
                                    className="self-start rounded-full px-1 text-[12.5px] font-semibold text-white/[.62] underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                >
                                    Ver los otros {necesitanLlamada - alertas.length} en Asistencia
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Indicadores */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="min-w-0 rounded-[18px] bg-white px-[18px] py-4">
                    <p className="text-[12.5px] font-semibold text-black/[.62]">Grupos</p>
                    <p className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#0a0a0a]">{datos.length}</p>
                    <p className="mt-2 text-[12px] font-medium text-black/[.62]">
                        {[
                            enCurso.length > 0 && `${enCurso.length} ${enCurso.length === 1 ? 'activo' : 'activos'}`,
                            porArrancar.length > 0 && `${porArrancar.length} por arrancar`,
                            finalizados.length > 0 && `${finalizados.length} ${finalizados.length === 1 ? 'finalizado' : 'finalizados'}`,
                            sinAprobar.length > 0 && `${sinAprobar.length} sin aprobar`,
                        ].filter(Boolean).join(' · ') || 'Sin grupos'}
                    </p>
                </div>

                <div className="min-w-0 rounded-[18px] bg-white px-[18px] py-4">
                    <p className="text-[12.5px] font-semibold text-black/[.62]">Inscriptos</p>
                    <p className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#0a0a0a]">{inscriptos}</p>
                    <p className="mt-2 text-[12px] font-medium text-black/[.62]">
                        {dropouts.length} {dropouts.length === 1 ? 'baja' : 'bajas'} en la temporada
                    </p>
                    {repetidos > 0 && (
                        <p className="mt-1 text-[12px] font-medium text-black/[.5]">
                            {repetidos === 1 ? 'Una persona está' : `${repetidos} personas están`} en más de un grupo y {repetidos === 1 ? 'cuenta' : 'cuentan'} una vez
                        </p>
                    )}
                </div>

                <div className="min-w-0 rounded-[18px] bg-white px-[18px] py-4">
                    <p className="text-[12.5px] font-semibold text-black/[.62]">Presentes por reunión</p>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-[30px] font-semibold tracking-[-0.03em] text-[#0a0a0a]">
                            {conComa(promedio)}
                        </span>
                        {promedioIglesia > 0 && conReporte.length > 0 && (
                            <span className={`text-[12.5px] font-semibold ${delta < 0 ? 'text-[#7a4f10]' : 'text-[#0b7a53]'}`}>
                                {delta >= 0 ? '+' : '−'}{conComa(Math.abs(delta))}
                            </span>
                        )}
                    </div>
                    <p className="mt-2 text-[12px] font-medium text-black/[.62]">
                        {promedioIglesia > 0
                            ? `Promedio de la iglesia: ${conComa(promedioIglesia)}`
                            : 'Todavía no hay asistencia cargada'}
                    </p>
                </div>

                <button
                    onClick={onVerAsistencia}
                    className="min-w-0 rounded-[18px] bg-white px-[18px] py-4 text-left shadow-[inset_0_0_0_1.5px_#f0d9b4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <p className="text-[12.5px] font-semibold text-black/[.62]">Sin reportar</p>
                    <p className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#7a4f10]">{sinReportar.length}</p>
                    <p className="mt-2 text-[12px] font-medium text-black/[.62]">grupos sin asistencia cargada</p>
                </button>
            </div>

            {/* ── La temporada en tortas ──────────────────────────────────
                Las mismas dos de /reportes/gcx, recortadas a sus categorías.
                A lo ancho hasta xl: cada una necesita el anillo y cinco
                renglones de leyenda al lado, y partirlas antes las apreta. */}
            <div className="mt-3.5 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:repeat(2,minmax(0,1fr))]">
                <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
                    <p className="text-[15px] font-semibold text-[#0a0a0a]">Asistencia de personas</p>
                    <p className="mt-[5px] text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                        Qué parte de tus inscriptos está asistiendo.
                    </p>
                    {personasTemporada.total === 0 ? (
                        <p className="mt-5 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                            Todavía no hay gente inscripta en grupos que hayan arrancado.
                        </p>
                    ) : (
                        <>
                            <div className="mt-5">
                                <TortaTramos {...personasTemporada} etiqueta="asiste" rotuloBase="Personas" lado />
                            </div>
                            <p className="mt-[18px] border-t border-[#f0efec] pt-3.5 text-[12px] font-medium leading-[1.55] text-black/[.62]">
                                Sobre las {personasTemporada.total} personas inscriptas en{' '}
                                {conArranque.length === 1 ? 'tu grupo ya arrancado' : `tus ${conArranque.length} grupos ya arrancados`}.
                                Cada persona cuenta una vez aunque esté en más de uno, y sus veces son las reuniones
                                cargadas a las que fue, sumando todos sus grupos. Quien fue a todas las de sus grupos
                                cuenta en “A todas” aunque hayan sido pocas.
                                {porArrancar.length > 0 && ` Los ${porArrancar.length} que todavía no arrancaron no entran: no hay asistencia que medir.`}
                            </p>
                        </>
                    )}
                </div>

                <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
                    <p className="text-[15px] font-semibold text-[#0a0a0a]">Reporte de asistencia</p>
                    <p className="mt-[5px] text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                        Cuántos de tus grupos reportan asistencias.
                    </p>
                    {gruposTemporada.total === 0 ? (
                        <p className="mt-5 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                            Ninguno de tus grupos arrancó todavía en esta temporada.
                        </p>
                    ) : (
                        <>
                            <div className="mt-5">
                                <TortaTramos {...gruposTemporada} etiqueta="reporta" rotuloBase="Grupos" lado />
                            </div>
                            <p className="mt-[18px] border-t border-[#f0efec] pt-3.5 text-[12px] font-medium leading-[1.55] text-black/[.62]">
                                Sobre {gruposTemporada.total === 1 ? 'tu grupo ya arrancado' : `tus ${gruposTemporada.total} grupos ya arrancados`}.
                                Las veces son los días con asistencia cargada. “A todas” es el grupo que no se salteó
                                ninguna de las fechas que le tocaban según su día de encuentro, aunque hayan sido pocas.
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* ── Por modalidad ───────────────────────────────────────────
                Quién está asistiendo, partido en presencial, online e
                híbrido. El "Reporte de asistencia" no se repite acá: es el
                mismo de la tarjeta de arriba y bajaba tres veces seguidas
                diciendo casi lo mismo. Una modalidad sin grupos ocupa un
                renglón, no un anillo vacío — mismo criterio que
                /reportes/gcx. */}
            <div className="mt-6">
                <Rotulo className="mx-0.5 text-black/[.5]">Por modalidad</Rotulo>
                <div className="mt-2.5 flex flex-col gap-3.5">
                    {porModalidad.map(m => (
                        <div key={m.modalidad} className="rounded-[20px] bg-white px-[22px] py-5">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <p className="text-[15px] font-semibold text-[#0a0a0a]">
                                    {NOMBRE_MODALIDAD[m.modalidad]}
                                </p>
                                <p className="text-[12.5px] font-medium text-black/[.62]">
                                    {m.cantidad === 0
                                        ? `Sin grupos ${PLURAL_MODALIDAD[m.modalidad]} en esta temporada`
                                        : `${m.cantidad} ${m.cantidad === 1 ? 'grupo' : 'grupos'} · ${m.personas.total} ${m.personas.total === 1 ? 'persona' : 'personas'}`}
                                </p>
                            </div>

                            {m.cantidad > 0 && (
                                <div className="mt-5">
                                    <Rotulo className="mb-3 text-black/[.5]">Asistencia de personas</Rotulo>
                                    <TortaTramos {...m.personas} etiqueta="asiste" rotuloBase="Personas" lado />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Gráfico por grupo */}
            <div className="mt-3.5 rounded-[20px] bg-white px-[22px] py-5">
                <div className="flex flex-wrap items-center gap-3">
                    <p className="min-w-[150px] flex-1 text-[15px] font-semibold text-[#0a0a0a]">
                        {metrica === 'inscriptos' ? 'Inscriptos' : 'Bajas'} por grupo
                    </p>
                    <Segmentado
                        valor={metrica}
                        onChange={v => setMetrica(v as 'inscriptos' | 'bajas')}
                        opciones={[
                            { valor: 'inscriptos', label: 'Inscriptos' },
                            { valor: 'bajas', label: 'Bajas' },
                        ]}
                    />
                </div>

                {barras.length === 0 ? (
                    <p className="mt-5 text-[13.5px] font-medium text-black/[.62]">
                        No hay grupos de tus categorías en esta temporada.
                    </p>
                ) : (
                    <>
                        <div className="mt-5 flex flex-col gap-2.5">
                            {barras.map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => onAbrirGrupo(b.id)}
                                    className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                >
                                    <span className="w-24 flex-none truncate text-[12.5px] font-medium text-black/[.66] md:w-[180px]">
                                        {b.nombre}
                                    </span>
                                    <span className="h-[26px] min-w-0 flex-1 overflow-hidden rounded-lg bg-[#f7f7f5]">
                                        <span
                                            className="block h-full rounded-lg"
                                            style={{ width: `${b.pct}%`, background: b.color }}
                                        />
                                    </span>
                                    <span className="w-[34px] flex-none text-right text-[12.5px] font-semibold text-[#0a0a0a]">
                                        {b.valor}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <p className="mt-[18px] border-t border-[#f0efec] pt-3.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                            {metrica === 'inscriptos'
                                ? 'En ámbar los grupos con 5 inscriptos o menos: son los que más riesgo tienen de apagarse.'
                                : 'En ámbar los grupos con 3 bajas o más en la temporada.'}
                        </p>
                    </>
                )}
            </div>

            {/* Últimos movimientos */}
            <div className="mt-3.5 overflow-hidden rounded-[20px] bg-white">
                <div className="flex flex-wrap items-center gap-3 border-b border-[#f0efec] px-5 py-4">
                    <div className="min-w-[150px] flex-1">
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">Últimos movimientos</p>
                        <p className="mt-[5px] text-[12.5px] font-medium text-black/[.62]">
                            Quién se inscribió y quién se dio de baja en tus grupos.
                        </p>
                    </div>
                    <div className="flex h-[42px] w-full items-center gap-2.5 rounded-full bg-[#f7f7f5] pl-[17px] pr-2 md:w-[260px]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.58)" strokeWidth={2.2} strokeLinecap="round" className="flex-none">
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="M16 16l4 4" />
                        </svg>
                        <input
                            type="text"
                            value={busqueda}
                            onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                            placeholder="Buscar persona o grupo"
                            className="campo-desnudo min-w-0 flex-1 text-[13.5px] font-medium text-[#0a0a0a]"
                        />
                        {busqueda && (
                            <button
                                onClick={() => { setBusqueda(''); setPagina(1); }}
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

                {visibles.length === 0 ? (
                    <p className="px-5 py-12 text-center text-[13.5px] font-medium text-black/[.6]">
                        {busqueda ? 'Ningún movimiento coincide con esa búsqueda.' : 'Todavía no hubo movimientos en tus grupos.'}
                    </p>
                ) : (
                    visibles.map(m => (
                        <div key={m.id} className="flex items-center gap-3 border-b border-[#f4f3f1] px-5 py-3.5 last:border-b-0">
                            <div className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11.5px] font-semibold ${m.tipo === 'alta' ? 'bg-[#e7f5ee] text-[#0b7a53]' : 'bg-[#fdf3e3] text-[#7a4f10]'}`}>
                                {iniciales(m.persona)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">{m.persona}</p>
                                <p className="mt-[3px] truncate text-[12px] font-medium text-black/[.62]">
                                    {m.accion} · {m.grupo}
                                </p>
                            </div>
                            <span className="flex-none whitespace-nowrap text-[12px] font-medium text-black/[.58]">
                                {cuandoFue(m.fecha)}
                            </span>
                        </div>
                    ))
                )}

                {paginas > 1 && (
                    <div className="flex items-center justify-between gap-3 border-t border-[#f0efec] px-5 py-3.5">
                        <button
                            onClick={() => setPagina(p => Math.max(1, p - 1))}
                            disabled={paginaActual === 1}
                            className="h-[38px] rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                        >
                            Anteriores
                        </button>
                        <span className="text-[12px] font-semibold text-black/[.58]">
                            {paginaActual} de {paginas}
                        </span>
                        <button
                            onClick={() => setPagina(p => Math.min(paginas, p + 1))}
                            disabled={paginaActual === paginas}
                            className="h-[38px] rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                        >
                            Siguientes
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default InicioCoordinador;
