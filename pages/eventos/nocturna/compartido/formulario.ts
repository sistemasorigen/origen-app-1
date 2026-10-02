import { NocturnaJovenPayload, NocturnaPayload, NocturnaRetiro, NocturnaTribu } from '../../../../types';
import { aplicarRetiroFamiliar, calcularEdad, edadEnElEvento, edadHabilitada, esMayorDeEdad } from '../../../../src/utils/nocturna';

/**
 * El modelo del formulario de Nocturna, compartido entre la inscripción
 * pública y la carga del panel.
 *
 * Lo que vive acá es lo que NO puede divergir entre las dos pantallas: qué
 * campos hay, cuándo están completos, qué textos se firman y cómo se arma el
 * payload que va a la base. Si mañana cambia una regla, cambia en un lugar.
 *
 * Lo que NO vive acá son los campos dibujados. La pública es un flujo de seis
 * pasos en el celular y la del panel es una sola página pensada para cargar
 * varias seguidas con el tabulador: forzar los dos a compartir el mismo JSX
 * haría que cada cambio de una rompa la otra. Lo que importa que esté unificado
 * —las reglas— está acá.
 */

// ── Lo que se firma ───────────────────────────────────────────────────────
// Una sola constante. Si cambian los textos de abajo, sube la versión y queda
// registrado qué firmó cada familia.
export const VERSION_DECLARACIONES = 'nocturna-2026-v1';

export const TEXTO_AUTORIZACION =
    'Declaro que soy el padre / madre / tutor o encargado del menor cuya entrada se está adquiriendo y que autorizo al mismo a participar del evento "Nocturna" realizado por Origen Iglesia, en Av. Eva Perón 3932, con horario de comienzo el día 30 de octubre de 2026 a las 11pm y finalizando el día 31 de octubre de 2026 a las 6am.';

export const TEXTO_FOTOS =
    'Te informamos que durante el evento se tomarán fotografías y grabaciones de video de las distintas actividades. Este material será utilizado exclusivamente por Origen Iglesia con fines de difusión, comunicación y registro informativo en nuestros canales oficiales (redes sociales, sitio web y material impreso de la iglesia).';

export const TRIBUS: NocturnaTribu[] = ['Trueno', 'Garra', 'Sin tribu'];

/** Color por tribu, para los puntitos de la planilla. */
export const COLOR_TRIBU: Record<string, string> = {
    Trueno: '#2563eb',
    Garra: '#c2410c',
    'Sin tribu': '#9a9a95',
};

// ── El estado del formulario ──────────────────────────────────────────────

export interface AdultoForm {
    nombre: string;
    apellido: string;
    dni: string;
    email: string;
    /** 'YYYY-MM-DD'. */
    nac: string;
}

export interface ChicoForm {
    /**
     * La clave de la lista de React. En un chico nuevo es un UUID inventado
     * acá; en uno cargado de la base, el suyo.
     */
    id: string;
    /**
     * Si esta fila ya existe en la base.
     *
     * Hace falta porque un chico nuevo también lleva un UUID: sin esta
     * marca, el id inventado por el navegador viajaría como si fuera de la
     * base y la RPC lo rechazaría por no pertenecer a la inscripción.
     */
    existente?: boolean;
    nombre: string;
    apellido: string;
    dni: string;
    nac: string;
    tribu: NocturnaTribu | '';
}

export interface OtroForm {
    nombre: string;
    apellido: string;
    dni: string;
    telefono: string;
}

export const ADULTO_VACIO: AdultoForm = { nombre: '', apellido: '', dni: '', email: '', nac: '' };
export const OTRO_VACIO: OtroForm = { nombre: '', apellido: '', dni: '', telefono: '' };

// ── Validación ────────────────────────────────────────────────────────────
// Es ayuda visual: la base valida todo de nuevo. Pero tiene que coincidir en
// las dos pantallas, o el staff y el público ven reglas distintas.

/**
 * Mínimo de dígitos de un DNI.
 *
 * Seis y no siete: los documentos más viejos tienen seis cifras y hay abuelos
 * que anotan a sus nietos. Pedir siete los dejaría afuera.
 */
export const DNI_MINIMO = 6;

export const soloDigitos = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

/** Qué le falta a un chico, en palabras, para poder decírselo a la persona. */
export const faltanDelChico = (c: ChicoForm): string[] => {
    const f: string[] = [];
    if (!c.nombre.trim()) f.push('nombre');
    if (!c.apellido.trim()) f.push('apellido');
    if (c.dni.trim().length < DNI_MINIMO) f.push('DNI');
    if (!c.nac || calcularEdad(c.nac) === null) f.push('fecha de nacimiento');
    if (!c.tribu) f.push('tribu');
    return f;
};

/**
 * Si el chico queda afuera por edad.
 *
 * Separado de `faltanDelChico` a propósito: no es un dato que falte, es un
 * dato que ya está y no cumple la regla. El mensaje también es otro.
 */
