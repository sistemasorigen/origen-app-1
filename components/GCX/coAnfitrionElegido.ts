/**
 * Qué guardar del co-anfitrión según cómo se lo eligió.
 *
 * El grupo guarda dos cosas: el vínculo (`co_host_id`) y el nombre
 * desnormalizado (`co_host_first_name` / `co_host_last_name`). Las tarjetas,
 * la hoja de inscripción y el formulario de edición leen el nombre de esas
 * columnas y no del usuario vinculado, así que elegir a alguien del buscador
 * sin escribir el nombre deja un co-anfitrión que no se puede mostrar: el
 * chip del formulario vuelve en blanco y la ficha del grupo lo omite.
 *
 * Es el mismo criterio que PanelGestionAnfitriones ya usaba al asignar un
 * co-anfitrión desde el panel. Acá estaba escrito distinto en cada una de las
 * siete pantallas que montan el formulario, que es como se desincronizó.
 *
 * Devuelve el id con las dos grafías a propósito: insertGroupDirect lee
 * `co_host_id` y el camino de re-apertura lee `coHostId`. La que sobra la
 * ignora cada uno, y así el lugar de llamada es un solo spread en todas.
 */
export const camposDelCoAnfitrion = (
    modo: 'manual' | 'search',
    coHostId: string | null,
    /** Lo que muestra el buscador cuando hay alguien elegido: su `name`. */
    nombreElegido: string,
    /** Lo tipeado a mano en el formulario. */
    manual: { coHostFirstName?: string; coHostLastName?: string },
    /**
     * En modo a mano: el id de la cuenta que coincide con lo escrito, si se
     * encontró una sola y quien carga no la descartó. Vincular también acá es
     * lo que hace que la persona sea co-anfitriona de verdad y no sólo un
     * nombre escrito en la fila del grupo.
     */
    idManual?: string | null,
): {
    co_host_id: string | null;
    coHostId: string | null;
    coHostFirstName: string;
    coHostLastName: string;
} => {
    if (modo === 'manual') {
        return {
            co_host_id: idManual || null,
            coHostId: idManual || null,
            coHostFirstName: manual.coHostFirstName || '',
            coHostLastName: manual.coHostLastName || '',
        };
    }
    // En modo buscador el nombre sólo vale si hay alguien elegido: si no, lo
    // que quedó en el campo es una búsqueda a medio tipear.
    if (!coHostId) {
        return { co_host_id: null, coHostId: null, coHostFirstName: '', coHostLastName: '' };
    }
    const partes = nombreElegido.trim().split(/\s+/);
    return {
        co_host_id: coHostId,
        coHostId,
        coHostFirstName: partes[0] || '',
        coHostLastName: partes.slice(1).join(' '),
    };
};
