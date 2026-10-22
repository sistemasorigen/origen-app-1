import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * El modo oscuro de la app.
 *
 * QUÉ HABÍA ANTES. Tailwind está en `darkMode: 'class'` y media app tiene sus
 * variantes `dark:` escritas desde hace rato, pero NADIE prendía la clase:
 * la fila "Modo oscuro" del menú estaba detrás de un `onToggleTheme &&` y ese
 * prop no se pasaba nunca, así que la fila no se dibujaba. Lo único que
 * tocaba el tema era la barra lateral del Punto de Información, que escribe
 * la clase a mano y no la guarda: al recargar volvía a claro.
 *
 * QUÉ HACE ESTO. Es el dueño del tema: aplica la clase, la recuerda y la
 * comparte. Con esto la fila del menú vuelve a existir y el interruptor de
 * Mi cuenta muestra lo mismo que ella.
 *
 * POR QUÉ MIRA EL DOM. La barra del Punto sigue escribiendo la clase por su
 * cuenta, y no se la toca: es su interruptor y funciona. Pero si sólo
 * guardáramos el estado acá, usar ese toggle dejaría al de Mi cuenta
 * mostrando lo contrario de lo que se ve. El observer hace que el estado
 * siga a la clase, venga de donde venga.
 *
 * ARRANCA EN CLARO. Nunca se mira `prefers-color-scheme`: hoy la app abre
 * clara para todo el mundo, y empezar a abrir oscura según el sistema sería
 * cambiarle la app a gente que no pidió nada. Oscuro es una decisión que se
 * toma, y se recuerda.
 */

const CLAVE = 'origen_tema';

interface Tema {
    oscuro: boolean;
    alternar: () => void;
    poner: (oscuro: boolean) => void;
}

const TemaContext = createContext<Tema | null>(null);

const leerGuardado = (): boolean => {
    try {
        return localStorage.getItem(CLAVE) === 'oscuro';
    } catch {
        // Ventana privada o almacenamiento bloqueado: el tema anda igual,
        // sólo que no se recuerda.
        return false;
    }
};

const aplicar = (oscuro: boolean) => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', oscuro);
};

export const ProveedorDeTema: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [oscuro, setOscuro] = useState<boolean>(() => {
        const guardado = leerGuardado();
        aplicar(guardado);
        return guardado;
    });

    const poner = useCallback((valor: boolean) => {
        aplicar(valor);
        setOscuro(valor);
        try { localStorage.setItem(CLAVE, valor ? 'oscuro' : 'claro'); } catch { /* ídem */ }
    }, []);

    const alternar = useCallback(() => { poner(!document.documentElement.classList.contains('dark')); }, [poner]);

    // Si la clase cambia por fuera —la barra del Punto—, el estado la sigue.
    useEffect(() => {
        if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
        const observador = new MutationObserver(() => {
            const ahora = document.documentElement.classList.contains('dark');
            setOscuro(previo => (previo === ahora ? previo : ahora));
        });
        observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observador.disconnect();
    }, []);

    return (
        <TemaContext.Provider value={{ oscuro, alternar, poner }}>
            {children}
        </TemaContext.Provider>
    );
};

/**
 * Sin proveedor devuelve un tema que no hace nada, en vez de reventar: hay
 * pantallas que se montan sueltas en las pruebas.
 */
export const useTema = (): Tema => {
    const ctx = useContext(TemaContext);
    if (ctx) return ctx;
    return {
        oscuro: typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
        alternar: () => { /* sin proveedor no hay tema que alternar */ },
        poner: () => { /* ídem */ },
    };
};

export default TemaContext;
