import { useEffect } from 'react';

/**
 * Impide que el fondo se mueva mientras hay un modal o una hoja abierta.
 *
 * La técnica es la que ya usaban NeoModal y la hoja de inscripción, y es la
 * que funciona en iOS Safari: guardar el scroll, fijar el body con
 * position:fixed y restaurarlo al cerrar. `overflow:hidden` a secas no
 * alcanza ahí — el fondo se sigue moviendo con el dedo.
 *
 * Se cuenta cuántos hay abiertos porque se apilan: una confirmación arriba
 * de un modal, por ejemplo. Sin el contador, cerrar el de arriba devolvía el
 * scroll al fondo mientras el de abajo seguía abierto.
 */

let abiertos = 0;
let scrollGuardado = 0;

const fijar = () => {
    scrollGuardado = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollGuardado}px`;
    document.body.style.width = '100%';
    // Se deja la barra de scroll para que el contenido no salte de ancho.
    document.body.style.overflowY = 'scroll';
    document.body.setAttribute('data-modal-active', 'true');
};

const soltar = () => {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflowY = '';
    document.body.removeAttribute('data-modal-active');
    window.scrollTo({ top: scrollGuardado, behavior: 'instant' as ScrollBehavior });
};

export const useBloqueoDeFondo = (activo: boolean) => {
    useEffect(() => {
        if (!activo) return;

        abiertos += 1;
        if (abiertos === 1) fijar();

        return () => {
            abiertos = Math.max(0, abiertos - 1);
            if (abiertos === 0) soltar();
        };
    }, [activo]);
};

export default useBloqueoDeFondo;
