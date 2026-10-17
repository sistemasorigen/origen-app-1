import React, { createContext, useContext, useEffect } from 'react';

/**
 * Contrato entre una pantalla y el Layout sobre la barra de arriba.
 *
 * Hermano de HeroContext, y por el mismo motivo: hay pantallas que necesitan
 * decidir cómo se ve la barra de la app, y una lista de rutas en
 * Estructura.tsx no alcanza cuando la misma ruta cambia de modo sin cambiar
 * la URL.
 *
 * El caso que lo trajo es la inscripción a Nocturna: su portada abre con una
 * foto a sangre y el logo encima, donde la barra sobra —serían dos logos
 * centrados, uno arriba del otro—, pero los seis pasos del formulario sí la
 * quieren, fija, para que se vea de quién es el sitio mientras se cargan
 * datos de un menor. Es la misma ruta.
 *
 * Al desmontarse la pantalla el flag se apaga solo, así que nadie puede
 * dejar la barra escondida para el resto de la app sin querer.
 */
interface BarraDeAppValue {
    barraOculta: boolean;
    setBarraOculta: (oculta: boolean) => void;
    barraSuelta: boolean;
    setBarraSuelta: (suelta: boolean) => void;
}

export const BarraDeAppContext = createContext<BarraDeAppValue>({
    barraOculta: false,
    setBarraOculta: () => { },
    barraSuelta: false,
    setBarraSuelta: () => { },
});

/** Se llama desde la pantalla que quiere la barra fuera. */
export const useBarraDeAppOculta = (oculta: boolean = true) => {
    const { setBarraOculta } = useContext(BarraDeAppContext);

    useEffect(() => {
        setBarraOculta(oculta);
        return () => setBarraOculta(false);
    }, [oculta, setBarraOculta]);
};

/**
 * Se llama desde la pantalla que NO quiere la barra pegada al scroll: en vez
 * de seguir al dedo, se queda arriba de todo y se va con el contenido.
 *
 * Es para una pantalla que abre con una portada y la barra montada encima:
 * ahí la barra es parte de esa cabecera, no un elemento de navegación que
 * tenga que estar siempre a mano. Quien la deja suelta se queda sin su
 * atajo al menú mientras scrollea, así que es una decisión de esa pantalla y
 * no de la app: al desmontarse vuelve a pegarse sola.
 */
export const useBarraDeAppSuelta = (suelta: boolean = true) => {
    const { setBarraSuelta } = useContext(BarraDeAppContext);

    useEffect(() => {
        setBarraSuelta(suelta);
        return () => setBarraSuelta(false);
    }, [suelta, setBarraSuelta]);
};

export const useBarraDeApp = () => useContext(BarraDeAppContext);
