import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { esIOS } from '../miCuenta/avisos';

/**
 * Arriba de la página de Notificaciones: la invitación a recibirlas también
 * con la app cerrada.
 *
 * El permiso se pide SÓLO cuando se toca "Activar" (nunca al abrir la página).
 * La tarjeta no aparece si ya están activas o si la descartaron (30 días).
 * Cuando no se puede activar desde acá, dice por qué y qué hacer:
 *   · iPhone sin instalar → instalar la app primero (Safari no tiene push).
 *   · permiso bloqueado   → dónde destrabarlo.
 *   · navegador sin push  → qué usar en su lugar.
 *
 * Estética de la página de Notificaciones: Manrope, tarjeta blanca, píldora negra.
 *
 * `enPreferencias` es la misma tarjeta arriba de la hoja de Preferencias: se
 * ve siempre (aunque la hayan pospuesto acá), sin "Ahora no", y con el push ya
 * prendido dice una línea: "Este dispositivo recibe notificaciones".
 */

const CLAVE_POSPUESTA = 'origen_push_tarjeta_pospuesta';
const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

const pospuesta = (): boolean => {
    try {
        const t = Number(localStorage.getItem(CLAVE_POSPUESTA) || 0);
        return t > 0 && Date.now() - t < TREINTA_DIAS_MS;
    } catch {
        return false;
    }
};

const TINTA = 'text-[#0a0a0a] dark:text-[#f4f4f2]';
const M66 = 'text-black/[0.68] dark:text-white/[0.68]';
const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 dark:focus-visible:ring-white/25';
const PRIMARIO = `min-h-[44px] px-5 rounded-full bg-[#0a0a0a] dark:bg-white text-white dark:text-[#0a0a0a] text-[14px] font-semibold active:scale-[0.98] disabled:opacity-50 ${FOCO}`;
const SECUNDARIO = `min-h-[44px] px-5 rounded-full bg-[#f2f2f0] dark:bg-[#2a2a28] text-[14px] font-semibold ${TINTA} ${FOCO}`;

const TarjetaActivarPush: React.FC<{ enPreferencias?: boolean }> = ({ enPreferencias = false }) => {
    const navigate = useNavigate();
    const push = usePushNotifications();
    const [oculta, setOculta] = useState(pospuesta);
    const [noDioPermiso, setNoDioPermiso] = useState(false);
    const [error, setError] = useState(false);
    const idTitulo = useId();

    const { estado } = push;
    if (estado === null) return null;
    if (enPreferencias && estado === 'prendido') {
        return (
            <p className={`m-0 flex items-center gap-2.5 rounded-[18px] bg-[#f7f7f5] dark:bg-[#232321] px-4 py-3 text-[14px] font-semibold ${TINTA}`}>
                <BellRing className="w-[18px] h-[18px] flex-none" strokeWidth={1.9} aria-hidden="true" />
                Este dispositivo recibe notificaciones
            </p>
        );
    }
    if ((oculta && !enPreferencias) || estado === 'prendido') return null;

    const ahoraNo = () => {
        try { localStorage.setItem(CLAVE_POSPUESTA, String(Date.now())); } catch { /* se oculta hasta recargar */ }
        setOculta(true);
    };

    // Sin await antes: el pedido de permiso sale directo del toque.
    const activarAhora = async () => {
        setError(false);
        const r = await push.activar();
        if (r === 'denegado') setNoDioPermiso(true);
        else if (r === 'error') setError(true);
    };

    const titulo = estado === 'iphone' ? 'En iPhone, primero instalá la app en tu inicio'
        : estado === 'bloqueado' ? 'Las notificaciones están bloqueadas en este dispositivo'
            : estado === 'no_soportado' ? 'Este navegador no permite notificaciones'
                : 'Activá las notificaciones para enterarte aunque tengas la app cerrada';

    const texto = estado === 'iphone'
        ? 'Safari no puede mostrar notificaciones. Instalada en tu pantalla de inicio, Origen sí.'
        : estado === 'bloqueado'
            ? (esIOS()
                ? 'Para prenderlas: Ajustes del iPhone → Notificaciones → Origen → Permitir notificaciones.'
                : 'Para prenderlas: mantené apretado el ícono de Origen → Información de la app → Notificaciones. Si la usás en Chrome, tocá el candado de la dirección → Permisos → Notificaciones.')
            : estado === 'no_soportado'
                ? 'Probá con Chrome, o instalá Origen en tu pantalla de inicio.'
                : 'Te avisamos de tus grupos, tareas y solicitudes al momento, aunque no tengas Origen abierta.';

    return (
        <section
            aria-labelledby={idTitulo}
            className={enPreferencias
                ? `p-4 rounded-[20px] bg-[#f7f7f5] dark:bg-[#232321] ${TINTA}`
                : `mt-[22px] p-[18px] rounded-[22px] bg-white dark:bg-[#1b1b1a] shadow-[0_1px_3px_rgba(0,0,0,.04)] dark:shadow-none ${TINTA}`}
        >
            <div className="flex items-start gap-3.5">
                <span aria-hidden="true" className="w-10 h-10 flex-none rounded-full flex items-center justify-center bg-[#f2f2f0] dark:bg-[#2a2a28]">
                    <BellRing className="w-[19px] h-[19px]" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                    <h2 id={idTitulo} className="m-0 text-[15.5px] leading-snug font-semibold text-pretty">{titulo}</h2>
                    <p className={`mt-1 mb-0 text-[13.5px] leading-[1.5] font-medium text-pretty ${M66}`}>{texto}</p>
                    {noDioPermiso && (
                        <p role="alert" className="mt-2 mb-0 text-[13.5px] font-semibold">
                            No diste permiso. Podés cambiarlo cuando quieras desde Mi cuenta.
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="mt-2 mb-0 text-[13.5px] font-semibold">No pudimos activarlas. Probá de nuevo.</p>
                    )}
                </div>
            </div>

            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                {!enPreferencias && <button type="button" onClick={ahoraNo} className={SECUNDARIO}>Ahora no</button>}
                {estado === 'apagado' && (
                    <button type="button" onClick={activarAhora} disabled={push.ocupado} className={PRIMARIO}>
                        Activar
                    </button>
                )}
                {estado === 'iphone' && (
                    <button type="button" onClick={() => navigate('/perfil/instalar')} className={PRIMARIO}>
                        Ver cómo instalarla
                    </button>
                )}
            </div>
        </section>
    );
};

export default TarjetaActivarPush;
