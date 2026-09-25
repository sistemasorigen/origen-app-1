import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mecánica compartida de las barras de carga con porcentaje.
 *
 * Dos decisiones que salieron de medir, y que son el motivo de que esto sea
 * un hook y no dos copias:
 *
 * 1 · La barra avanza con `transform: scaleX`, que el navegador anima en su
 *     propio hilo. Mientras la app arma una pantalla pesada el hilo
 *     principal se traba, y una barra hecha con `width` se congelaría justo
 *     cuando más importa que se vea viva.
 *
 * 2 · El número se LEE de la barra en vez de llevar su propia cuenta. Así no
 *     pueden contradecirse: si el hilo principal se traba, los dos se traban
 *     juntos, y nunca se ve un 0% al lado de una barra por la mitad.
 *
 * `objetivo` es el techo de la etapa que está corriendo (0-100): la barra se
 * desliza hacia él y frena ahí hasta que llegue el próximo.
 */
export const useBarraDeProgreso = (objetivo: number) => {
    const barra = useRef<HTMLDivElement>(null);
    const [pct, setPct] = useState(0);
    const [arranco, setArranco] = useState(false);

    // Sin un primer cuadro en cero no hay desde dónde animar: la barra
    // aparecería ya llena. Va con setTimeout y no con requestAnimationFrame
    // porque este último no corre en pestañas de fondo ni en algunos
    // webviews, y ahí la barra se quedaría clavada.
    useEffect(() => {
        const id = window.setTimeout(() => setArranco(true), 16);
        return () => window.clearTimeout(id);
    }, []);

    const leerBarra = useCallback(() => {
        const el = barra.current;
        if (!el) return;
        const t = getComputedStyle(el).transform;
        const escala = t && t !== 'none' ? new DOMMatrixReadOnly(t).a : 0;
        setPct(Math.max(0, Math.min(100, Math.round(escala * 100))));
    }, []);

    useEffect(() => {
        const id = window.setInterval(leerBarra, 60);
        return () => window.clearInterval(id);
    }, [leerBarra]);

    // Al cambiar de etapa se lee de inmediato: si el hilo principal viene
    // trabado, el número al menos no se queda colgado del tick anterior.
    useEffect(() => { leerBarra(); }, [objetivo, leerBarra]);

    return {
        /** Va en el div que se escala. */
        barra,
        /** El número, siempre igual a lo que se ve. */
        pct,
        /** Escala para el `transform` del relleno. */
        escala: arranco ? Math.max(0, Math.min(100, objetivo)) / 100 : 0,
    };
};
