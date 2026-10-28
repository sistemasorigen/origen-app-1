import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BotonPrimario, BotonSecundario, EncabezadoSubpagina, ESTILO_TARJETA, Girito, Icono, ICONOS, Rotulo, TARJETA,
} from '../../../components/miCuenta/piezas';
import { detalleDeAvisos, esIOS, PASOS_ANDROID, PASOS_IPHONE_AJUSTES } from '../../../components/miCuenta/avisos';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { enviarPrueba, misDispositivos, type Dispositivo, type ResultadoPrueba } from '../../../src/utils/push';

/**
 * Mi cuenta → Notificaciones en este dispositivo.
 *
 * Prender o apagar las de este dispositivo, ver en cuáles están activas y
 * mandarse una de prueba. La lista viene de push_mis_dispositivos, que no
 * devuelve las direcciones ni las claves: por eso desde acá no se puede
 * apagar OTRO dispositivo. Cada uno se apaga desde sí mismo, o solo, si se
 * desinstala la app (send-push borra la suscripción muerta).
 */

const NOMBRE_PLATAFORMA: Record<Dispositivo['plataforma'], string> = {
    ios: 'iPhone o iPad',
    android: 'Android',
    escritorio: 'Compu',
    otro: 'Otro dispositivo',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dos = (n: number) => String(n).padStart(2, '0');
const cuando = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const hoy = new Date();
    const mismoDia = d.toDateString() === hoy.toDateString();
    return mismoDia ? `hoy a las ${dos(d.getHours())}:${dos(d.getMinutes())}` : `el ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

const TEXTO_PRUEBA: Record<string, string> = {
    tope: 'Ya mandaste 5 pruebas hoy. Probá de nuevo mañana.',
    sin_dispositivos: 'Primero activá las notificaciones en este dispositivo.',
    sin_sesion: 'Tu sesión venció. Volvé a entrar y probá de nuevo.',
    error: 'No pudimos mandarla. Revisá tu conexión y probá de nuevo.',
};

export const DispositivosPush: React.FC<{ onVolver?: () => void; onCambio?: () => void }> = ({ onVolver, onCambio }) => {
    const navigate = useNavigate();
    const push = usePushNotifications();
    const [dispositivos, setDispositivos] = useState<Dispositivo[] | null>(null);
    const [errorLista, setErrorLista] = useState(false);
    const [probando, setProbando] = useState(false);
    const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);
    const [aviso, setAviso] = useState('');
    const vivo = useRef(true);
    useEffect(() => () => { vivo.current = false; }, []);

    const cargar = useCallback(async () => {
        try {
            const l = await misDispositivos();
            if (vivo.current) { setDispositivos(l); setErrorLista(false); }
        } catch {
            if (vivo.current) setErrorLista(true);
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const estado = push.estado;

    // Sin await antes de push.activar(): el permiso sale directo del toque.
    const prender = async () => {
        setAviso('');
        const r = await push.activar();
        if (!vivo.current) return;
        if (r === 'denegado') setAviso('No diste permiso. Si cambiás de idea, mirá cómo activarlas abajo.');
        else if (r === 'error') setAviso('No pudimos activarlas. Probá de nuevo.');
        await cargar();
        onCambio?.();
    };

    const apagar = async () => {
        setAviso('');
        await push.desactivar();
        if (!vivo.current) return;
        setPrueba(null);
        await cargar();
        onCambio?.();
    };

    const probar = async () => {
        setProbando(true);
        setPrueba(null);
        const r = await enviarPrueba();
        if (!vivo.current) return;
        setPrueba(r);
        setProbando(false);
    };

    return (
        <>
            <EncabezadoSubpagina titulo="Notificaciones en este dispositivo" onVolver={onVolver} />

            <p className="mt-2.5 mb-0 text-[14.5px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                Te avisamos de tus grupos, tareas, solicitudes y novedades aunque tengas la app cerrada.
            </p>

            {/* ── Este dispositivo ─────────────────────────────────────── */}
            <div className={`${TARJETA} mt-[22px] p-[18px]`} style={ESTILO_TARJETA}>
                {estado === null ? (
                    <p className="m-0 flex items-center gap-2.5 text-[15px] font-semibold"><Girito />Revisando…</p>
                ) : (
                    <>
                        <p className="m-0 flex items-center gap-2 text-[15.5px] font-semibold">
                            {estado === 'prendido' && (
                                <span style={{ color: '#34c759' }}><Icono d={ICONOS.tilde} tam={18} grosor={3} /></span>
                            )}
                            {estado === 'prendido' ? 'Activadas en este dispositivo' : 'Apagadas en este dispositivo'}
                        </p>
                        <p className="mt-1.5 mb-0 text-[14px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                            {detalleDeAvisos(estado)}
                        </p>

                        {estado === 'apagado' && (
                            <BotonPrimario ancho className="mt-4" disabled={push.ocupado} onClick={prender}>
                                {push.ocupado ? <Girito sobreOscuro /> : null}
                                Activar notificaciones
                            </BotonPrimario>
                        )}
                        {estado === 'prendido' && (
                            <BotonSecundario ancho className="mt-4" disabled={push.ocupado} onClick={apagar}>
                                {push.ocupado ? <Girito /> : null}
                                Apagar en este dispositivo
                            </BotonSecundario>
                        )}
                        {estado === 'iphone' && (
                            <BotonPrimario ancho className="mt-4" onClick={() => navigate('/perfil/instalar')}>
                                Ver cómo instalar la app
                            </BotonPrimario>
                        )}
                        {estado === 'bloqueado' && (
                            <ol className="list-none m-0 mt-4 p-0 flex flex-col gap-3">
                                {(esIOS() ? PASOS_IPHONE_AJUSTES : PASOS_ANDROID).map((paso, i) => (
                                    <li key={paso} className="flex gap-3 items-start">
                                        <span className="w-7 h-7 flex-none rounded-full flex items-center justify-center text-[13.5px] font-bold"
                                            style={{ background: 'var(--mc-chip)' }}>
                                            {i + 1}
                                        </span>
                                        <span className="pt-[3px] text-[14.5px] leading-[1.45] font-medium text-pretty">{paso}</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                        {aviso && (
                            <p role="alert" className="mt-3 mb-0 text-[14px] font-semibold">{aviso}</p>
                        )}
                    </>
                )}
            </div>

            {/* ── Mis dispositivos ─────────────────────────────────────── */}
            <Rotulo className="mt-7 mb-2.5 ml-1.5">DÓNDE ESTÁN ACTIVADAS</Rotulo>
            <div className={`${TARJETA} px-[18px] py-1`} style={ESTILO_TARJETA}>
                {errorLista ? (
                    <p className="my-3.5 text-[14.5px] font-medium" style={{ color: 'var(--mc-m66)' }}>
                        No pudimos traer la lista. <button type="button" onClick={cargar}
                            className="border-0 bg-transparent p-0 font-[inherit] font-semibold underline underline-offset-[3px] cursor-pointer"
                            style={{ color: 'var(--mc-ink)' }}>Reintentar</button>
                    </p>
                ) : dispositivos === null ? (
                    <p className="my-3.5 flex items-center gap-2.5 text-[14.5px] font-medium"><Girito />Cargando…</p>
                ) : dispositivos.length === 0 ? (
                    <p className="my-3.5 text-[14.5px] font-medium" style={{ color: 'var(--mc-m66)' }}>
                        Todavía no las activaste en ningún dispositivo.
                    </p>
                ) : (
                    <ul className="m-0 p-0 list-none" aria-label="Dispositivos con notificaciones">
                        {dispositivos.map((d, i) => (
                            <li key={`${d.created_at}-${i}`} className="flex items-center gap-3.5 py-3"
                                style={i === 0 ? undefined : { borderTop: '1px solid var(--mc-line)' }}>
                                <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center" style={{ background: 'var(--mc-chip)' }}>
                                    <Icono d={d.plataforma === 'escritorio' ? 'M3.5 5h17v11h-17zM8 20h8M12 16v4' : ICONOS.celular} />
                                </span>
                                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                    <span className="text-[15px] font-semibold">
                                        {NOMBRE_PLATAFORMA[d.plataforma]}{d.navegador ? ` · ${d.navegador}` : ''}
                                    </span>
                                    <span className="text-[13px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                                        Activadas {cuando(d.created_at)}
                                        {d.last_ok_at ? ` · última, ${cuando(d.last_ok_at)}` : ' · todavía no recibió ninguna'}
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {dispositivos && dispositivos.length > 1 && (
                <p className="mt-2.5 mb-0 mx-1.5 text-[13px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m50)' }}>
                    Para apagarlas en otro dispositivo, entrá a esta pantalla desde ese dispositivo.
                </p>
            )}

            {/* ── La prueba ────────────────────────────────────────────── */}
            {dispositivos && dispositivos.length > 0 && (
                <div className={`${TARJETA} mt-6 p-[18px] flex flex-col items-center text-center`} style={ESTILO_TARJETA}>
                    <p className="m-0 text-[14.5px] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                        Te mandamos una notificación a todos tus dispositivos para que veas que llega. Probá también con la app cerrada.
                    </p>
                    <BotonSecundario className="mt-3.5 min-h-[48px]" disabled={probando} onClick={probar}>
                        {probando ? <Girito /> : null}
                        Enviar notificación de prueba
                    </BotonSecundario>
                    {prueba && (
                        <p aria-live="polite" className="mt-3 mb-0 text-[14px] font-semibold text-pretty" style={{ animation: 'mcAparece .2s ease' }}>
                            {'motivo' in prueba
                                ? TEXTO_PRUEBA[prueba.motivo]
                                : `Enviada: te tiene que llegar en unos segundos.${prueba.quedan === 0 ? ' Era la última prueba de hoy.' : ''}`}
                        </p>
                    )}
                </div>
            )}
        </>
    );
};
