/**
 * Lo que cambia solo entre una corrida y otra, y por eso se reemplaza antes de
 * guardar o comparar:
 *
 *  · UUID generados en el navegador (`safeUUID`): el id local de cada chico
 *    en el borrador y el nombre del archivo del comprobante. Se cambian por
 *    `<uuid-1>`, `<uuid-2>`… en orden de aparición, así se sigue viendo QUÉ
 *    id se repite dónde (el mismo chico en dos pasos conserva su número).
 *    Los UUID fijos del Supabase falso (1111…, 2222…) se dejan: no cambian.
 *  · Fechas y horas ISO completas (`2026-10-06T03:12:44.123Z`), por si algún
 *    campo guarda cuándo se hizo algo. Las fechas sin hora (`2012-03-03`) son
 *    datos del formulario y NO se tocan.
 *  · Números de 13 dígitos que parecen `Date.now()`.
 *  · El boundary de un multipart.
 *
 * Nada más se normaliza: si cambia cualquier otra cosa, el golden falla.
 */

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const FIJOS = new Set(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']);
const ISO_CON_HORA = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
const EPOCH_MS = /^1[7-9]\d{11}$/;
const EPOCH_MS_EN_TEXTO = /\b1[7-9]\d{11}\b/g;

export class Normalizador {
    private vistos = new Map<string, string>();

    texto(s: string): string {
        return s
            .replace(UUID, u => {
                const k = u.toLowerCase();
                if (FIJOS.has(k)) return k;
                if (!this.vistos.has(k)) this.vistos.set(k, `<uuid-${this.vistos.size + 1}>`);
                return this.vistos.get(k)!;
            })
            .replace(ISO_CON_HORA, '<fecha-hora>')
            .replace(EPOCH_MS_EN_TEXTO, '<epoch-ms>')
            .replace(/boundary=[^;"\s]+/g, 'boundary=<boundary>');
    }

    /** Recorre el valor: los textos pasan por `texto`, los números con forma de Date.now() se reemplazan. */
    valor<T>(v: T): T {
        const andar = (x: any): any => {
            if (typeof x === 'string') return this.texto(x);
            if (typeof x === 'number') return EPOCH_MS.test(String(x)) ? '<epoch-ms>' : x;
            if (Array.isArray(x)) return x.map(andar);
            if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, y]) => [this.texto(k), andar(y)]));
            return x;
        };
        return andar(v ?? null);
    }
}

/** sessionStorage con los valores JSON abiertos, para que el diff se lea. */
export const abrirStorage = (crudo: Record<string, string>) =>
    Object.fromEntries(Object.entries(crudo).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
        try { return [k, JSON.parse(v)]; } catch { return [k, v]; }
    }));
