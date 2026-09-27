/**
 * Recordar los filtros de una lista mientras dura la sesión.
 *
 * Las listas del panel guardan sus filtros en estado local, así que entrar a
 * la ficha de un grupo y volver desmonta el componente y los pierde: quien
 * había buscado "Mujer pro" vuelve al listado completo y tiene que tipear de
 * nuevo para retomar donde estaba.
 *
 * Va en sessionStorage y no en localStorage a propósito: "dónde estaba" es
 * algo de este rato, no de siempre. Mañana el panel abre limpio.
 *
 * No hay estado escondido: lo recordado se ve escrito en el buscador y en las
 * píldoras, y "Limpiar los filtros" lo borra como cualquier otro cambio.
 *
 * Todo va envuelto: en una ventana privada, o con el almacenamiento del sitio
 * bloqueado, leer o escribir tira, y perder los filtros no puede voltear la
 * pantalla.
 */

export const leerFiltros = <T extends object>(clave: string, porDefecto: T): T => {
    try {
        const crudo = sessionStorage.getItem(clave);
        if (!crudo) return porDefecto;
        const guardado = JSON.parse(crudo);
        if (!guardado || typeof guardado !== 'object') return porDefecto;
        // Sólo se aceptan las claves que el llamador declaró: si el día de
        // mañana se saca un filtro, lo viejo guardado no revive.
        const limpio = { ...porDefecto };
        for (const k of Object.keys(porDefecto) as (keyof T)[]) {
            if (k in guardado) limpio[k] = guardado[k];
        }
        return limpio;
    } catch {
        return porDefecto;
    }
};

export const guardarFiltros = (clave: string, valor: object): void => {
    try {
        sessionStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        // Sin almacenamiento la lista sigue funcionando, sólo no recuerda.
    }
};
