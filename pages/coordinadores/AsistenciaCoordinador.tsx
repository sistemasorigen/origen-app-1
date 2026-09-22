import React, { useMemo, useState } from 'react';
import {
    GrupoConDatos,
    Segmentado,
    conComa,
    escribirlePorWhatsApp,
    nombreAnfitrion,
    primerNombre,
} from './comunes';

/**
 * Asistencia de los grupos que coordina.
 *
 * Tres bloques, en este orden a propósito: cuánta de tu gente reporta,
 * después las reuniones reportadas, y al final la lista de los que nunca
 * cargaron nada. Ese último bloque no es una sección vacía: es a quién
 * llamar, y por eso está a la vista y no escondido detrás de un filtro.
 *
 * Los grupos que no reportan quedan fuera de todos los promedios. Se dice
 * en la pantalla porque si no el número de arriba miente.
 */

interface Props {
    datos: GrupoConDatos[];
    promedioIglesia: number;
    onAbrirGrupo: (groupId: string) => void;
}

const DE_A_20 = 20;

const AsistenciaCoordinador: React.FC<Props> = ({ datos, promedioIglesia, onAbrirGrupo }) => {
    const [busqueda, setBusqueda] = useState('');
    const [nivel, setNivel] = useState<'todos' | 'alta' | 'baja'>('todos');
    const [abierto, setAbierto] = useState<string | null>(null);
    const [cuantos, setCuantos] = useState(DE_A_20);
    const [aviso, setAviso] = useState('');

    // `datos` ya viene recortado al año y la temporada elegidos arriba: el
    // viejo "Activos / Finalizados" quedó dentro de ese filtro.
    const delFiltro = datos;

    const conReporte = delFiltro.filter(d => d.reporta);
    const sinReportar = delFiltro.filter(d => !d.reporta);

    // Una fila por reunión reportada, de la más nueva a la más vieja.
    const reuniones = useMemo(() => {
        const filas = delFiltro.flatMap(d => {
            // Para resolver quién estuvo presente sirven todas las
            // inscripciones, incluso las que después se dieron de baja: la
            // asistencia se cargó cuando esa persona estaba en el grupo.
            const nombrePorId = new Map<string, string>();
            const actuales: { id: string; nombre: string }[] = [];

            (d.grupo.registrations || []).forEach(r => {
                const nombre = `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Sin nombre';
                nombrePorId.set(String(r.id), nombre);
                if (r.status !== 'REJECTED') actuales.push({ id: String(r.id), nombre });

                if (r.partnerData) {
                    const pareja = `${r.partnerData.firstName || ''} ${r.partnerData.lastName || ''}`.trim() || 'Su pareja';
                    nombrePorId.set(`${r.id}-partner`, pareja);
                    if (r.status !== 'REJECTED') actuales.push({ id: `${r.id}-partner`, nombre: pareja });
                }
            });

            return d.reportes.map(r => {
                const presentes = r.ids
                    .map(id => nombrePorId.get(String(id)))
                    .filter((n): n is string => !!n);
                const idsPresentes = new Set(r.ids.map(String));
                const ausentes = actuales.filter(p => !idsPresentes.has(p.id)).map(p => p.nombre);
                const total = presentes.length + ausentes.length;

                return {
                    clave: `${d.grupo.id}-${r.fecha}`,
                    grupoId: d.grupo.id,
                    grupo: d.grupo.name || 'Sin nombre',
                    anfitrion: nombreAnfitrion(d.grupo),
                    fecha: r.fecha,
                    fechaTexto: new Date(`${r.fecha}T12:00:00`).toLocaleDateString('es-AR', {
                        weekday: 'long', day: 'numeric', month: 'long',
                    }),
                    presentes,
                    ausentes,
                    pct: total > 0 ? Math.round((presentes.length / total) * 100) : 0,
                };
            });
        });

        return filas.sort((a, b) => b.fecha.localeCompare(a.fecha));
    }, [delFiltro]);

    const filtradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return reuniones.filter(r => {
            if (q && !r.grupo.toLowerCase().includes(q) && !r.anfitrion.toLowerCase().includes(q)) return false;
            if (nivel === 'alta') return r.pct >= 80;
            if (nivel === 'baja') return r.pct < 50;
            return true;
        });
    }, [reuniones, busqueda, nivel]);

    const visibles = filtradas.slice(0, cuantos);

    const exportar = () => {
        const encabezados = ['Grupo', 'Anfitrión', 'Fecha', 'Asistencia', 'Presentes', 'Total', 'Ausentes'];
        const filas = filtradas.map(r => [
            `"${r.grupo.replace(/"/g, '""')}"`,
            `"${r.anfitrion.replace(/"/g, '""')}"`,
            `"${r.fechaTexto}"`,
            `${r.pct}%`,
            r.presentes.length,
            r.presentes.length + r.ausentes.length,
            `"${r.ausentes.join(', ').replace(/"/g, '""')}"`,
        ].join(','));

        // El BOM va como código de carácter: escrito literal en el archivo
        // fuente se cuela como texto y Excel muestra basura en la primera celda.
        const contenido = String.fromCharCode(0xFEFF) + [encabezados.join(','), ...filas].join('\r\n');
        const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8;' }));
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `asistencia_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
    };

    const escribirle = (d: GrupoConDatos) => {
        const nombre = primerNombre(nombreAnfitrion(d.grupo));
        const abrio = escribirlePorWhatsApp(
            d.grupo.leaderPhone,
            `Hola ${nombre}, ¿podés cargar la asistencia de ${d.grupo.name}?`
        );
        setAviso(abrio ? '' : `${nombreAnfitrion(d.grupo)} no tiene teléfono cargado en su ficha.`);
    };

    return (
        <>
            {/* Cobertura */}
            <div className="rounded-[20px] bg-[#0a0a0a] px-5 py-[18px]">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-[200px] flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-white/[.55]">
                            Cobertura del reporte
                        </p>
                        <p className="mt-2.5 text-[19px] font-semibold tracking-[-0.015em] text-white">
                            {conReporte.length} de tus {delFiltro.length} grupos de la temporada cargan asistencia
                        </p>
                        <p className="mt-2.5 text-[13px] font-medium leading-[1.6] text-white/70">
                            Lo que ves abajo se calcula solo con esos grupos. Los que no reportan no aparecen en ningún
                            promedio: por eso están listados aparte.
                        </p>
                    </div>
                    <button
                        onClick={exportar}
                        disabled={filtradas.length === 0}
                        className="h-11 w-full flex-none rounded-full bg-white/[.14] px-[18px] text-[13.5px] font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:w-auto"
                    >
                        Exportar CSV
                    </button>
                </div>
            </div>

            {aviso && (
                <p className="mt-3.5 rounded-[16px] bg-white px-4 py-3 text-[13px] font-medium text-[#0a0a0a]">{aviso}</p>
            )}

            {/* Reuniones reportadas */}
            <div className="mt-3.5 overflow-hidden rounded-[20px] bg-white">
                <div className="border-b border-[#f0efec] px-5 py-4">
                    <p className="text-[15px] font-semibold text-[#0a0a0a]">Últimos reportes</p>
                    <p className="mt-[5px] text-[12.5px] font-medium text-black/[.62]">
                        Tocá un reporte para ver quién vino y quién faltó.
                    </p>

                    <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                        <div className="flex h-[42px] w-full min-w-0 items-center gap-2.5 rounded-full bg-[#f7f7f5] pl-[17px] pr-2 md:w-auto md:min-w-[230px] md:flex-1">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.58)" strokeWidth={2.2} strokeLinecap="round" className="flex-none">
                                <circle cx="11" cy="11" r="6.5" />
                                <path d="M16 16l4 4" />
                            </svg>
                            <input
                                type="text"
                                value={busqueda}
                                onChange={e => { setBusqueda(e.target.value); setCuantos(DE_A_20); }}
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
                        <Segmentado
                            valor={nivel}
                            onChange={v => { setNivel(v as 'todos' | 'alta' | 'baja'); setCuantos(DE_A_20); }}
                            fondo="bg-[#f2f2f0]"
                            opciones={[
                                { valor: 'todos', label: 'Todas' },
                                { valor: 'alta', label: 'Vino mucha gente' },
                                { valor: 'baja', label: 'Vino poca' },
                            ]}
                        />
                    </div>
                </div>

                {visibles.length === 0 ? (
                    <p className="px-5 py-12 text-center text-[13.5px] font-medium text-black/[.62]">
                        {reuniones.length === 0
                            ? 'Ningún grupo de tus categorías cargó una asistencia en esta temporada.'
                            : 'Ninguna reunión coincide con esos filtros.'}
                    </p>
                ) : (
                    visibles.map(r => {
                        const desplegado = abierto === r.clave;
                        return (
                            <div key={r.clave} className="border-b border-[#f4f3f1] last:border-b-0">
                                <button
                                    onClick={() => setAbierto(desplegado ? null : r.clave)}
                                    aria-expanded={desplegado}
                                    className="block w-full px-5 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                >
                                    <div className="flex flex-wrap items-center gap-3.5">
                                        <div className="min-w-[140px] flex-1">
                                            <p className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">{r.grupo}</p>
                                            <p className="mt-[3px] text-[11.5px] font-medium text-black/[.62]">{r.fechaTexto}</p>
                                        </div>
                                        <div className="flex min-w-[150px] flex-1 items-center gap-[11px]">
                                            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                                                <span
                                                    className="block h-full rounded-full"
                                                    style={{ width: `${r.pct}%`, background: r.pct >= 60 ? '#0b7a53' : '#e8b96a' }}
                                                />
                                            </span>
                                            <span className="whitespace-nowrap text-[12.5px] font-semibold text-[#0a0a0a]">{r.pct}%</span>
                                        </div>
                                        <span className="whitespace-nowrap text-[12.5px] font-medium text-black/[.66]">
                                            {r.presentes.length} {r.presentes.length === 1 ? 'presente' : 'presentes'} · {r.ausentes.length} {r.ausentes.length === 1 ? 'ausente' : 'ausentes'}
                                        </span>
                                        <svg
                                            width="15" height="15" viewBox="0 0 24 24" fill="none"
                                            stroke="rgba(0,0,0,.5)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                                            className={`flex-none transition-transform ${desplegado ? 'rotate-180' : ''}`}
                                        >
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </div>
                                </button>

                                {desplegado && (
                                    <div className="bg-[#fcfcfb] px-5 pb-4 pt-0.5">
                                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                                            Quiénes vinieron
                                        </p>
                                        <div className="flex flex-wrap gap-[7px]">
                                            {r.presentes.length === 0 ? (
                                                <span className="text-[12.5px] font-medium text-black/[.6]">No vino nadie.</span>
                                            ) : r.presentes.map((n, i) => (
                                                <span key={`${n}-${i}`} className="flex h-[30px] items-center rounded-full bg-[#e7f5ee] px-3 text-[12px] font-semibold text-[#0b7a53]">
                                                    {n}
                                                </span>
                                            ))}
                                        </div>

                                        <p className="mb-2.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                                            Quiénes faltaron
                                        </p>
                                        <div className="flex flex-wrap gap-[7px]">
                                            {r.ausentes.length === 0 ? (
                                                <span className="text-[12.5px] font-medium text-black/[.6]">Vinieron todos.</span>
                                            ) : r.ausentes.map((n, i) => (
                                                <span key={`${n}-${i}`} className="flex h-[30px] items-center rounded-full bg-[#f2f2f0] px-3 text-[12px] font-semibold text-black/[.62]">
                                                    {n}
                                                </span>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => onAbrirGrupo(r.grupoId)}
                                            className="mt-4 h-[38px] rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                        >
                                            Ver la ficha del grupo
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {filtradas.length > visibles.length && (
                    <div className="border-t border-[#f0efec] px-5 py-3.5 text-center">
                        <button
                            onClick={() => setCuantos(c => c + DE_A_20)}
                            className="h-[38px] rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            Ver más reuniones ({filtradas.length - visibles.length})
                        </button>
                    </div>
                )}
            </div>

            {/* Los que nunca reportaron */}
            {sinReportar.length > 0 && (
                <div className="mt-3.5 rounded-[20px] bg-white px-[22px] py-5 shadow-[inset_0_0_0_1.5px_#f0d9b4]">
                    <p className="text-[15px] font-semibold text-[#0a0a0a]">
                        {sinReportar.length} {sinReportar.length === 1 ? 'grupo nunca cargó' : 'grupos nunca cargaron'} una asistencia
                    </p>
                    <p className="mt-[7px] text-[12.5px] font-medium leading-[1.6] text-black/[.64]">
                        No es una sección vacía: es la lista de anfitriones a los que llamar. Ninguno de estos grupos
                        entra en los promedios de arriba{promedioIglesia > 0 ? `, que hoy dan ${conComa(promedioIglesia)} en toda la iglesia` : ''}.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                        {sinReportar.map(d => (
                            <div key={d.grupo.id} className="flex flex-wrap items-center gap-3 rounded-[16px] bg-[#fdfaf4] px-[15px] py-3">
                                <button
                                    onClick={() => onAbrirGrupo(d.grupo.id)}
                                    className="min-w-[150px] flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                >
                                    <p className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">{d.grupo.name}</p>
                                    <p className="mt-[3px] truncate text-[12px] font-medium text-black/[.64]">
                                        {nombreAnfitrion(d.grupo)} · {d.ocupados} {d.ocupados === 1 ? 'inscripto' : 'inscriptos'}, ningún reporte
                                    </p>
                                </button>
                                <button
                                    onClick={() => escribirle(d)}
                                    className="h-[38px] flex-none rounded-full bg-white px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    Escribirle
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default AsistenciaCoordinador;
