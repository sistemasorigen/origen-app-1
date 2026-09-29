import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Pencil } from 'lucide-react';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    AREAS_VOLUNTARIOS, CAMPOS_MARTES, CAMPOS_NINEZ, CAMPOS_SEGUIMIENTO,
    aFecha, anioDe, buscarAnioAnterior, calcStats, fechaCorta, fechaLarga, fmt, horarioDe,
} from './datosDeAudiencia';

/**
 * Detalle de un servicio — design-claude/Audiencia - Detalle de Servicio.
 *
 * Antes esto era un modal encima de la planilla, y la comparación contra el
 * año anterior era un segundo modal aparte. Los dos mostraban la misma
 * información partida en dos y ninguno se podía compartir por link.
 *
 * Ahora es una página con su propia dirección: /audiencia-servicios/detalles/:id.
 * Se carga la lista completa de servicios —la misma consulta que usa la
 * planilla— porque con ella se resuelven de una sola vez las tres cosas que
 * esta pantalla necesita: el servicio pedido, con cuál del año pasado se
 * compara, y cuáles son el anterior y el siguiente para poder ir pasando.
 */

interface Props { currentUser: User | null; }

const tarjeta = 'rounded-[14px] border border-[#e8e9ec] bg-white';
const titulito = 'text-[15px] font-semibold text-[#0f172a]';
const subtitulito = 'mt-1 text-[12.5px] font-medium text-[#6b7280]';
const rotulo = 'text-[12px] font-semibold text-[#6b7280]';

