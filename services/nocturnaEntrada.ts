import { supabase } from './supabaseClient';

/**
 * Lo que necesita /nocturna-entrada, y nada más.
 *
 * Las tres funciones de abajo son las únicas puertas a los datos de una
 * inscripción desde una pantalla pública: no hay SELECT directo, porque `anon`
 * no tiene lectura sobre ninguna tabla de Nocturna. Del otro lado están las
 * RPC de sql/nocturna_chequear_entrada.sql, que son SECURITY DEFINER y
 * devuelven lo mínimo.
 *
 * Los errores no se reinterpretan: el motivo lo decide la base y la pantalla
 * lo traduce a una frase. Lo único que se agrega acá es `sin_conexion`, que es
 * lo que pasa cuando el pedido ni siquiera llegó.
 */

/**
 * Un teléfono argentino llevado a sus 10 dígitos, o null si todavía no llega.
 *
 * Es la MISMA lógica que nocturna_normalizar_telefono() en la base y que
 * normalizarArgentino() de reportesPuntoInfo.ts. Que las tres coincidan es el
 * punto: si la pantalla acepta algo que la base rechaza, la familia escribe un
 * número bien y recibe un error que no entiende.
 *
 * Devuelve null —y no un recorte— mientras el número no resuelva. Recortar a
 * 10 dígitos apenas se llega a 10 era el error de antes: quien escribe el
 * formato viejo (011 15 5111 2233) pierde los últimos dígitos justo antes de
 * que el 15 se pueda reconocer, y el número queda corrido.
 */
export const normalizarTelefono = (crudo: string): string | null => {
    let n = (crudo || '').replace(/\D/g, '');
    if (!n) return null;

    if (n.startsWith('0054')) n = n.slice(4);
    if (n.startsWith('54')) n = n.slice(2);
    if (n.startsWith('9')) n = n.slice(1);
    if (n.startsWith('0')) n = n.slice(1);

    // El 15 va DESPUÉS del código de área: 11 15 5555 0000.
    const con15 = /^(\d{2,4})15(\d{6,8})$/.exec(n);
    if (con15) n = con15[1] + con15[2];

    return /^\d{10}$/.test(n) ? n : null;
};

/** Los dígitos que la pantalla deja escribir, antes de normalizar. */
export const soloDigitos = (crudo: string): string => (crudo || '').replace(/\D/g, '').slice(0, 14);

/** Los motivos que puede devolver la base, más el que pone el navegador. */
export type MotivoNocturna =
    | 'formato'
    | 'bloqueado'
    | 'no_existe'
    | 'otra_edicion'
    | 'dni'
    | 'telefono'
    | 'sin_conexion'
    | 'desconocido';

export interface JovenDeLaEntrada {
    id: string;
    nombre: string;
}

export interface FaltantesDeLaEntrada {
    adultoTelefono: boolean;
    jovenesSinTelefono: string[];
}

export interface EntradaNocturna {
    /** Lo que lleva el QR, igual que la entrada que sale al inscribirse. */
    id: string;
    codigo: string;
    /** "María G.": nombre y la inicial del apellido. */
    adulto: string;
    jovenes: JovenDeLaEntrada[];
    faltantes: FaltantesDeLaEntrada;
}

/**
 * Una sola forma con campos opcionales, y no una union discriminada: el
 * tsconfig del proyecto no tiene `strict`, y sin strictNullChecks TypeScript
 * no estrecha `{ok:true}|{ok:false}` por el `if (!r.ok)`. Es la misma forma
 * que ya devuelve supabaseService.
 */
export interface Resultado<T> {
    ok: boolean;
    datos?: T;
    motivo?: MotivoNocturna;
    /** Sólo con motivo 'bloqueado'. */
    segundos?: number;
    /** Sólo con motivo 'telefono': 'adulto' o el id del adolescente. */
    campo?: string;
}

