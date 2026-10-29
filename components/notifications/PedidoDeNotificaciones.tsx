import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { BotonPrimario, BotonSecundario, Panel } from '../miCuenta/piezas';

/**
 * Al entrar a la app: el pedido de activar las notificaciones de Origen.
 * Hoja desde abajo en el teléfono, modal centrado en la compu (el Panel de
 * Mi cuenta).
 *
 * Aparece sólo cuando se pueden prender desde acá con un toque (estado
 * 'apagado'): con sesión, después del velo de entrada y del perfil completo
 * (eso lo decide App.tsx al montarlo). Ya prendidas, bloqueadas, en un
 * navegador sin push o en el iPhone sin instalar, no sale: no hay nada que
 * el botón pueda hacer. El iPhone sin instalar ya tiene el cartel del inicio.
 *
 * El permiso del navegador se pide SÓLO al tocar "Activar notificaciones",
 * nunca al abrir (iOS lo exige, y pedirlo de entrada es que lo nieguen).
 *
 * "Ahora no" lo guarda en este dispositivo y no vuelve a salir por 7 días.
 * Siempre se pueden activar desde Notificaciones (TarjetaActivarPush).
 */

const CLAVE_POSPUESTO = 'origen_push_pedido_pospuesto';
const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
/** Un respiro después de entrar, para no taparle la pantalla apenas carga. */
const ESPERA_MS = 1500;

/**
 * Donde no sale: la misma página de Notificaciones ya tiene su tarjeta, la
 * de Mi cuenta su interruptor, y el escáner de la puerta es de una mano.
 */
const RUTAS_SIN_PEDIDO = ['/notificaciones', '/perfil', '/panel-eventos/nocturna/acreditar'];

const pospuesto = (): boolean => {
    try {
        const t = Number(localStorage.getItem(CLAVE_POSPUESTO) || 0);
        return t > 0 && Date.now() - t < SIETE_DIAS_MS;
    } catch {
        return false;
    }
};

const PedidoDeNotificaciones: React.FC = () => {
    const { pathname } = useLocation();
    const push = usePushNotifications();
    const [listo, setListo] = useState(false);
    const [cerrado, setCerrado] = useState(pospuesto);
    const [resultado, setResultado] = useState<'ok' | 'error' | null>(null);

    useEffect(() => {
        const t = window.setTimeout(() => setListo(true), ESPERA_MS);
        return () => window.clearTimeout(t);
    }, []);

    const rutaSinPedido = RUTAS_SIN_PEDIDO.some(r => pathname === r || pathname.startsWith(`${r}/`));
    // Una vez abierto se queda hasta que la persona elija, aunque el estado
    // cambie a 'prendido' por el mismo toque (ahí muestra el "Listo").
    const [abierto, setAbierto] = useState(false);
    useEffect(() => {
        if (!abierto && listo && !cerrado && !rutaSinPedido && push.estado === 'apagado') setAbierto(true);
    }, [abierto, listo, cerrado, rutaSinPedido, push.estado]);

    if (!abierto || cerrado) return null;

    const ahoraNo = () => {
        try { localStorage.setItem(CLAVE_POSPUESTO, String(Date.now())); } catch { /* no vuelve hasta recargar */ }
        setCerrado(true);
    };

    // Sin await antes: el pedido de permiso sale directo del toque.
    const activarAhora = async () => {
        setResultado(null);
        const r = await push.activar();
        if (r === 'ok') setResultado('ok');
        // Lo negó en el cartel del navegador: ya eligió, no se insiste.
        else if (r === 'denegado' || r === 'no_soportado') setCerrado(true);
        else setResultado('error');
    };

    const activadas = resultado === 'ok';
    // Cerrar tocando afuera o con Escape cuenta como "Ahora no".
    const cerrar = activadas ? () => setCerrado(true) : ahoraNo;

    return (
        <Panel abierto onCerrar={cerrar} etiqueta="Activar las notificaciones de Origen">
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
                <span
                    aria-hidden="true"
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--mc-chip)' }}
                >
                    <BellRing className="w-6 h-6" strokeWidth={1.9} />
                </span>
                <h2 className="mt-4 mb-0 text-[21px] leading-[1.25] font-semibold tracking-[-.02em] text-balance">
                    {activadas ? 'Listo, ya están activadas' : 'Activá las notificaciones de Origen'}
                </h2>
                <p className="mt-2 mb-0 text-[15px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                    {activadas
                        ? 'Te van a llegar a este dispositivo aunque tengas la app cerrada.'
                        : 'Enterate al momento de lo que pasa con tus grupos, tareas, solicitudes y las novedades de la iglesia, aunque tengas la app cerrada.'}
                </p>
                {!activadas && (
                    <p className="mt-3 mb-0 text-[13.5px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m50)' }}>
                        Si preferís hacerlo más tarde, siempre podés activarlas desde el apartado «Notificaciones».
                    </p>
                )}
                {resultado === 'error' && (
                    <p role="alert" className="mt-3 mb-0 text-[13.5px] font-semibold" style={{ color: 'var(--mc-red)' }}>
                        No pudimos activarlas. Probá de nuevo.
                    </p>
                )}
            </div>

            <div className="mt-6 flex flex-col md:flex-row-reverse gap-2">
                {activadas ? (
                    <BotonPrimario ancho onClick={() => setCerrado(true)}>Listo</BotonPrimario>
                ) : (
                    <>
                        <BotonPrimario ancho className="md:flex-1" onClick={activarAhora} disabled={push.ocupado}>
                            Activar notificaciones
                        </BotonPrimario>
                        <BotonSecundario ancho className="md:flex-1" onClick={ahoraNo} disabled={push.ocupado}>
                            Ahora no
                        </BotonSecundario>
                    </>
                )}
            </div>
        </Panel>
    );
};

export default PedidoDeNotificaciones;
