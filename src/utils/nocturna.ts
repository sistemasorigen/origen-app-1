import {
    NocturnaEstado,
    NocturnaInscripcion,
    NocturnaJovenPayload,
    NocturnaRetiro,
} from '../../types';

/**
 * Helpers de Nocturna. Nada de base de datos acá: son funciones puras que
 * usan la inscripción pública, el panel y la acreditación por igual.
 */

/**
 * Edad cumplida a partir de 'YYYY-MM-DD'.
 *
 * El parseo es manual a propósito. `new Date('2008-10-01')` se interpreta en
 * UTC, y en Argentina (UTC-3) eso devuelve el día anterior: alguien nacido el
 * 1 de octubre pasa a figurar como del 30 de septiembre. En un calendario de
 * eventos eso es un día corrido; acá es que un chico de 17 pase por mayor de
 * 18 el día de su cumpleaños. Mismo criterio que src/utils/calendario.ts.
 *
 * Devuelve null si la fecha no es válida, no 0: 0 es una edad real.
 */
export const calcularEdad = (fechaNacimiento: string, hoy: Date = new Date()): number | null => {
    if (!fechaNacimiento) return null;

    const partes = fechaNacimiento.slice(0, 10).split('-');
    if (partes.length !== 3) return null;

    const [y, m, d] = partes.map(Number);
    if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;

    // Rebote: new Date(2026, 1, 31) cae en marzo. Si los componentes no
    // sobreviven el viaje, la fecha no existía.
    const nacimiento = new Date(y, m - 1, d);
    if (nacimiento.getFullYear() !== y || nacimiento.getMonth() !== m - 1 || nacimiento.getDate() !== d) {
        return null;
    }

    let edad = hoy.getFullYear() - y;
    const mesHoy = hoy.getMonth() + 1;
    const diaHoy = hoy.getDate();
    // Todavía no cumplió este año.
    if (mesHoy < m || (mesHoy === m && diaHoy < d)) edad--;

    return edad < 0 ? null : edad;
};

/**
 * El día del evento, para medir la edad contra esa fecha y no contra hoy.
 *
 * Entre que abren las inscripciones y Nocturna hay casi un mes, y en ese mes
 * hay chicos que cumplen años: el que cumple 13 el 29 de octubre entra, y el
 * que cumple 19 el 15 no. Medido contra hoy, los dos casos saldrían al revés
 * de lo que va a pasar en la puerta.
 *
 * La misma fecha está en sql/nocturna_edad.sql, que es la validación que de
 * verdad decide. Si el evento se mueve, se cambia en los dos lados.
 */
export const FECHA_DEL_EVENTO = { anio: 2026, mes: 10, dia: 30 };

/** Nocturna es para jóvenes de 13 a 18 años, inclusive. */
export const EDAD_MINIMA = 13;
export const EDAD_MAXIMA = 18;

/** La edad que va a tener esa noche. `null` si la fecha no es válida. */
export const edadEnElEvento = (fechaNacimiento: string): number | null =>
    calcularEdad(
        fechaNacimiento,
        new Date(FECHA_DEL_EVENTO.anio, FECHA_DEL_EVENTO.mes - 1, FECHA_DEL_EVENTO.dia),
    );

/**
 * Si entra en la edad del evento.
 *
 * Con una fecha inválida devuelve true: de las fechas que faltan o no existen
 * ya avisa el formulario por su lado, y no hay que mostrar dos errores por el
 * mismo campo.
 */
export const edadHabilitada = (fechaNacimiento: string): boolean => {
    const edad = edadEnElEvento(fechaNacimiento);
    if (edad === null) return true;
    return edad >= EDAD_MINIMA && edad <= EDAD_MAXIMA;
};

/**
 * Si el adulto responsable llega a los 18.
 *
 * Es ayuda visual nada más: sirve para avisar en el formulario antes de que
 * la persona cargue a sus hijos. La validación que cuenta vive en
 * register_nocturna, en la base, donde el navegador no la puede saltear.
 */
export const esMayorDeEdad = (fechaNacimiento: string, hoy: Date = new Date()): boolean => {
    const edad = calcularEdad(fechaNacimiento, hoy);
    return edad !== null && edad >= 18;
};

/** Aprobado = alguien lo acreditó en la puerta. */
export const estadoInscripcion = (
    insc: Pick<NocturnaInscripcion, 'aprobadoAt'>,
): NocturnaEstado => (insc.aprobadoAt ? 'Aprobado' : 'Inscripto');

/**
 * Cuántos de la familia están acreditados, contando al adulto.
 *
 * Una familia de 3 chicos es "x/4": el adulto también entra, y también se
 * acredita.
 */
export const contarAcreditados = (
    insc: Pick<NocturnaInscripcion, 'adultoAcreditadoAt' | 'jovenes'>,
): { acreditados: number; total: number } => {
    const jovenes = insc.jovenes || [];
    const acreditados =
        (insc.adultoAcreditadoAt ? 1 : 0) + jovenes.filter(j => !!j.acreditadoAt).length;
    return { acreditados, total: 1 + jovenes.length };
};

/**
 * Copia el mismo retiro a todos los chicos.
 *
 * El formulario lo pregunta una sola vez para la familia ("Salen juntos") y
 * la base lo guarda por chico. Esta es la traducción entre las dos cosas.
 */
export const aplicarRetiroFamiliar = (
    jovenes: Omit<NocturnaJovenPayload, 'retiroTipo' | 'retiroNombre' | 'retiroApellido' | 'retiroDni' | 'retiroTelefono'>[],
    retiro: NocturnaRetiro,
): NocturnaJovenPayload[] =>
    jovenes.map(j => ({
        ...j,
        retiroTipo: retiro.tipo,
        // Sólo viajan con 'otra_persona': con los otros dos tipos no hay un
        // tercero, y dejar restos de un cambio de opinión sería engañoso.
        retiroNombre: retiro.tipo === 'otra_persona' ? retiro.nombre : undefined,
        retiroApellido: retiro.tipo === 'otra_persona' ? retiro.apellido : undefined,
        retiroDni: retiro.tipo === 'otra_persona' ? retiro.dni : undefined,
        retiroTelefono: retiro.tipo === 'otra_persona' ? retiro.telefono : undefined,
    }));

/**
 * Achica una foto antes de subirla.
 *
 * El bucket corta en 5 MB y una foto de celular pesa entre 3 y 8: sin esto,
 * buena parte de los comprobantes falla en el último paso de la inscripción,
 * que es el peor momento para perder a alguien.
 *
 * No hay un helper de compresión reusable en el proyecto: cropImage.ts
 * necesita un recorte y sirve para otra cosa.
 *
 * Devuelve el original si ya es chico y no es una imagen rasterizada que
 * convenga recomprimir.
 */
export const comprimirImagen = async (
    file: File,
    maxLado = 1600,
    calidad = 0.8,
): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;

    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return file;

    try {
        const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
        const ancho = Math.round(bitmap.width * escala);
        const alto = Math.round(bitmap.height * escala);

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(bitmap, 0, 0, ancho, alto);

        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', calidad),
        );
        if (!blob) return file;

        // Si comprimir no ayudó —ya venía optimizada— se queda el original.
        if (blob.size >= file.size) return file;

        return new File([blob], 'comprobante.jpg', { type: 'image/jpeg' });
    } finally {
        bitmap.close();
    }
};
