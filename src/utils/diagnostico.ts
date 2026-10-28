import { estaInstalada, NOMBRE_PLATAFORMA, plataforma } from './instalacion';

/**
 * Un registro chico de lo que le pasa a la app en ESTE aparato.
 *
 * Existe para un problema que no se reproduce en la compu: en el iPhone, con
 * la app agregada al inicio, después de un deploy "deja de andar". Desde acá
 * no se ve qué pasó. Con esto, la persona copia el registro desde Mi cuenta →
 * Sobre la app y lo manda por WhatsApp.
 *
 * Reglas:
 *   · Vive en localStorage (sobrevive a la recarga, que es justo el momento
 *     que interesa) y todo va envuelto: sin storage, no se registra y listo.
 *   · Tope de 30 entradas; la más vieja sale. Dos entradas iguales seguidas se
 *     juntan en una con un contador, así la revisión de cada minuto y medio no
 *     empuja afuera lo que importa.
 *   · CERO DATOS PERSONALES. Ni emails, ni nombres, ni ids, ni URLs con
 *     parámetros. Todo texto pasa por `limpiar` antes de guardarse, incluidos
 *     los mensajes de error, que a veces traen un email o un id adentro.
 *
 * El script de index.html que reintenta cuando el bundle no carga (error de
 * MIME) escribe en esta misma clave y con esta misma forma, porque corre
 * antes de que exista este módulo. Si se cambia la forma, cambiarla allá.
 */

declare const __BUILD_VERSION__: string;
declare const __BUILD_TIME__: string;

export type TipoDeEvento =
    | 'arranque'      // se cargó la app
    | 'revision'      // se preguntó por la versión publicada
    | 'cartel'        // apareció el cartel de versión nueva
    | 'recarga'       // se pidió recargar (cartel o "Recargar app")
    | 'resultado'     // qué versión trajo esa recarga
    | 'volvio'        // la app volvió del segundo plano después de un rato
    | 'error'         // window.onerror
    | 'promesa'       // unhandledrejection
    | 'mime'          // el bundle no cargó (lo anota index.html)
    | 'push';         // notificaciones push: permiso, suscripción, errores

export interface EventoDiagnostico {
    t: number;
    tipo: TipoDeEvento;
    detalle: string;
    /** Cuántas veces seguidas pasó lo mismo. Sin valor: una. */
    n?: number;
}

const CLAVE = 'origen_diagnostico';
const CLAVE_ULTIMA_REVISION = 'origen_diagnostico_revision';
const TOPE = 30;
const LARGO_MAXIMO = 160;

/**
 * Saca de un texto todo lo que pueda identificar a alguien.
 *
 * Por qué cada regla: un error de Supabase puede citar el email o el id de la
 * fila; una URL puede traer ?codigo= o un token; un número largo puede ser un
 * DNI o un teléfono. El hash de la versión es hex de 7 caracteres y no llega
 * al patrón de números largos.
 */