const falla = <T>(motivo: MotivoNocturna, extra?: { segundos?: number; campo?: string }): Resultado<T> =>
    ({ ok: false, motivo, ...extra });

/**
 * Llama una RPC y devuelve su jsonb.
 *
 * Un error de red y un error de la base se separan a propósito: "no llegué a
 * preguntar" y "pregunté y me dijeron que no" se arreglan de maneras
 * distintas, y la pantalla ofrece reintentar sólo en el primero.
 */
const llamar = async (nombre: string, args: Record<string, unknown>): Promise<any | null> => {
    try {
        const { data, error } = await supabase.rpc(nombre, args);
        if (error) {
            // Sin filas ni argumentos: los argumentos llevan el código y los 3
            // dígitos del DNI.
            console.error(`[NocturnaEntrada] ${nombre}:`, error.message);
            return null;
        }
        return data;
    } catch (err) {
        console.error(`[NocturnaEntrada] ${nombre}: sin respuesta`);
        return null;
    }
};

const motivoDe = (data: any): MotivoNocturna => {
    const m = data?.motivo;
    const conocidos: MotivoNocturna[] = ['formato', 'bloqueado', 'no_existe', 'otra_edicion', 'dni', 'telefono'];
    return conocidos.includes(m) ? m : 'desconocido';
};

/** Paso 1: ¿existe este código? Devuelve el nombre de pila del adulto. */
export const chequearCodigo = async (codigo: string): Promise<Resultado<{ nombre: string }>> => {
    const data = await llamar('nocturna_chequear_codigo', { p_codigo: codigo });
    if (data === null) return falla('sin_conexion');
    if (data?.ok) return { ok: true, datos: { nombre: String(data.nombre || '') } };
    return falla(motivoDe(data), { segundos: data?.segundos });
};

const aEntrada = (data: any): EntradaNocturna => ({
    id: String(data.id),
    codigo: String(data.codigo),
    adulto: String(data.adulto || ''),
    jovenes: (data.jovenes || []).map((j: any) => ({ id: String(j.id), nombre: String(j.nombre || '') })),
    faltantes: {
        adultoTelefono: !!data?.faltantes?.adulto_telefono,
        jovenesSinTelefono: (data?.faltantes?.jovenes_sin_telefono || []).map((x: any) => String(x)),
    },
});

/** Paso 2: con los últimos 3 del DNI, la entrada. */
export const verEntrada = async (codigo: string, dni3: string): Promise<Resultado<EntradaNocturna>> => {
    const data = await llamar('nocturna_ver_entrada', { p_codigo: codigo, p_dni3: dni3 });
    if (data === null) return falla('sin_conexion');
    if (data?.ok) return { ok: true, datos: aEntrada(data) };
    return falla(motivoDe(data), { segundos: data?.segundos });
};

/**
 * Paso 3: completar los teléfonos que falten.
 *
 * Se mandan sólo los que la familia escribió. La base vuelve a decidir qué
 * falta: lo que devuelve es el estado real, no lo que esta pantalla cree.
 */
export const completarDatos = async (
    codigo: string,
    dni3: string,
    adultoTelefono: string | null,
    jovenes: Array<{ id: string; telefono: string }>,
): Promise<Resultado<FaltantesDeLaEntrada>> => {
    const data = await llamar('nocturna_completar_datos', {
        p_codigo: codigo,
        p_dni3: dni3,
        p_adulto_telefono: adultoTelefono || null,
        p_jovenes: jovenes.map(j => ({ id: j.id, telefono: j.telefono })),
    });
    if (data === null) return falla('sin_conexion');
    if (data?.ok) {
        return {
            ok: true,
            datos: {
                adultoTelefono: !!data?.faltantes?.adulto_telefono,
                jovenesSinTelefono: (data?.faltantes?.jovenes_sin_telefono || []).map((x: any) => String(x)),
            },
        };
    }
    return falla(motivoDe(data), { segundos: data?.segundos, campo: data?.campo });
};
