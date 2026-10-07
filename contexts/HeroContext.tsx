import React, { createContext, useContext, useEffect } from 'react';

/**
 * Contrato entre una pantalla y el Layout sobre el hero a sangre.
 *
 * Estructura.tsx necesita saber si la pantalla actual abre con un hero que
 * llega al borde superior, porque de eso dependen tres cosas: la navbar
 * arranca transparente, el logo se invierte a blanco, y el contenido sube
 * 64px para meterse debajo de la barra.
 *
 * Antes eso se decidía con una lista de rutas fija. Para `/punto-de-informacion`
 * esa lista no alcanza: la misma ruta renderiza el home público (con hero) o
 * los paneles internos (sin hero, fondo claro), y el modo interno se activa
 * sin cambiar la URL. Con una regla por pathname la navbar quedaría
 * transparente sobre un panel blanco y el logo blanco desaparecería.
 *
 * Acá lo declara la pantalla que efectivamente montó el hero, así que el dato
 * siempre es el real.
 */
/**
 * `'siempre'`: la navbar no recupera su fondo al scrollear. Es para una
 * pantalla que pone su propio fondo detrás de la barra (Nocturna: una franja
 * del mismo rosa), donde el blanco translúcido del scroll quedaría como una
 * franja lavada encima del color.
 */
export type HeroAsangre = boolean | 'siempre';

interface HeroLayoutValue {
    hasFullBleedHero: HeroAsangre;
    setHasFullBleedHero: (active: HeroAsangre) => void;
}

export const HeroLayoutContext = createContext<HeroLayoutValue>({
    hasFullBleedHero: false,
    setHasFullBleedHero: () => { }
});

/**
 * Se llama desde la pantalla que abre con un hero a sangre. Al desmontarse
 * —cambio de ruta, o el mismo componente que pasa a una vista interna— el
 * flag se apaga solo y la navbar recupera su fondo.
 */
export const useFullBleedHero = (active: boolean = true, siempreTransparente: boolean = false) => {
    const { setHasFullBleedHero } = useContext(HeroLayoutContext);

    useEffect(() => {
        setHasFullBleedHero(active && siempreTransparente ? 'siempre' : active);
        return () => setHasFullBleedHero(false);
    }, [active, siempreTransparente, setHasFullBleedHero]);
};

export const useHeroLayout = () => useContext(HeroLayoutContext);