const AudienciaServicioDetalle: React.FC<Props> = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [registros, setRegistros] = useState<any[]>([]);
    const [cargando, setCargando] = useState(true);

    const cargar = useCallback(async () => {
        setCargando(true);
        const data = await supabaseService.getServiceStatistics();
        setRegistros(data);
        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    /** Más nuevo primero, igual que la planilla, para que pasar de uno a otro siga el mismo orden. */
    const ordenados = useMemo(
        () => [...registros].sort((a, b) => {
            const d = aFecha(b.service_date).getTime() - aFecha(a.service_date).getTime();
            return d !== 0 ? d : horarioDe(a).localeCompare(horarioDe(b));
        }),
        [registros]
    );

    const indice = ordenados.findIndex(r => String(r.id) === String(id));
    const rec = indice >= 0 ? ordenados[indice] : null;
    const masViejo = indice >= 0 && indice < ordenados.length - 1 ? ordenados[indice + 1] : null;
    const masNuevo = indice > 0 ? ordenados[indice - 1] : null;

    const comparable = useMemo(
        () => (rec ? buscarAnioAnterior(rec, registros) : null),
        [rec, registros]
    );

    if (cargando) {
        return (
            <div id="audiencia-servicios" className="flex min-h-screen items-center justify-center bg-[#f7f8fa]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-[#0a0a0a]" />
                    <p className="text-[13px] font-medium text-[#6b7280]">Buscando el servicio…</p>
                </div>
            </div>
        );
    }

    if (!rec) {
        return (
            <div id="audiencia-servicios" className="min-h-screen bg-[#f7f8fa] px-4 py-16">
                <div className={`mx-auto max-w-[460px] ${tarjeta} p-8 text-center`}>
                    <p className="text-[19px] font-semibold text-[#0a0a0a]">Este servicio ya no está</p>
                    <p className="mx-auto mt-2.5 max-w-[340px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">
                        Puede que lo hayan borrado, o que el link apunte a un registro que nunca existió.
                    </p>
                    <button
                        onClick={() => navigate('/audiencia-servicios')}
                        className="mt-6 h-12 rounded-full bg-[#0a0a0a] px-6 text-[14.5px] font-semibold text-white"
                    >
                        Volver a la planilla
                    </button>
                </div>
            </div>
        );
    }

    const s = calcStats(rec);
    const prev = comparable?.registro || null;
    const sPrev = prev ? calcStats(prev) : null;
    const anio = anioDe(rec);
    const horario = horarioDe(rec);

    const delta = sPrev && sPrev.totalFinalConOnline > 0
        ? Math.round((s.totalFinalConOnline / sPrev.totalFinalConOnline - 1) * 100)
        : null;
    const deltaInk = delta === null ? '#6b7280' : delta >= 0 ? '#12783f' : '#b42318';
    const deltaTxt = delta === null ? '—' : (delta > 0 ? '+' : '') + delta + '%';

    const pAud = s.totalFinalConOnline > 0 ? (s.totalFinal / s.totalFinalConOnline) * 100 : 0;
    const pOn = s.totalFinalConOnline > 0 ? (s.online / s.totalFinalConOnline) * 100 : 0;

    const areas = AREAS_VOLUNTARIOS
        .map(a => ({ ...a, n: Number(rec[a.key]) || 0 }))
        .filter(a => a.n > 0)
        .sort((a, b) => b.n - a.n);
    const maxArea = Math.max(1, ...areas.map(a => a.n));
    const areasVacias = AREAS_VOLUNTARIOS.length - areas.length;

    const ninez = CAMPOS_NINEZ.map(f => ({ ...f, n: Number(rec[f.key]) || 0 }));
    const seguimiento = CAMPOS_SEGUIMIENTO.map(f => ({ ...f, n: Number(rec[f.key]) || 0 }));
    const martes = CAMPOS_MARTES.map(f => ({ ...f, n: Number(rec[f.key]) || 0 }));

    /**
     * Un martes no carga auditorio, niñez ni online: sólo podcast y oración.
     * Con la pantalla armada para la asistencia quedaba un cero gigante, dos
     * anillos en 0% y una comparación de cero contra cero — todo afirmando que
     * no vino nadie, cuando lo que pasa es que eso no se mide. Cuando no hay
     * asistencia, la pantalla muestra lo que sí se midió y esconde el resto.
     */
    const sinAsistencia = s.totalFinalConOnline === 0;
    const hayMartes = !sinAsistencia && martes.some(f => f.n > 0);
    const sesiones: { name: string; attendees: number }[] = rec.conference_sessions || [];

    /** Una fila de comparación: dos barras a la misma escala, este año arriba. */
    const filaYoY = (metrica: string, act: number, ant: number, cAct: string, cAnt: string) => {
        const max = Math.max(1, act, ant);
        const d = ant > 0 ? Math.round((act / ant - 1) * 100) : null;
        return {
            metrica, act, ant, cAct, cAnt,
            wAct: (act / max) * 100,
            wAnt: (ant / max) * 100,
            delta: d === null ? '—' : (d > 0 ? '+' : '') + d + '%',
            ink: d === null ? '#6b7280' : d >= 0 ? '#12783f' : '#b42318',
        };
    };

    const filas = !sPrev ? [] : s.totalFinalConOnline === 0 ? CAMPOS_MARTES.map(f =>
        filaYoY(f.label, Number(rec[f.key]) || 0, Number(prev[f.key]) || 0, '#0f172a', '#cfd4dc')
    ) : [
        filaYoY('Presencial', s.totalFinal, sPrev.totalFinal, '#2563eb', '#bcd0f7'),
        filaYoY('Online', s.online, sPrev.online, '#a48ce8', '#ddd3f6'),
        filaYoY('Voluntarios', s.totalVol, sPrev.totalVol, '#0f172a', '#cfd4dc'),
    ];

    /** Los dos anillos: el corte se dibuja con un conic-gradient y el centro lo tapa un círculo del color del fondo. */
    const anillos = [
        {
            titulo: 'Presencial y online',
            centro: Math.round(s.pctOnline) + '%',
            conic: `conic-gradient(#a48ce8 0 ${s.pctOnline.toFixed(1)}%, #2563eb ${s.pctOnline.toFixed(1)}% 100%)`,
            texto: `${fmt(s.online)} online de ${fmt(s.totalFinalConOnline)}.`
                + (sPrev ? ` En ${anio - 1} fue ${Math.round(sPrev.pctOnline)}%.` : ''),
        },
        {
            titulo: 'Voluntarios y público',
            centro: Math.round(s.pctVol) + '%',
            conic: `conic-gradient(#0f172a 0 ${s.pctVol.toFixed(1)}%, #d7dbe2 ${s.pctVol.toFixed(1)}% 100%)`,
            texto: `${fmt(s.totalVol)} sirviendo sobre ${fmt(s.audNinezSinProfes)} presentes.`
                + (sPrev ? ` En ${anio - 1} fue ${Math.round(sPrev.pctVol)}%.` : ''),
        },
    ];

    const irA = (destino: any) => navigate(`/audiencia-servicios/detalles/${destino.id}`);

    return (
        <div id="audiencia-servicios" className="min-h-screen bg-[#f7f8fa] pb-14">

            {/* ── Encabezado ── */}
            <div className="border-b border-[#e8e9ec] bg-white">
                <div className="mx-auto max-w-[1360px] px-4 pb-4 pt-3 md:px-7 md:pb-5 md:pt-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={() => navigate('/audiencia-servicios')}
                            className="flex h-[38px] flex-none items-center gap-1.5 rounded-full border border-[#e8e9ec] bg-white pl-2.5 pr-3.5 text-[12.5px] font-semibold text-[#374151] transition-colors hover:bg-[#f7f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <ArrowLeft className="h-[15px] w-[15px]" strokeWidth={2.3} />
                            <span className="hidden sm:inline">Ir a la planilla</span>
                            <span className="sm:hidden">Planilla</span>
                        </button>

                        {/* Miga de pan: sólo en escritorio, donde hay lugar sin empujar los botones. */}
                        <div className="hidden items-center gap-2 md:flex">
                            <span className="text-[12.5px] font-medium text-[#9ca3af]">Audiencia de Servicios</span>
                            <span className="text-[12.5px] font-medium text-[#c3c7ce]">/</span>
                            <span className="text-[12.5px] font-semibold text-[#0f172a]">{fechaCorta(rec.service_date)}</span>
                        </div>

                        <div className="ml-auto flex flex-none items-center gap-1.5">
                            <button
                                onClick={() => masViejo && irA(masViejo)}
                                disabled={!masViejo}
                                title={masViejo ? `Ir a ${fechaCorta(masViejo.service_date)}` : 'No hay uno más viejo'}
                                aria-label="Servicio anterior"
                                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#e8e9ec] bg-white text-[#374151] transition-colors hover:bg-[#f7f8fa] disabled:opacity-35 disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={2.3} />
                            </button>
                            <button
                                onClick={() => masNuevo && irA(masNuevo)}
                                disabled={!masNuevo}
                                title={masNuevo ? `Ir a ${fechaCorta(masNuevo.service_date)}` : 'Este es el más reciente'}
                                aria-label="Servicio siguiente"
                                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-[#e8e9ec] bg-white text-[#374151] transition-colors hover:bg-[#f7f8fa] disabled:opacity-35 disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                <ChevronRight className="h-[15px] w-[15px]" strokeWidth={2.3} />
                            </button>
                            <button
                                onClick={() => navigate('/audiencia-servicios/new', { state: { record: rec } })}
                                className="flex h-[38px] items-center gap-1.5 rounded-full bg-[#0a0a0a] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                <Pencil className="h-[14px] w-[14px]" strokeWidth={2.2} />
                                Editar
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 md:mt-[18px]">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-6 items-center rounded-md bg-[#eaf0fc] px-2.5 text-[11.5px] font-semibold text-[#1d4ed8]">
                                {rec.category || 'Sin categoría'}{horario ? ` · ${horario}` : ''}
                            </span>
                            {rec.service_type && (
                                <span className="flex h-6 items-center rounded-md bg-[#f2f2f0] px-2.5 text-[11.5px] font-semibold text-black/[.6]">
                                    {rec.service_type}
                                </span>
                            )}
                            {rec.name && (
                                <span className="text-[12.5px] font-medium text-[#6b7280]">{rec.name}</span>
                            )}
                        </div>
                        <h1 className="mt-2.5 text-[21px] font-semibold tracking-[-0.02em] text-[#0f172a] md:text-[26px]">
                            {fechaLarga(rec.service_date)}
                        </h1>
                    </div>
                </div>
            </div>

            {/* ── Cuerpo ── */}
            <div className="mx-auto max-w-[1360px] px-4 pt-3.5 md:px-7 md:pt-5">

                {/* El número grande: todo el mundo que estuvo, en el edificio o en casa. */}
                <div className={`${tarjeta} p-[18px] md:px-6 md:py-[22px]`}>
                    {sinAsistencia ? (
                        <>
                            <p className={rotulo}>Lo que se midió</p>
                            <div className="mt-2 flex flex-wrap gap-8">
                                {martes.map(f => (
                                    <div key={f.key}>
                                        <p className="text-[36px] font-semibold leading-none tracking-[-0.035em] text-[#0f172a]">
                                            {fmt(f.n)}
                                        </p>
                                        <p className="mt-1.5 text-[12.5px] font-medium text-[#6b7280]">{f.label}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-[12.5px] font-medium leading-[1.55] text-[#6b7280]">
                                Este servicio no carga auditorio, niñez ni online, así que no entra en los
                                promedios ni en la tendencia de la planilla.
                            </p>
                        </>
                    ) : (
                    <div className="flex flex-wrap items-end gap-[18px]">
                        <div className="min-w-[200px] flex-1">
                            <p className={rotulo}>Total con online</p>
                            <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
                                <span className="text-[36px] font-semibold leading-none tracking-[-0.035em] text-[#0f172a] md:text-[44px]">
                                    {fmt(s.totalFinalConOnline)}
                                </span>
                                {prev && delta !== null && (
                                    <span className="text-[14px] font-semibold" style={{ color: deltaInk }}>
                                        {deltaTxt} vs. {anio - 1}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-7">
                            <div>
                                <p className={rotulo}>Presencial</p>
                                <p className="mt-1 text-[18px] font-semibold text-[#0f172a]">{fmt(s.totalFinal)}</p>
                            </div>
                            <div>
                                <p className={rotulo}>Online</p>
                                <p className="mt-1 text-[18px] font-semibold text-[#0f172a]">{fmt(s.online)}</p>
                            </div>
                            <div>
                                <p className={rotulo}>Voluntarios</p>
                                <p className="mt-1 text-[18px] font-semibold text-[#0f172a]">{Math.round(s.pctVol)}%</p>
                            </div>
                        </div>
                    <div className="mt-[18px] flex h-2 overflow-hidden rounded-full bg-[#f2f3f5]">
                        <span className="block bg-[#2563eb]" style={{ width: `${pAud}%` }} />
                        <span className="block bg-[#a48ce8]" style={{ width: `${pOn}%` }} />
                    </div>
                    </div>
                    )}
                </div>

                <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">

                    {/* ── Contra el año anterior ── */}
                    <div className={`${tarjeta} min-w-0 p-[18px] md:px-[22px] md:py-5`}>
                        <div className="flex flex-wrap items-start gap-3">
                            <div className="min-w-[180px] flex-1">
                                <p className={titulito}>Contra el mismo servicio de {anio - 1}</p>
                                <p className={subtitulito}>
                                    {prev
                                        ? `${fechaCorta(prev.service_date)} de ${anio - 1} · ${comparable?.criterio}`
                                        : 'Todavía sin par para comparar'}
                                </p>
                            </div>
                            {prev && !sinAsistencia && (
                                <div className="text-right">
                                    <p className="text-[30px] font-semibold leading-none tracking-[-0.03em]" style={{ color: deltaInk }}>
                                        {deltaTxt}
                                    </p>
                                    <p className="mt-1 text-[11.5px] font-medium text-[#6b7280]">en el total</p>
                                </div>
                            )}
                        </div>

                        {/* Los anillos se muestran igual sin par: el reparto de este servicio
                            se sostiene solo, y sólo la frase de abajo pierde la mitad. Lo que no
                            se dibuja es un anillo de un servicio que no mide asistencia: serían
                            dos ruedas en 0%. */}
                        {!sinAsistencia && (
                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                            {anillos.map(a => (
                                <div key={a.titulo} className="flex items-center gap-4 rounded-xl bg-[#f7f8fa] p-4">
                                    <div
                                        className="flex h-[88px] w-[88px] flex-none items-center justify-center rounded-full"
                                        style={{ background: a.conic }}
                                    >
                                        <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#f7f8fa] text-[15px] font-semibold text-[#0f172a]">
                                            {a.centro}
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[12.5px] font-semibold text-[#0f172a]">{a.titulo}</p>
                                        <p className="mt-1.5 text-[12px] font-medium leading-[1.5] text-[#6b7280]">{a.texto}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        )}

                        {prev ? (
                            <div className="mt-[22px] flex flex-col gap-4">
                                {filas.map(f => (
                                    <div key={f.metrica}>
                                        <div className="flex items-baseline justify-between gap-2.5">
                                            <span className="text-[12.5px] font-semibold text-[#374151]">{f.metrica}</span>
                                            <span className="text-[12.5px] font-semibold" style={{ color: f.ink }}>{f.delta}</span>
                                        </div>
                                        <div className="mt-[7px] flex items-center gap-2.5">
                                            <span className="w-9 flex-none text-[11px] font-semibold text-[#0f172a]">{anio}</span>
                                            <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-[5px] bg-[#f2f3f5]">
                                                <div className="h-full rounded-[5px]" style={{ width: `${f.wAct}%`, background: f.cAct }} />
                                            </div>
                                            <span className="w-[52px] flex-none text-right text-[12.5px] font-semibold text-[#0f172a]">{fmt(f.act)}</span>
                                        </div>
                                        <div className="mt-[5px] flex items-center gap-2.5">
                                            <span className="w-9 flex-none text-[11px] font-semibold text-[#9ca3af]">{anio - 1}</span>
                                            <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-[5px] bg-[#f2f3f5]">
                                                <div className="h-full rounded-[5px]" style={{ width: `${f.wAnt}%`, background: f.cAnt }} />
                                            </div>
                                            <span className="w-[52px] flex-none text-right text-[12.5px] font-semibold text-[#6b7280]">{fmt(f.ant)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-[18px] rounded-xl bg-[#f7f8fa] px-4 py-3.5">
                                <p className="text-[12.5px] font-medium leading-[1.55] text-[#4b5563]">
                                    No hay un servicio equivalente cargado en {anio - 1}. La comparación aparece
                                    sola cuando existen los dos.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ── Columna derecha ── */}
                    <div className="flex min-w-0 flex-col gap-3.5">

                        <div className={`${tarjeta} p-[18px] md:px-[22px] md:py-5`}>
                            <p className={titulito}>Observaciones</p>
                            <p
                                className="mt-2.5 whitespace-pre-line text-[13.5px] font-medium leading-[1.6]"
                                style={{ color: rec.observations ? '#374151' : '#9ca3af' }}
                            >
                                {rec.observations || 'No se cargaron observaciones para este servicio.'}
                            </p>
                        </div>

                        {areas.length > 0 && (
                            <div className={`${tarjeta} p-[18px] md:px-[22px] md:py-5`}>
                                <div className="flex items-baseline justify-between gap-2.5">
                                    <p className={titulito}>Voluntarios por área</p>
                                    <span className="text-[12.5px] font-semibold text-[#0f172a]">
                                        {fmt(s.volUnicos)} {s.volUnicos === 1 ? 'persona' : 'personas'}
                                    </span>
                                </div>
                                <p className={subtitulito}>
                                    {fmt(s.totalVol)} cargados en {areas.length} {areas.length === 1 ? 'área' : 'áreas'}
                                    {s.repetidos > 0
                                        ? `, ${fmt(s.repetidos)} ${s.repetidos === 1 ? 'sirvió' : 'sirvieron'} en dos`
                                        : ''}
                                    {areasVacias > 0 ? ` · ${areasVacias} sin nadie` : ''}
                                </p>
                                <div className="mt-4 flex flex-col gap-2.5">
                                    {areas.map(a => (
                                        <div key={a.key} className="flex items-center gap-2.5">
                                            <span className="w-[104px] flex-none truncate text-[12.5px] font-medium text-[#374151]" title={a.label}>
                                                {a.label}
                                            </span>
                                            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded bg-[#f2f3f5]">
                                                <div className="h-full rounded bg-[#0f172a]" style={{ width: `${(a.n / maxArea) * 100}%` }} />
                                            </div>
                                            <span className="w-7 flex-none text-right text-[12.5px] font-semibold text-[#0f172a]">{a.n}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Niñez y seguimiento no están en el diseño, pero son datos que se
                            cargan y que el detalle viejo mostraba: se quedan, en la misma
                            forma de tarjeta, para no perderlos en el camino. */}
                        {s.ninezSinProfes > 0 && (
                            <div className={`${tarjeta} p-[18px] md:px-[22px] md:py-5`}>
                                <div className="flex items-baseline justify-between gap-2.5">
                                    <p className={titulito}>Niñez</p>
                                    <span className="text-[12.5px] font-semibold text-[#0f172a]">{fmt(s.ninezSinProfes)}</span>
                                </div>
                                <p className={subtitulito}>Sin contar a los profes, que van como voluntarios.</p>
                                <div className="mt-3.5 grid grid-cols-2 gap-x-5">
                                    {ninez.map(f => (
                                        <div key={f.key} className="flex items-center justify-between border-b border-[#f2f3f5] py-1.5">
                                            <span className="text-[12.5px] font-medium text-[#6b7280]">{f.label}</span>
                                            <span className="text-[12.5px] font-semibold text-[#0f172a]">{f.n}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {hayMartes && (
                            <div className={`${tarjeta} p-[18px] md:px-[22px] md:py-5`}>
                                <p className={titulito}>Martes</p>
                                <div className="mt-3.5 grid grid-cols-2 gap-x-5">
                                    {martes.map(f => (
                                        <div key={f.key} className="flex items-center justify-between border-b border-[#f2f3f5] py-1.5">
                                            <span className="text-[12.5px] font-medium text-[#6b7280]">{f.label}</span>
                                            <span className="text-[12.5px] font-semibold text-[#0f172a]">{f.n}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {seguimiento.some(f => f.n > 0) && (
                            <div className={`${tarjeta} p-[18px] md:px-[22px] md:py-5`}>
                                <p className={titulito}>Seguimiento</p>
                                <div className="mt-3.5 flex flex-col">
                                    {seguimiento.map(f => (
                                        <div key={f.key} className="flex items-center justify-between border-b border-[#f2f3f5] py-2">
                                            <span className="text-[12.5px] font-medium text-[#6b7280]">{f.label}</span>
                                            <span className="text-[12.5px] font-semibold text-[#0f172a]">{f.n}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {sesiones.length > 0 && (
                            <div className={`${tarjeta} p-[18px] md:px-[22px] md:py-5`}>
                                <p className={titulito}>Sesiones especiales</p>
                                <div className="mt-3.5 flex flex-col">
                                    {sesiones.map((ses, i) => (
                                        <div key={`${ses.name}-${i}`} className="flex items-center justify-between border-b border-[#f2f3f5] py-2">
                                            <span className="text-[12.5px] font-medium text-[#6b7280]">{ses.name}</span>
                                            <span className="text-[12.5px] font-semibold text-[#0f172a]">{ses.attendees}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudienciaServicioDetalle;
