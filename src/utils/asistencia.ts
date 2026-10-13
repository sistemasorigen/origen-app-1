/**
 * Quién estaba en el grupo en una fecha dada.
 *
 * La asistencia se tomaba contra el padrón de HOY: quien entró en la semana 6
 * figuraba ausente en las cinco reuniones anteriores, a las que no estaba
 * invitado. Acá vive la regla que lo corrige, en un solo lugar, porque la usan
 * la planilla del anfitrión y los reportes.
 *
 * El dato es `approved_at`, que pone la base sola (ver sql/asistencia_padron.sql).
 * NO se usa `timestamp` como respaldo: el backfill ya volcó ahí lo mejor que
 * había, así que un approved_at vacío significa "estaba desde siempre" y no
 * "no sabemos".
 */

/** Todo se compara en hora de acá. En UTC, a las 21:00 ya es mañana. */
export const ZONA_ARG = 'America/Argentina/Buenos_Aires';

/**
 * El día en que la inscripción quedó aprobada, como 'YYYY-MM-DD' argentino.
 *
 * Acepta la fila cruda (`approved_at`) y la mapeada (`approvedAt`): según por
 * dónde venga, la app la entrega de una forma o de la otra.
 *
 * `null` = sin fecha, que se lee como "desde siempre".
 */
export const fechaDeIngreso = (reg: any): string | null => {
    const bruto = reg?.approved_at ?? reg?.approvedAt ?? null;
    if (!bruto) return null;
    const d = new Date(bruto);
    if (Number.isNaN(d.getTime())) return null;
    // 'en-CA' da YYYY-MM-DD, que es como viajan las fechas de reunión.
    return d.toLocaleDateString('en-CA', { timeZone: ZONA_ARG });
};

/** ¿Esta inscripción ya estaba en el grupo esa fecha? */
export const estabaEnLaFecha = (reg: any, fecha: string): boolean => {
    if (String(reg?.status ?? '').toUpperCase() !== 'APPROVED') return false;
    const ingreso = fechaDeIngreso(reg);
    // Dos 'YYYY-MM-DD' se comparan como texto: el orden alfabético y el
    // cronológico son el mismo.
    return ingreso === null || ingreso <= fecha;
};

/**
 * Los ids con los que esta inscripción aparece en una lista de presentes.
 *
 * Una fila puede ser dos personas: la pareja va como "<id>-partner", que es la
 * forma que ya usa toda la app.
 */
export const idsDeInscripcion = (reg: any): string[] => {
    const id = String(reg?.id ?? '');
    if (!id) return [];
    const pareja = reg?.partnerData ?? reg?.partner_data ?? null;
    return pareja ? [id, `${id}-partner`] : [id];
};

/**
 * El padrón de una reunión: a quiénes les tocaba estar.
 *
 * Es el denominador de todo porcentaje de asistencia de la app. Manda la foto
 * que la base congeló esa noche (`expected_members`), que es la única que
 * sobrevive a una baja —la baja BORRA la inscripción— y la única que no se
 * mueve cuando el grupo crece.
 *
 * El respaldo sólo corre si esa reunión no tiene foto, que hoy son las
 * anteriores a sql/asistencia_padron.sql: se reconstruye con quienes estaban
 * aprobados esa fecha, más los presentes, para que el porcentaje nunca pase
 * del 100%.
 */
export const padronDeReunion = (
    fila: any,
    inscripcionesDelGrupo: any[],
): Set<string> => {
    const presentes: string[] = (fila?.present_members ?? fila?.presentMembers ?? []).map(String);
    const foto = fila?.expected_members ?? fila?.expectedMembers ?? null;

    if (Array.isArray(foto)) return new Set<string>(foto.map(String));

    const fecha = String(fila?.date ?? fila?.fecha ?? '');
    const padron = new Set<string>(presentes);
    (inscripcionesDelGrupo || []).forEach(r => {
        if (!estabaEnLaFecha(r, fecha)) return;
        idsDeInscripcion(r).forEach(id => padron.add(id));
    });
    return padron;
};

/** ¿A esta persona le tocaba esa reunión? */
export const leTocaba = (idAsistencia: string, padron: Set<string>): boolean =>
    padron.has(String(idAsistencia));
