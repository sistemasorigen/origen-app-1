import React, { useMemo, useState } from 'react';
import { dondeSeReune } from '../../src/utils/modalidad';
import { GrupoConDatos, nombreAnfitrion } from './comunes';

/**
 * Calendario del mes con las reuniones de los grupos que coordina.
 *
 * Cada reunión se pinta de verde si esa fecha tiene la asistencia cargada y
 * de ámbar si no: de un vistazo se ve qué semana se dejó de reportar, que es
 * lo que el listado de asistencia tarda más en contar.
 *
 * La semana arranca en lunes, como en el diseño y como se piensan las
 * reuniones acá. Al tocar un día, sus reuniones se abren debajo de la
 * grilla, con el botón que lleva a la ficha del grupo.
 */

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const NOMBRE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

interface Props {
    datos: GrupoConDatos[];
    onAbrirGrupo: (groupId: string) => void;
    /** Mes con el que abre. Por defecto, el de hoy. */
    mesInicial?: Date;
}

/** Día de la semana del grupo, en índice lunes=0. */
const indiceDia = (nombre?: string): number => {
    if (!nombre) return -1;
    const limpio = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (limpio.includes('lun')) return 0;
    if (limpio.includes('mar')) return 1;
    if (limpio.includes('mier')) return 2;
    if (limpio.includes('jue')) return 3;
    if (limpio.includes('vie')) return 4;
    if (limpio.includes('sab')) return 5;
    if (limpio.includes('dom')) return 6;
    return -1;
};

