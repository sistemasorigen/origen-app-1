import { useEffect, useRef } from 'react';

/**
 * Recordar dónde estaba el scroll de una lista mientras dura la sesión.
 *
 * Hermano de `filtrosRecordados`, y por el mismo motivo: entrar a la ficha de
 * un grupo y volver desmonta el listado. Los filtros ya se recordaban, pero
 * la vista volvía arriba de todo, así que quien venía revisando el grupo
 * número treinta tenía que bajar de nuevo hasta ahí para seguir.
 *
 * Dos cuidados que no son evidentes:
 *
 * 1 · La posición se guarda MIENTRAS se scrollea, no al desmontar. Al navegar
 *     el componente ya no está para leer nada, y el `scrollTo(0, 0)` que hace
 *     App.tsx en cada cambio de ruta llegaría primero.
 *
 * 2 · Restaurar se reintenta durante medio segundo. El listado tarda en tener
 *     alto —las filas se dibujan cuando llegan los datos— y el navegador no
 *     puede bajar hasta donde todavía no hay página. Ese mismo reintento es
 *     lo que le gana al `scrollTo(0, 0)` de App.tsx, que corre después de los
 *     efectos de esta pantalla.
 *
 * Todo va envuelto: en una ventana privada leer o escribir en sessionStorage
 * tira, y perder la posición no puede voltear la pantalla.
 */

const clavePara = (clave: string) => `scroll.${clave}`;

/** Cuántas veces y cada cuánto se intenta volver a la posición guardada. */
const REINTENTOS_MS = [0, 60, 160, 320, 520];

export const useScrollRecordado = (clave: string, listo: boolean): void => {
    const yaRestauro = useRef(false);

    useEffect(() => {
        let pendiente = 0;
        const guardar = () => {
            pendiente = 0;
            try {
                sessionStorage.setItem(clavePara(clave), String(Math.round(window.scrollY)));
            } catch {
                // Sin almacenamiento la lista sigue andando, sólo no recuerda.
            }
        };
        const alScrollear = () => {
            if (pendiente) return;
            pendiente = window.setTimeout(guardar, 150);
        };

        window.addEventListener('scroll', alScrollear, { passive: true });
        return () => {
            if (pendiente) window.clearTimeout(pendiente);
            window.removeEventListener('scroll', alScrollear);
        };
    }, [clave]);

    useEffect(() => {
        if (!listo || yaRestauro.current) return;

        let destino = 0;
        try {
            destino = Number(sessionStorage.getItem(clavePara(clave))) || 0;
        } catch {
            return;
        }

        yaRestauro.current = true;
        if (destino <= 0) return;

        const temporizadores = REINTENTOS_MS.map(ms => window.setTimeout(() => {
            // Ya está donde tiene que estar: no se lo vuelve a empujar, que
            // sería pelearle a quien mientras tanto movió la página.
            if (Math.abs(window.scrollY - destino) < 4) return;
            window.scrollTo({ top: destino, behavior: 'instant' as ScrollBehavior });
        }, ms));

        return () => temporizadores.forEach(t => window.clearTimeout(t));
    }, [clave, listo]);
};
