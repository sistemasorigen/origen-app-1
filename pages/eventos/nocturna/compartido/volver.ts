/**
 * De dónde vino quien está mirando una inscripción de Nocturna.
 *
 * A la ficha (/panel-eventos/nocturna/:id) se llega desde dos lados: la
 * planilla del panel y el tablero de reportes. El botón de volver tiene que
 * devolver a cada uno al suyo —y al tablero, además, con el orden y la página
 * de la tabla con los que se salió— o se pierde el lugar en una tabla de
 * cuarenta filas.
 *
 * Viaja por la URL y no por `location.state` a propósito: así recargar la
 * ficha, o abrirla en otra pestaña, conserva el origen. El state se pierde en
 * la recarga y el botón quedaría mintiendo.
 *
 * Los parámetros del origen van con prefijo `v` (vorden, vpag, vsec) para que
 * no se mezclen con los de la ficha, y se vuelven a traducir al nombre que
 * usa el tablero al armar la vuelta.
 */

const PANEL = '/panel-eventos/nocturna';
const REPORTES = `${PANEL}/reportes`;

/** Las secciones del tablero a las que se puede volver. */
export type SeccionDeReportes = 'retiros' | 'horarios';

export interface Vuelta {
    /** La ruta completa del botón de volver. */
    destino: string;
    /** Lo que dice el botón chico de la cabecera: "Planilla" o "Reportes". */
    corto: string;
    /** "Volver a la planilla" / "Volver a Reportes". */
    largo: string;
    /**
     * Lo que hay que arrastrar al navegar a otra pantalla de la inscripción
     * (editar, por ejemplo) para no perder el origen. Incluye el '?' o es ''.
     */
    sufijo: string;
}

const DE_LA_PLANILLA: Vuelta = {
    destino: PANEL,
    corto: 'Planilla',
    largo: 'Volver a la planilla',
    sufijo: '',
};

/** Los tres datos del origen, tal como viajan. */
const DEL_ORIGEN = [
    ['vorden', 'orden'],
    ['vpag', 'pagina'],
    ['vsec', 'ver'],
] as const;

/**
 * Lee el origen de una URL de la ficha o de su edición.
 *
 * Sin `volver=reportes` devuelve el de siempre: la planilla, sin arrastrar
 * nada. Es lo que pasa con todos los enlaces que ya existen.
 */
export const vueltaDeLaUrl = (search: string): Vuelta => {
    const q = new URLSearchParams(search);
    if (q.get('volver') !== 'reportes') return DE_LA_PLANILLA;

    const alTablero = new URLSearchParams();
    const propios = new URLSearchParams({ volver: 'reportes' });

    for (const [mio, suyo] of DEL_ORIGEN) {
        const valor = q.get(mio);
        if (!valor) continue;
        alTablero.set(suyo, valor);
        propios.set(mio, valor);
    }

    const cola = alTablero.toString();
    return {
        destino: cola ? `${REPORTES}?${cola}` : REPORTES,
        corto: 'Reportes',
        largo: 'Volver a Reportes',
        sufijo: `?${propios.toString()}`,
    };
};

/**
 * La ruta de un "Ver detalles" del tablero, con el lugar de vuelta adentro.
 */
export const haciaLaFicha = (
    id: string,
    origen: { orden?: string; pagina?: number; seccion?: SeccionDeReportes },
): string => {
    const q = new URLSearchParams({ volver: 'reportes' });
    if (origen.orden) q.set('vorden', origen.orden);
    // La página 0 no se manda: es la de entrada y la URL queda más corta.
    if (origen.pagina) q.set('vpag', String(origen.pagina));
    if (origen.seccion) q.set('vsec', origen.seccion);
    return `${PANEL}/${id}?${q.toString()}`;
};