const aISO = (anio: number, mes: number, dia: number) =>
    `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

const CalendarioCoordinador: React.FC<Props> = ({ datos, onAbrirGrupo, mesInicial }) => {
    const hoy = new Date();
    const [mes, setMes] = useState(() => mesInicial ?? new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    const [diaElegido, setDiaElegido] = useState<string | null>(null);

    const anio = mes.getFullYear();
    const numeroMes = mes.getMonth();
    const largo = new Date(anio, numeroMes + 1, 0).getDate();
    // getDay() da domingo=0; acá la semana arranca en lunes.
    const corrimiento = (new Date(anio, numeroMes, 1).getDay() + 6) % 7;
    const hoyISO = aISO(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    // Reuniones del mes. Un grupo genera una reunión por cada día de la
    // semana que le toca, mientras la fecha caiga dentro de su temporada.
    const porFecha = useMemo(() => {
        const mapa = new Map<string, {
            grupoId: string;
            grupo: string;
            hora: string;
            donde: string;
            anfitrion: string;
            reportada: boolean;
        }[]>();

        datos.forEach(d => {
            const dia = indiceDia(d.grupo.meetingDay);
            if (dia < 0) return;

            const fechasReportadas = new Set(d.reportes.map(r => r.fecha));
            const desde = (d.grupo.startDate || '').split('T')[0];
            const hasta = (d.grupo.endDate || '').split('T')[0];

            for (let n = 1; n <= largo; n++) {
                const fecha = aISO(anio, numeroMes, n);
                if (((new Date(anio, numeroMes, n).getDay() + 6) % 7) !== dia) continue;
                if (desde && fecha < desde) continue;
                if (hasta && fecha > hasta) continue;

                const lista = mapa.get(fecha) || [];
                lista.push({
                    grupoId: d.grupo.id,
                    grupo: d.grupo.name || 'Sin nombre',
                    hora: d.grupo.meetingTime || '',
                    donde: dondeSeReune(d.grupo, 'Online'),
                    anfitrion: nombreAnfitrion(d.grupo),
                    reportada: fechasReportadas.has(fecha),
                });
                mapa.set(fecha, lista);
            }
        });

        mapa.forEach(lista => lista.sort((a, b) => a.hora.localeCompare(b.hora)));
        return mapa;
    }, [datos, anio, numeroMes, largo]);

    const totalMes = useMemo(
        () => Array.from(porFecha.values()).reduce((s, l) => s + l.length, 0),
        [porFecha]
    );
    const sinReportarMes = useMemo(
        () => Array.from(porFecha.entries())
            .filter(([fecha]) => fecha <= hoyISO)
            .reduce((s, [, l]) => s + l.filter(e => !e.reportada).length, 0),
        [porFecha, hoyISO]
    );

    const delDia = diaElegido ? (porFecha.get(diaElegido) || []) : [];

    const irAlMes = (delta: number) => {
        setMes(new Date(anio, numeroMes + delta, 1));
        setDiaElegido(null);
    };

    const volverAHoy = () => {
        setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        setDiaElegido(hoyISO);
    };

    const celdas: React.ReactNode[] = [];
    for (let i = 0; i < corrimiento; i++) {
        celdas.push(<div key={`vacio-${i}`} className="min-h-[48px] md:min-h-[76px]" />);
    }
    for (let n = 1; n <= largo; n++) {
        const fecha = aISO(anio, numeroMes, n);
        const eventos = porFecha.get(fecha) || [];
        const esHoy = fecha === hoyISO;
        const elegido = fecha === diaElegido;

        celdas.push(
            <button
                key={fecha}
                onClick={() => setDiaElegido(elegido ? null : fecha)}
                aria-pressed={elegido}
                aria-label={`${n} de ${MESES[numeroMes]}, ${eventos.length} ${eventos.length === 1 ? 'reunión' : 'reuniones'}`}
                className={`flex min-h-[48px] flex-col items-center rounded-[10px] px-[3px] py-[5px] text-left md:min-h-[76px] md:items-stretch md:rounded-xl md:px-2 md:py-[7px] ${esHoy ? 'bg-[#0a0a0a]' : 'bg-[#fcfcfb]'} ${elegido && !esHoy ? 'shadow-[inset_0_0_0_1.5px_#0a0a0a]' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1`}
            >
                <span className={`text-[11.5px] font-semibold md:text-[12px] ${esHoy ? 'text-white' : 'text-black/[.66]'}`}>
                    {n}
                </span>

                {/* En el teléfono cada reunión es un punto: los nombres no
                    entran en una columna de 48px y el color ya dice todo. */}
                <span className="flex flex-wrap justify-center md:hidden">
                    {eventos.slice(0, 4).map((e, i) => (
                        <span
                            key={i}
                            className="mx-px mt-[3px] h-1.5 w-1.5 rounded-full"
                            style={{ background: e.reportada ? '#0b7a53' : '#e8b96a' }}
                        />
                    ))}
                </span>

                <span className="hidden w-full md:block">
                    {eventos.slice(0, 3).map((e, i) => (
                        <span
                            key={i}
                            className="mt-1 block truncate rounded-md px-[7px] py-[3px] text-[10.5px] font-semibold"
                            style={{
                                background: e.reportada ? '#e7f5ee' : '#fdf3e3',
                                color: e.reportada ? '#0b7a53' : '#7a4f10',
                            }}
                        >
                            {e.grupo}
                        </span>
                    ))}
                    {eventos.length > 3 && (
                        <span className={`mt-1 block px-[7px] text-[10px] font-semibold ${esHoy ? 'text-white/60' : 'text-black/[.5]'}`}>
                            +{eventos.length - 3}
                        </span>
                    )}
                </span>
            </button>
        );
    }

    return (
        <div className="rounded-[20px] bg-white px-3.5 py-4 md:px-[22px] md:py-5">
            <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[150px] flex-1">
                    <p className="text-[18px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                        {MESES[numeroMes]} {anio}
                    </p>
                    <p className="mt-[5px] text-[12.5px] font-medium text-black/[.62]">
                        {totalMes === 0
                            ? 'Ninguno de tus grupos se reúne este mes.'
                            : `${totalMes} reuniones de tus grupos${sinReportarMes > 0 ? ` · ${sinReportarMes} sin reportar` : ''}.`}
                    </p>
                </div>
                <div className="flex flex-none gap-1.5">
                    <button
                        onClick={() => irAlMes(-1)}
                        aria-label="Mes anterior"
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#f2f2f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 6l-6 6 6 6" />
                        </svg>
                    </button>
                    <button
                        onClick={volverAHoy}
                        className="h-[38px] rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Hoy
                    </button>
                    <button
                        onClick={() => irAlMes(1)}
                        aria-label="Mes siguiente"
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#f2f2f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 6l6 6-6 6" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="mt-[18px] grid grid-cols-7 gap-1 md:gap-[7px]">
                {DIAS.map((d, i) => (
                    <span key={i} className="pb-1 text-center text-[11px] font-semibold tracking-[0.05em] text-black/[.58]">
                        {d}
                    </span>
                ))}
                {celdas}
            </div>

            <div className="mt-[18px] flex flex-wrap gap-4 border-t border-[#f0efec] pt-4">
                <span className="flex items-center gap-[7px]">
                    <span className="h-[9px] w-[9px] rounded-[3px] bg-[#0b7a53]" />
                    <span className="text-[12px] font-semibold text-black/[.64]">Reunión con asistencia cargada</span>
                </span>
                <span className="flex items-center gap-[7px]">
                    <span className="h-[9px] w-[9px] rounded-[3px] bg-[#e8b96a]" />
                    <span className="text-[12px] font-semibold text-black/[.64]">Reunión sin reportar</span>
                </span>
            </div>

            {/* Reuniones del día elegido */}
            {diaElegido && (
                <div className="mt-4 border-t border-[#f0efec] pt-4">
                    <p className="text-[15px] font-semibold text-[#0a0a0a]">
                        {NOMBRE_DIA[(new Date(`${diaElegido}T12:00:00`).getDay() + 6) % 7]}{' '}
                        {Number(diaElegido.split('-')[2])} de {MESES[numeroMes]}
                    </p>

                    {delDia.length === 0 ? (
                        <p className="mt-2.5 text-[13px] font-medium text-black/[.62]">
                            Ninguno de tus grupos se reúne este día.
                        </p>
                    ) : (
                        <div className="mt-3 grid gap-2.5 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                            {delDia.map((e, i) => (
                                <div key={`${e.grupoId}-${i}`} className="min-w-0 rounded-[16px] bg-[#f7f7f5] px-4 py-3.5">
                                    <div className="flex items-start gap-2.5">
                                        <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: e.reportada ? '#0b7a53' : '#e8b96a' }} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">{e.grupo}</p>
                                            <p className="mt-[3px] truncate text-[12px] font-medium text-black/[.64]">
                                                {e.hora ? `${e.hora} · ` : ''}{e.donde}
                                            </p>
                                            <p className="mt-[2px] truncate text-[12px] font-medium text-black/[.64]">{e.anfitrion}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center gap-2.5">
                                        <span
                                            className="flex h-[26px] items-center rounded-full px-[11px] text-[11.5px] font-semibold"
                                            style={{
                                                background: e.reportada ? '#e7f5ee' : '#fdf3e3',
                                                color: e.reportada ? '#0b7a53' : '#7a4f10',
                                            }}
                                        >
                                            {e.reportada ? 'Asistencia cargada' : diaElegido > hoyISO ? 'Todavía no pasó' : 'Sin reportar'}
                                        </span>
                                        <button
                                            onClick={() => onAbrirGrupo(e.grupoId)}
                                            className="ml-auto h-[34px] flex-none rounded-full bg-white px-3.5 text-[12px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                        >
                                            Ver la ficha
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CalendarioCoordinador;
