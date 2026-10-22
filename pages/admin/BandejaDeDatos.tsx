import React, { useCallback, useEffect, useState } from 'react';
import {
    actualizarReporte, actualizarSolicitud, reportesAdmin, solicitudesAdmin,
    urlCapturaReporte,
    type EstadoDeReporte, type EstadoDeSolicitud, type ReporteAdmin, type SolicitudAdmin,
} from '../../services/miCuenta';
import { Rotulo } from './piezasAdmin';

/**
 * La bandeja de Sistemas: solicitudes de datos y reportes de problemas.
 *
 * LOS PLAZOS SON LEGALES, ASÍ QUE SE MUESTRAN COMO TALES. La Ley 25.326 da
 * 10 días CORRIDOS para un acceso y 5 HÁBILES para una corrección o una
 * supresión. No es lo mismo y no se puede redondear: por eso hay dos cuentas
 * distintas y la de hábiles saltea sábados y domingos. Vencido va en rojo,
 * porque a esa altura ya no es un recordatorio.
 *
 * La captura de un reporte se pide AL TOCAR y no al abrir la lista: es una
 * URL firmada de 5 minutos, y emitir una por cada reporte que alguien ojea
 * de paso es repartir permisos de lectura sin motivo. Mismo criterio que el
 * comprobante de una venta.
 */

const TIPO: Record<string, string> = {
    acceso: 'Acceso a sus datos',
    rectificacion: 'Corrección de datos',
    supresion: 'Eliminar la cuenta',
};

/** Cuántos días da la ley para cada tipo, y de cuáles. */
const PLAZO: Record<string, { dias: number; habiles: boolean }> = {
    acceso: { dias: 10, habiles: false },
    rectificacion: { dias: 5, habiles: true },
    supresion: { dias: 5, habiles: true },
};

const sumarDias = (desde: Date, dias: number, habiles: boolean): Date => {
    const f = new Date(desde);
    if (!habiles) { f.setDate(f.getDate() + dias); return f; }
    let faltan = dias;
    while (faltan > 0) {
        f.setDate(f.getDate() + 1);
        const d = f.getDay();
        if (d !== 0 && d !== 6) faltan--;
    }
    return f;
};

/** "Faltan 3 días", "Vence hoy" o "Vencida hace 2 días". */
const comoVaElPlazo = (creada: string, tipo: string): { texto: string; vencida: boolean } => {
    const regla = PLAZO[tipo] || PLAZO.acceso;
    const limite = sumarDias(new Date(creada), regla.dias, regla.habiles);
    limite.setHours(23, 59, 59, 999);
    const hoy = new Date();
    const dias = Math.ceil((limite.getTime() - hoy.getTime()) / 86400000);

    if (dias < 0) return { texto: `Vencida hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`, vencida: true };
    if (dias === 0) return { texto: 'Vence hoy', vencida: false };
    return { texto: `Faltan ${dias} ${dias === 1 ? 'día' : 'días'}`, vencida: false };
};

const fecha = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return ''; }
};

const PASTILLA: Record<string, string> = {
    recibida: 'bg-[#f2f2f0] text-black/[.64]',
    en_curso: 'bg-[#fbefd5] text-[#8f5c00]',
    resuelta: 'bg-[#dff3e4] text-[#1d6a38]',
    nuevo: 'bg-[#f2f2f0] text-black/[.64]',
    visto: 'bg-[#fbefd5] text-[#8f5c00]',
    resuelto: 'bg-[#dff3e4] text-[#1d6a38]',
};

const NOMBRE_ESTADO: Record<string, string> = {
    recibida: 'Recibida', en_curso: 'En curso', resuelta: 'Resuelta',
    nuevo: 'Nuevo', visto: 'Visto', resuelto: 'Resuelto',
};

const tarjeta = 'rounded-[18px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.05)]';
const boton = (primario?: boolean) =>
    `h-10 rounded-full px-4 text-[13px] font-semibold transition-colors ${primario
        ? 'bg-[#0a0a0a] text-white hover:bg-black'
        : 'bg-[#f2f2f0] text-[#0a0a0a] hover:bg-[#e8e8e5]'}`;

