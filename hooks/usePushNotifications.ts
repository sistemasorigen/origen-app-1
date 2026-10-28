import { useCallback, useEffect, useState } from 'react';
import { estadoDeAvisos, type EstadoDeAvisos } from '../components/miCuenta/avisos';
import { activar, desactivar, permisoActual, soportaPush, suscripcionActual, type ResultadoActivar } from '../src/utils/push';

/**
 * Las notificaciones push de ESTE dispositivo, para la pantalla.
 *
 * Antes este hook era la API Notification del navegador (`new
 * Notification()`), que sólo mostraba algo con la pestaña abierta. Ahora los
 * avisos llegan como push del sistema por el service worker
 * (src/utils/push.ts), con la app abierta o cerrada; la notificación local se
 * sacó porque con push activo el aviso salía dos veces.
 *
 * `estado` es null mientras se averigua si hay suscripción (es asíncrono).
 */
export interface UsePushNotifications {
    estado: EstadoDeAvisos | null;
    ocupado: boolean;
    activar: () => Promise<ResultadoActivar>;
    desactivar: () => Promise<boolean>;
    refrescar: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotifications {
    const [estado, setEstado] = useState<EstadoDeAvisos | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const refrescar = useCallback(async () => {
        const suscripto = !!(await suscripcionActual());
        setEstado(estadoDeAvisos(soportaPush(), permisoActual(), suscripto));
    }, []);

    useEffect(() => {
        refrescar();
        // Si la persona cambia el permiso en los ajustes y vuelve, que se vea.
        const alVolver = () => { if (document.visibilityState === 'visible') refrescar(); };
        document.addEventListener('visibilitychange', alVolver);
        return () => document.removeEventListener('visibilitychange', alVolver);
    }, [refrescar]);

    // Sin await antes de activar(): el pedido de permiso tiene que salir
    // directo del toque.
    const prender = useCallback(async () => {
        setOcupado(true);
        const r = await activar();
        await refrescar();
        setOcupado(false);
        return r;
    }, [refrescar]);

    const apagar = useCallback(async () => {
        setOcupado(true);
        const r = await desactivar();
        await refrescar();
        setOcupado(false);
        return r;
    }, [refrescar]);

    return { estado, ocupado, activar: prender, desactivar: apagar, refrescar };
}