export const limpiar = (texto: unknown): string => {
    let s = typeof texto === 'string' ? texto : String(texto ?? '');
    s = s
        .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
        .replace(/\beyJ[\w-]+\.[\w-]+(\.[\w-]+)?/g, '[token]')
        // URL: queda el camino, sin ?parámetros ni #fragmento.
        .replace(/(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g, '$1')
        .replace(/[?#][\w%-]+=[^\s"']*/g, '')
        .replace(/\d{6,}/g, '[número]')
        .replace(/\s+/g, ' ')
        .trim();
    return s.length > LARGO_MAXIMO ? `${s.slice(0, LARGO_MAXIMO - 1)}…` : s;
};

export const leerEventos = (): EventoDiagnostico[] => {
    try {
        const crudo = JSON.parse(localStorage.getItem(CLAVE) || '[]');
        return Array.isArray(crudo) ? crudo.filter(e => e && typeof e.t === 'number') : [];
    } catch {
        return [];
    }
};

const oyentes = new Set<() => void>();
/** Para que la pantalla del diagnóstico se actualice si llega algo con ella abierta. */
export const alCambiarDiagnostico = (f: () => void): (() => void) => {
    oyentes.add(f);
    return () => { oyentes.delete(f); };
};

export const registrar = (tipo: TipoDeEvento, detalle: string = ''): void => {
    try {
        const lista = leerEventos();
        const limpio = limpiar(detalle);
        const ultimo = lista[lista.length - 1];
        if (ultimo && ultimo.tipo === tipo && ultimo.detalle === limpio) {
            ultimo.n = (ultimo.n || 1) + 1;
            ultimo.t = Date.now();
        } else {
            lista.push({ t: Date.now(), tipo, detalle: limpio });
        }
        while (lista.length > TOPE) lista.shift();
        localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch { /* sin storage: no se registra */ }
    oyentes.forEach(f => f());
};

export interface UltimaRevision { t: number; resultado: string }

/** La revisión de versión: va al registro y además queda aparte como "la última". */
export const anotarRevision = (resultado: string): void => {
    const limpio = limpiar(resultado);
    try { localStorage.setItem(CLAVE_ULTIMA_REVISION, JSON.stringify({ t: Date.now(), resultado: limpio })); } catch { /* sin storage */ }
    registrar('revision', limpio);
};

export const leerUltimaRevision = (): UltimaRevision | null => {
    try {
        const r = JSON.parse(localStorage.getItem(CLAVE_ULTIMA_REVISION) || 'null');
        return r && typeof r.t === 'number' ? r : null;
    } catch {
        return null;
    }
};

export const borrarDiagnostico = (): void => {
    try {
        localStorage.removeItem(CLAVE);
        localStorage.removeItem(CLAVE_ULTIMA_REVISION);
    } catch { /* sin storage */ }
    oyentes.forEach(f => f());
};

// ── Lo que se muestra y se copia ────────────────────────────────────────

export const versionCorta = (): string =>
    typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__.slice(0, 7) : 'dev';

const pad = (n: number) => String(n).padStart(2, '0');
export const fechaYHora = (t: number, conSegundos = true): string => {
    const d = new Date(t);
    if (isNaN(d.getTime())) return '—';
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}${conSegundos ? `:${pad(d.getSeconds())}` : ''}`;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hora}`;
};

export const momentoDelBuild = (): string => {
    const t = typeof __BUILD_TIME__ === 'string' ? Date.parse(__BUILD_TIME__) : NaN;
    return isNaN(t) ? '—' : fechaYHora(t, false);
};

/**
 * El sistema y su versión, sin el modelo exacto ni nada más fino: alcanza
 * para saber si es un iOS viejo, y no sirve para reconocer a nadie.
 */
export const sistema = (): string => {
    try {
        const ua = navigator.userAgent || '';
        const ios = ua.match(/OS (\d+)[_.](\d+)/);
        if (/iPhone|iPad|iPod/.test(ua) && ios) {
            const nav = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : 'Safari';
            return `iOS ${ios[1]}.${ios[2]} · ${nav}`;
        }
        const android = ua.match(/Android (\d+(\.\d+)?)/);
        if (android) return `Android ${android[1]} · ${/SamsungBrowser/.test(ua) ? 'Samsung Internet' : 'Chrome'}`;
        if (/Edg\//.test(ua)) return 'Edge';
        if (/Chrome\//.test(ua)) return 'Chrome';
        if (/Firefox\//.test(ua)) return 'Firefox';
        if (/Safari\//.test(ua)) return 'Safari';
    } catch { /* sin navigator */ }
    return 'desconocido';
};

export const modo = (): string => (estaInstalada() ? 'instalada' : 'navegador');

export const NOMBRE_DEL_TIPO: Record<TipoDeEvento, string> = {
    arranque: 'Arranque',
    revision: 'Revisión',
    cartel: 'Cartel',
    recarga: 'Recarga',
    resultado: 'Resultado',
    volvio: 'Volvió',
    error: 'Error',
    promesa: 'Error',
    mime: 'No cargó',
    push: 'Push',
};

/** Todo junto, en texto plano, para pegar en WhatsApp. */
export const textoDiagnostico = (): string => {
    const ultima = leerUltimaRevision();
    const lineas = [
        'Diagnóstico de Origen App',
        `Versión: ${versionCorta()} (build ${momentoDelBuild()})`,
        `Modo: ${modo()} · ${NOMBRE_PLATAFORMA[plataforma()]} · ${sistema()}`,
        `Última revisión: ${ultima ? `${fechaYHora(ultima.t)} — ${ultima.resultado}` : 'ninguna'}`,
        `Copiado: ${fechaYHora(Date.now())}`,
        '',
        ...leerEventos().map(e =>
            `${fechaYHora(e.t)} ${NOMBRE_DEL_TIPO[e.tipo] ?? e.tipo}${e.n && e.n > 1 ? ` (×${e.n})` : ''}: ${e.detalle}`),
    ];
    return lineas.join('\n');
};

// ── Al arrancar ─────────────────────────────────────────────────────────

/** El archivo y la línea, sin el dominio ni parámetros. */
const origenDe = (archivo?: string, linea?: number, columna?: number): string => {
    if (!archivo) return '';
    let camino = archivo;
    try { camino = new URL(archivo).pathname; } catch { /* ya era un camino */ }
    return `${camino}${linea ? `:${linea}` : ''}${columna ? `:${columna}` : ''}`;
};

/**
 * Se llama una vez, en index.tsx, antes de montar React: anota el arranque y
 * empieza a escuchar los errores sueltos.
 */
export const iniciarDiagnostico = (): void => {
    registrar('arranque', `versión ${versionCorta()} (build ${momentoDelBuild()}), ${modo()}, ${NOMBRE_PLATAFORMA[plataforma()]}`);

    try {
        window.addEventListener('error', (ev: ErrorEvent) => {
            // Los recursos que no cargan (un <img>, un <script>) también
            // llegan acá, sin mensaje. El del bundle principal ya lo anota
            // index.html; los demás no dicen nada útil.
            if (!ev.message) return;
            const donde = origenDe(ev.filename, ev.lineno, ev.colno);
            registrar('error', donde ? `${ev.message} — ${donde}` : ev.message);
        });
        window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
            const r = ev.reason as { message?: string; name?: string } | undefined;
            const texto = r?.message ? `${r.name && r.name !== 'Error' ? `${r.name}: ` : ''}${r.message}` : String(ev.reason);
            registrar('promesa', texto);
        });
    } catch { /* sin window */ }
};