export const chicoFueraDeEdad = (c: ChicoForm): boolean =>
    !!c.nac && calcularEdad(c.nac) !== null && !edadHabilitada(c.nac);

/** La edad que va a tener en el evento, para poder decírselo con el número. */
export const edadDelChicoEnElEvento = (c: ChicoForm): number | null =>
    c.nac ? edadEnElEvento(c.nac) : null;

export const adultoEsMenorDeEdad = (a: AdultoForm): boolean =>
    !!a.nac && calcularEdad(a.nac) !== null && !esMayorDeEdad(a.nac);

export const adultoCompleto = (a: AdultoForm): boolean =>
    !!a.nombre.trim() && !!a.apellido.trim() && a.dni.trim().length >= DNI_MINIMO
    && !!a.email.trim() && !!a.nac && calcularEdad(a.nac) !== null && !adultoEsMenorDeEdad(a);

export const chicosCompletos = (chicos: ChicoForm[]): boolean =>
    chicos.length > 0
    && chicos.every(c => faltanDelChico(c).length === 0 && !chicoFueraDeEdad(c));

/** El retiro de la familia, con los datos del tercero si corresponde. */
export const retiroCompleto = (
    seRetiranSolos: boolean | null,
    quien: 'yo' | 'otro' | null,
    otro: OtroForm,
): boolean => {
    if (seRetiranSolos === true) return true;
    if (seRetiranSolos !== false) return false;
    if (quien === 'yo') return true;
    if (quien !== 'otro') return false;
    return !!otro.nombre.trim() && !!otro.apellido.trim()
        && otro.dni.trim().length >= DNI_MINIMO && otro.telefono.trim().length >= 6;
};

// ── Armado del payload ────────────────────────────────────────────────────

export const retiroDesdeElFormulario = (
    seRetiranSolos: boolean | null,
    quien: 'yo' | 'otro' | null,
    otro: OtroForm,
): NocturnaRetiro => {
    if (seRetiranSolos === true) return { tipo: 'solo' };
    if (quien === 'otro') {
        return {
            tipo: 'otra_persona',
            nombre: otro.nombre.trim(),
            apellido: otro.apellido.trim(),
            dni: otro.dni.trim(),
            telefono: otro.telefono.trim(),
        };
    }
    return { tipo: 'adulto' };
};

/**
 * Del estado del formulario al payload que esperan `register_nocturna` y
 * `admin_crear_nocturna`.
 *
 * No lleva precio ni total: los calcula la base. El retiro se pregunta una vez
 * y se copia a cada chico con aplicarRetiroFamiliar.
 */
export const armarPayloadNocturna = (opciones: {
    adulto: AdultoForm;
    chicos: ChicoForm[];
    seRetiranSolos: boolean | null;
    quienRetira: 'yo' | 'otro' | null;
    otro: OtroForm;
    autoriza: boolean;
    aceptaFotos: boolean;
    comprobantePath?: string;
}): NocturnaPayload => {
    const { adulto, chicos, seRetiranSolos, quienRetira, otro, autoriza, aceptaFotos, comprobantePath } = opciones;

    const base = chicos.map(c => ({
        // El id sólo viaja si la fila ya existe: es lo que le dice a la base
        // que actualice en el lugar y conserve la acreditación.
        ...(c.existente ? { id: c.id } : {}),
        nombre: c.nombre.trim(),
        apellido: c.apellido.trim(),
        dni: c.dni.trim(),
        fechaNacimiento: c.nac,
        tribu: (c.tribu || 'Sin tribu') as NocturnaTribu,
    }));

    const jovenes: NocturnaJovenPayload[] = aplicarRetiroFamiliar(
        base,
        retiroDesdeElFormulario(seRetiranSolos, quienRetira, otro),
    );

    return {
        adulto: {
            nombre: adulto.nombre.trim(),
            apellido: adulto.apellido.trim(),
            dni: adulto.dni.trim(),
            email: adulto.email.trim(),
            fechaNacimiento: adulto.nac,
        },
        jovenes,
        autorizaAsistencia: autoriza,
        aceptaFotos,
        declaracionesVersion: VERSION_DECLARACIONES,
        ...(comprobantePath ? { comprobantePath } : {}),
    };
};

// ── Texto ─────────────────────────────────────────────────────────────────

export const enLista = (xs: string[]): string => {
    if (xs.length <= 1) return xs[0] || '';
    return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
};

export const plata = (n: number) => `$${n.toLocaleString('es-AR')}`;

/**
 * Para buscar sin que importen las tildes ni las mayúsculas.
 *
 * Quien busca a "Sofía" escribe "sofia", y quien busca a "Nuñez" no sabe si
 * está cargado "Núñez". NFD separa la letra de su tilde y el rango de
 * combinantes la borra.
 */
export const sinTildes = (v: string): string =>
    (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