export const BandejaDeDatos: React.FC<{ userId?: string }> = ({ userId }) => {
    const [cual, setCual] = useState<'solicitudes' | 'reportes'>('solicitudes');
    const [solicitudes, setSolicitudes] = useState<SolicitudAdmin[] | null>(null);
    const [reportes, setReportes] = useState<ReporteAdmin[] | null>(null);
    const [abierta, setAbierta] = useState<string | null>(null);
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [captura, setCaptura] = useState<{ id: string; url: string } | null>(null);

    const recargar = useCallback(() => {
        solicitudesAdmin().then(setSolicitudes);
        reportesAdmin().then(setReportes);
    }, []);
    useEffect(() => { recargar(); }, [recargar]);

    const abrir = (id: string, notaActual: string | null) => {
        if (abierta === id) { setAbierta(null); return; }
        setAbierta(id);
        setNota(notaActual || '');
        setCaptura(null);
    };

    const moverSolicitud = async (s: SolicitudAdmin, estado: EstadoDeSolicitud) => {
        setGuardando(true);
        await actualizarSolicitud(s.id, { estado, notaInterna: nota }, userId);
        setGuardando(false);
        recargar();
    };

    const moverReporte = async (r: ReporteAdmin, estado: EstadoDeReporte) => {
        setGuardando(true);
        await actualizarReporte(r.id, { estado, notaInterna: nota });
        setGuardando(false);
        recargar();
    };

    const verCaptura = async (r: ReporteAdmin) => {
        if (!r.capturaPath) return;
        const url = await urlCapturaReporte(r.capturaPath);
        if (url) setCaptura({ id: r.id, url });
    };

    const abiertas = (lista: { estado: string }[] | null, cerrado: string) =>
        (lista || []).filter(x => x.estado !== cerrado).length;

    return (
        <div>
            <div className="flex items-center gap-1.5 pb-4">
                {([['solicitudes', 'Solicitudes de datos', abiertas(solicitudes, 'resuelta')],
                   ['reportes', 'Reportes de problemas', abiertas(reportes, 'resuelto')]] as const).map(([clave, texto, pendientes]) => (
                    <button
                        key={clave}
                        onClick={() => { setCual(clave as typeof cual); setAbierta(null); }}
                        className={`flex h-[38px] items-center gap-1.5 rounded-full px-[15px] text-[12.5px] font-semibold transition-colors md:h-10 md:text-[13.5px] ${cual === clave ? 'bg-[#0a0a0a] text-white' : 'bg-white text-black/[.64] hover:text-[#0a0a0a]'
                            }`}
                    >
                        {texto}
                        {pendientes > 0 && (
                            <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${cual === clave ? 'bg-white/20 text-white' : 'bg-[#e5484d] text-white'
                                }`}>
                                {pendientes}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {cual === 'solicitudes' && (
                solicitudes === null ? <p className="py-10 text-center text-[13px] text-black/40">Buscando…</p>
                    : solicitudes.length === 0 ? (
                        <div className={`${tarjeta} px-5 py-8 text-center`}>
                            <p className="m-0 text-[14px] font-medium text-black/[.55]">
                                Todavía no hay solicitudes de datos.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            {solicitudes.map(s => {
                                const plazo = comoVaElPlazo(s.createdAt, s.tipo);
                                const cerrada = s.estado === 'resuelta';
                                return (
                                    <div key={s.id} className={tarjeta}>
                                        <button
                                            onClick={() => abrir(s.id, s.notaInterna)}
                                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                                        >
                                            <span className="w-[52px] flex-none text-[13px] font-semibold text-black/[.55]">
                                                N.º {s.numero}
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className="text-[14.5px] font-semibold text-[#0a0a0a]">{TIPO[s.tipo] || s.tipo}</span>
                                                <span className="text-[12.5px] font-medium text-black/[.5]">{fecha(s.createdAt)}</span>
                                            </span>
                                            {!cerrada && (
                                                <span className={`flex-none text-[12.5px] font-semibold ${plazo.vencida ? 'text-[#d1343a]' : 'text-black/[.55]'}`}>
                                                    {plazo.texto}
                                                </span>
                                            )}
                                            <span className={`flex-none rounded-full px-2.5 py-1 text-[12px] font-semibold ${PASTILLA[s.estado]}`}>
                                                {NOMBRE_ESTADO[s.estado]}
                                            </span>
                                        </button>

                                        {abierta === s.id && (
                                            <div className="border-t border-[#f0efec] px-4 py-4">
                                                <Rotulo>Lo que escribió</Rotulo>
                                                <p className="mb-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.5] text-[#0a0a0a]">
                                                    {s.mensaje || s.motivo || 'No escribió nada.'}
                                                </p>

                                                <Rotulo className="mt-4">Nota interna</Rotulo>
                                                <textarea
                                                    value={nota}
                                                    onChange={e => setNota(e.target.value)}
                                                    rows={2}
                                                    placeholder="Para Sistemas. La persona no la ve."
                                                    className="mt-1.5 w-full rounded-xl border border-[#e4e2dd] bg-[#fafaf8] px-3 py-2.5 text-[14px] outline-none focus:border-[#0a0a0a]"
                                                />

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {s.estado !== 'en_curso' && !cerrada && (
                                                        <button disabled={guardando} onClick={() => moverSolicitud(s, 'en_curso')} className={boton()}>
                                                            Marcar en curso
                                                        </button>
                                                    )}
                                                    {!cerrada && (
                                                        <button disabled={guardando} onClick={() => moverSolicitud(s, 'resuelta')} className={boton(true)}>
                                                            Marcar resuelta
                                                        </button>
                                                    )}
                                                    {cerrada && (
                                                        <button disabled={guardando} onClick={() => moverSolicitud(s, 'en_curso')} className={boton()}>
                                                            Reabrir
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
            )}

            {cual === 'reportes' && (
                reportes === null ? <p className="py-10 text-center text-[13px] text-black/40">Buscando…</p>
                    : reportes.length === 0 ? (
                        <div className={`${tarjeta} px-5 py-8 text-center`}>
                            <p className="m-0 text-[14px] font-medium text-black/[.55]">
                                Todavía no hay reportes.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            {reportes.map(r => (
                                <div key={r.id} className={tarjeta}>
                                    <button
                                        onClick={() => abrir(r.id, r.notaInterna)}
                                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                                    >
                                        <span className="w-[52px] flex-none text-[13px] font-semibold text-black/[.55]">
                                            N.º {r.numero}
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="truncate text-[14.5px] font-semibold text-[#0a0a0a]">
                                                {r.pantalla || 'Sin pantalla'}
                                            </span>
                                            <span className="truncate text-[12.5px] font-medium text-black/[.5]">
                                                {fecha(r.createdAt)} · {r.descripcion.slice(0, 60)}
                                            </span>
                                        </span>
                                        <span className={`flex-none rounded-full px-2.5 py-1 text-[12px] font-semibold ${PASTILLA[r.estado]}`}>
                                            {NOMBRE_ESTADO[r.estado]}
                                        </span>
                                    </button>

                                    {abierta === r.id && (
                                        <div className="border-t border-[#f0efec] px-4 py-4">
                                            <Rotulo>Qué pasó</Rotulo>
                                            <p className="mb-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.5] text-[#0a0a0a]">
                                                {r.descripcion}
                                            </p>

                                            <Rotulo className="mt-4">Datos técnicos</Rotulo>
                                            <p className="mb-0 mt-1.5 break-words text-[12.5px] leading-[1.5] text-black/[.55]">
                                                Versión {r.versionApp || '—'} · {r.dispositivo || '—'}
                                            </p>

                                            {r.capturaPath && (
                                                <>
                                                    <Rotulo className="mt-4">Captura</Rotulo>
                                                    {captura?.id === r.id ? (
                                                        <a href={captura.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block">
                                                            <img
                                                                src={captura.url}
                                                                alt="Captura del reporte"
                                                                className="h-[240px] w-full rounded-xl border border-[#e4e2dd] bg-[#fafaf8] object-contain"
                                                            />
                                                            <span className="mt-1.5 block text-[12px] text-black/40">
                                                                El enlace vence en 5 minutos.
                                                            </span>
                                                        </a>
                                                    ) : (
                                                        <button onClick={() => verCaptura(r)} className={`${boton()} mt-1.5`}>
                                                            Ver la captura
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            <Rotulo className="mt-4">Nota interna</Rotulo>
                                            <textarea
                                                value={nota}
                                                onChange={e => setNota(e.target.value)}
                                                rows={2}
                                                placeholder="Para Sistemas. La persona no la ve."
                                                className="mt-1.5 w-full rounded-xl border border-[#e4e2dd] bg-[#fafaf8] px-3 py-2.5 text-[14px] outline-none focus:border-[#0a0a0a]"
                                            />

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {r.estado === 'nuevo' && (
                                                    <button disabled={guardando} onClick={() => moverReporte(r, 'visto')} className={boton()}>
                                                        Marcar visto
                                                    </button>
                                                )}
                                                {r.estado !== 'resuelto' && (
                                                    <button disabled={guardando} onClick={() => moverReporte(r, 'resuelto')} className={boton(true)}>
                                                        Marcar resuelto
                                                    </button>
                                                )}
                                                {r.estado === 'resuelto' && (
                                                    <button disabled={guardando} onClick={() => moverReporte(r, 'visto')} className={boton()}>
                                                        Reabrir
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )
            )}
        </div>
    );
};

export default BandejaDeDatos;
