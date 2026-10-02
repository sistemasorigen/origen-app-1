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
}

export const BarraDeAppContext = createContext<BarraDeAppValue>({
    barraOculta: false,
    setBarraOculta: () => { },
});

/** Se llama desde la pantalla que quiere la barra fuera. */
export const useBarraDeAppOculta = (oculta: boolean = true) => {
    const { setBarraOculta } = useContext(BarraDeAppContext);

    useEffect(() => {
        setBarraOculta(oculta);
        return () => setBarraOculta(false);
    }, [oculta, setBarraOculta]);
};

export const useBarraDeApp = () => useContext(BarraDeAppContext);
