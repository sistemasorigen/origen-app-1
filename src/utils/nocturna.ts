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
 * hay chicos que cumplen años: el que cumple 19 el 15 de octubre ya no entra.
 * Medido contra hoy, saldría al revés de lo que va a pasar en la puerta.
 *
 * La misma fecha está en sql/nocturna_fecha_de_corte.sql, que es la
 * validación que de verdad decide. Si el evento se mueve, se cambia en los
 * dos lados.
 */
export const FECHA_DEL_EVENTO = { anio: 2026, mes: 10, dia: 30 };

/**
 * Quién entra (comunicado oficial del 2026-10-05): nacidos hasta el 1 de
 * junio de 2014 inclusive, con 18 años como máximo el día del evento.
 *
 * Las dos puntas se miden distinto, y a propósito. La de abajo es una FECHA
 * DE NACIMIENTO, no una edad: entra quien nació hasta el 1/6/2014 aunque esa
 * noche tenga 12. La de arriba sí es una edad, la que va a tener esa noche.
 *
 * Las dos están también en sql/nocturna_fecha_de_corte.sql: si cambian, se
 * cambian en los dos lados.
 */
export const NACIDOS_HASTA = { anio: 2014, mes: 6, dia: 1 };
export const EDAD_MAXIMA = 18;

/** La regla dicha para una familia: "Es para …", "Nocturna es para …". */
export const QUIENES_ENTRAN = 'adolescentes nacidos hasta el 1 de junio de 2014, con 18 años como máximo';

/** La edad que va a tener esa noche. `null` si la fecha no es válida. */
export const edadEnElEvento = (fechaNacimiento: string): number | null =>
    calcularEdad(
        fechaNacimiento,
        new Date(FECHA_DEL_EVENTO.anio, FECHA_DEL_EVENTO.mes - 1, FECHA_DEL_EVENTO.dia),
    );

/**
 * Por qué no entra, o null si entra.
 *
 * Con una fecha inválida devuelve null: de las fechas que faltan o no existen
 * ya avisa el formulario por su lado, y no hay que mostrar dos errores por el
 * mismo campo.
 */
export const motivoFueraDeEdad = (
    fechaNacimiento: string,
): { motivo: 'nacio_despues' } | { motivo: 'mas_de_18'; edad: number } | null => {
    const edad = edadEnElEvento(fechaNacimiento);
    if (edad === null) return null;

    // Se compara como número y no como texto: '2014-7-1' es una fecha válida
    // para calcularEdad y, como texto, quedaría antes de '2014-06-01'.
    const [y, m, d] = fechaNacimiento.slice(0, 10).split('-').map(Number);
    const corte = NACIDOS_HASTA.anio * 10000 + NACIDOS_HASTA.mes * 100 + NACIDOS_HASTA.dia;
    if (y * 10000 + m * 100 + d > corte) return { motivo: 'nacio_despues' };

    if (edad > EDAD_MAXIMA) return { motivo: 'mas_de_18', edad };
    return null;
};

/** Si entra en la edad del evento. */
export const edadHabilitada = (fechaNacimiento: string): boolean =>
    motivoFueraDeEdad(fechaNacimiento) === null;

/**
 * El aviso para quien carga a alguien que no entra, o null si entra.
 *
 * Dice el dato que lo deja afuera, no sólo la regla: si la fecha está mal
 * cargada —un 2015 en vez de un 2013—, verla escrita es lo que hace que la
 * familia se dé cuenta. Es el mismo texto que devuelve la base.
 */
export const avisoFueraDeEdad = (fechaNacimiento: string, nombre: string): string | null => {
    const fuera = motivoFueraDeEdad(fechaNacimiento);
    if (!fuera) return null;
    if (fuera.motivo === 'nacio_despues') {
        const [y, m, d] = fechaNacimiento.slice(0, 10).split('-');
        return `Nocturna es para adolescentes nacidos hasta el 1 de junio de 2014. ${nombre} nació el ${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}.`;
    }
    return `Nocturna es hasta los ${EDAD_MAXIMA} años. ${nombre} va a tener ${fuera.edad} el día del evento.`;
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
/**
 * Decodifica la imagen, con plan B.
 *
 * `createImageBitmap` es lo más rápido pero no está en todas partes y falla
 * con archivos que el `<img>` de toda la vida abre sin problema —pasa en
 * Android con algunas galerías—. Si el primero no puede, se prueba el
 * segundo antes de rendirse.
 */
const decodificarImagen = async (
    file: File,
): Promise<ImageBitmap | HTMLImageElement | null> => {
    if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file).catch(() => null);
        if (bitmap) return bitmap;
    }

    return new Promise<HTMLImageElement | null>(resolve => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        const terminar = (valor: HTMLImageElement | null) => {
            URL.revokeObjectURL(url);
            resolve(valor);
        };
        img.onload = () => terminar(img);
        img.onerror = () => terminar(null);
        img.src = url;
    });
};

/**
 * Achica una foto antes de subirla y la deja SIEMPRE en JPEG.
 *
 * Las dos cosas importan por igual:
 *
 *  · El tamaño, porque el bucket corta en 5 MB y una foto de celular pesa
 *    entre 3 y 8.
 *  · El tipo, porque el bucket sólo acepta jpeg, png, webp y heic. Un
 *    Android puede entregar el archivo con el tipo vacío —la galería no se lo
 *    dice al navegador— o como image/heif, y entonces la subida se rechaza
 *    con un error que no le dice nada a nadie. Si se pudo decodificar, se
 *    sube el JPEG que sale del canvas, que siempre es un tipo válido, aunque
 *    pese un poco más que el original.
 *
 * Si no se pudo decodificar, se devuelve el original y que decida quien sube.
 */
export const comprimirImagen = async (
    file: File,
    maxLado = 1600,
    calidad = 0.8,
): Promise<File> => {
    // Ojo: no se mira `file.type` para decidir si vale la pena. En Android
    // viene vacío bastante seguido, y ese era justo el caso que no se podía
    // subir.
    const imagen = await decodificarImagen(file);
    if (!imagen) return file;

    try {
        const anchoOriginal = imagen.width;
        const altoOriginal = imagen.height;
        if (!anchoOriginal || !altoOriginal) return file;

        const escala = Math.min(1, maxLado / Math.max(anchoOriginal, altoOriginal));
        const ancho = Math.max(1, Math.round(anchoOriginal * escala));
        const alto = Math.max(1, Math.round(altoOriginal * escala));

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        // Fondo blanco: un PNG con transparencia sobre JPEG queda negro.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ancho, alto);
        ctx.drawImage(imagen, 0, 0, ancho, alto);

        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', calidad),
        );
        if (!blob || blob.size === 0) return file;

        return new File([blob], 'comprobante.jpg', { type: 'image/jpeg' });
    } catch {
        // Un canvas que se queda sin memoria con una foto enorme no puede
        // dejar a la familia sin inscribirse: sube el original.
        return file;
    } finally {
        if (typeof ImageBitmap !== 'undefined' && imagen instanceof ImageBitmap) imagen.close();
    }
};
