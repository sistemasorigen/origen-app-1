import React, { useMemo, useState } from 'react';
import { DropoutRequest } from '../../types';
import {
    GrupoConDatos,
    Segmentado,
    Rotulo,
    conComa,
    iniciales,
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

const InicioCoordinador: React.FC<Props> = ({ datos, dropouts, promedioIglesia, onAbrirGrupo, onVerAsistencia }) => {
    const [metrica, setMetrica] = useState<'inscriptos' | 'bajas'>('inscriptos');
    const [filtro, setFiltro] = useState<'activos' | 'finalizados'>('activos');
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);

    const activos = useMemo(() => datos.filter(d => !d.finalizado), [datos]);
    const finalizados = useMemo(() => datos.filter(d => d.finalizado), [datos]);
    const sinReportar = useMemo(() => activos.filter(d => !d.reporta), [activos]);
    const conReporte = useMemo(() => activos.filter(d => d.reporta), [activos]);

    const inscriptos = activos.reduce((s, d) => s + d.ocupados, 0);
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

        const marcados = activos
            .map(d => ({ d, p: puntaje(d) }))
            .filter(x => x.p > 0)
            .sort((a, b) => (b.p - a.p) || (b.d.ocupados - a.d.ocupados));

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
    }, [activos, promedioIglesia]);

    const resumenAlerta = useMemo(() => {
        const partes: string[] = [];
        if (sinReportar.length > 0) {
            partes.push(`${sinReportar.length === 1 ? 'Uno nunca cargó' : `${sinReportar.length} nunca cargaron`} asistencia`);
        }
        const bajos = conReporte.filter(d => promedioIglesia > 0 && d.promedio < promedioIglesia).length;
        if (bajos > 0) {
            partes.push(`${bajos === 1 ? 'uno viene' : `${bajos} vienen`} por debajo de ${conComa(promedioIglesia)} personas por reunión`);
        }
        const sanos = activos.length - sinReportar.length - bajos;
        const cola = sanos > 0 ? ` El resto está funcionando bien.` : '';
        return partes.length ? `${partes.join(' y ')}.${cola}` : '';
    }, [sinReportar, conReporte, activos, promedioIglesia]);

    // ── Gráfico ───────────────────────
    const delFiltro = filtro === 'activos' ? activos : finalizados;

    const barras = useMemo(() => {
        const valor = (d: GrupoConDatos) => metrica === 'inscriptos' ? d.ocupados : d.bajas;
        const maximo = Math.max(1, ...delFiltro.map(valor));
        return [...delFiltro]
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
    }, [delFiltro, metrica]);

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
                                    : `${necesitanLlamada} de tus ${activos.length} grupos necesitan una llamada`}
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
                    <p className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#0a0a0a]">{activos.length}</p>
                    <p className="mt-2 text-[12px] font-medium text-black/[.62]">
                        {activos.length} {activos.length === 1 ? 'activo' : 'activos'} · {finalizados.length} {finalizados.length === 1 ? 'finalizado' : 'finalizados'}
                    </p>
                </div>

                <div className="min-w-0 rounded-[18px] bg-white px-[18px] py-4">
                    <p className="text-[12.5px] font-semibold text-black/[.62]">Inscriptos</p>
                    <p className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-[#0a0a0a]">{inscriptos}</p>
                    <p className="mt-2 text-[12px] font-medium text-black/[.62]">
                        {dropouts.length} {dropouts.length === 1 ? 'baja' : 'bajas'} en la temporada
                    </p>
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

            {/* Gráfico por grupo */}
            <div className="mt-3.5 rounded-[20px] bg-white px-[22px] py-5">
                <div className="flex flex-wrap items-center gap-3">
                    <p className="min-w-[150px] flex-1 text-[15px] font-semibold text-[#0a0a0a]">
                        {metrica === 'inscriptos' ? 'Inscriptos' : 'Bajas'} por grupo · {filtro}
                    </p>
                    <Segmentado
                        valor={metrica}
                        onChange={v => setMetrica(v as 'inscriptos' | 'bajas')}
                        opciones={[
                            { valor: 'inscriptos', label: 'Inscriptos' },
                            { valor: 'bajas', label: 'Bajas' },
                        ]}
                    />
                    <Segmentado
                        valor={filtro}
                        onChange={v => setFiltro(v as 'activos' | 'finalizados')}
                        opciones={[
                            { valor: 'activos', label: 'Activos' },
                            { valor: 'finalizados', label: 'Finalizados' },
                        ]}
                    />
                </div>

                {barras.length === 0 ? (
                    <p className="mt-5 text-[13.5px] font-medium text-black/[.62]">
                        No hay grupos {filtro} en tus categorías.
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
