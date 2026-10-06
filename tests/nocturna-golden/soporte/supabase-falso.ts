import type { Page, Route } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Un Supabase falso para la inscripción de Nocturna.
 *
 * TODO lo que sale hacia el proyecto se intercepta acá y se contesta desde el
 * test: ningún pedido llega a la base. Así se puede recorrer la inscripción
 * entera —incluido el envío final— sin crear nada en producción, y comparar
 * byte a byte lo que el formulario manda.
 *
 * Los pedidos que importan para el golden master son los que tocan la
 * inscripción: la config, la búsqueda de inscripción existente, el alta, el
 * agregado de chicos y la subida del comprobante. El resto (app_version, el
 * perfil, la prueba de conexión) se contesta igual, pero queda en `otros` y
 * no se compara: depende del arranque de la app, no del formulario.
 */

export const HOST = 'oqtumgalnozppqnnjjdb.supabase.co';
export const CONFIG = { edicion: 2026, precio_entrada: 40000, inscripciones_abiertas: true };
export const CODIGO_FALSO = 'GLD234';
export const INSCRIPCION_FALSA = '11111111-1111-4111-8111-111111111111';

const REALES = JSON.parse(
    fs.readFileSync(fileURLToPath(new URL('../golden/respuestas-reales.json', import.meta.url)), 'utf8'),
);

/** Las respuestas reales de nocturna_buscar_grupo, grabadas una vez contra la base. */
export const BUSCAR_GRUPO = {
    coincide: REALES.coincide.cuerpo,
    noCoincide: REALES.noCoincide.cuerpo,
    noExiste: REALES.noExiste.cuerpo,
};

export interface Perfil {
    id: string;
    name: string;
    email: string;
    birth_date: string;
    phone?: string;
}

export interface Opciones {
    /** Qué contesta nocturna_buscar_grupo. Por defecto: no existe. */
    buscarGrupo?: (cuerpo: any) => any;
    /** Si hay sesión iniciada, con este perfil. */
    perfil?: Perfil | null;
    config?: typeof CONFIG | null;
}

export interface Pedido {
    tipo: 'config' | 'buscar_grupo' | 'register_nocturna' | 'agregar_jovenes' | 'comprobante';
    metodo: string;
    ruta: string;
    consulta: string;
    cuerpo: any;
}

export interface Registro {
    pedidos: Pedido[];
    otros: string[];
}

const RPC: Record<string, Pedido['tipo']> = {
    nocturna_buscar_grupo: 'buscar_grupo',
    register_nocturna: 'register_nocturna',
    nocturna_agregar_jovenes: 'agregar_jovenes',
};

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD',
    'access-control-expose-headers': 'content-range',
};

const json = (route: Route, cuerpo: unknown, status = 200) =>
    route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });

/**
 * PostgREST devuelve un objeto si se pidió una sola fila (.single /
 * .maybeSingle) y un arreglo si no. Se respeta lo que pide el cliente.
 */
const filas = (route: Route, lista: unknown[]) => {
    const unaSola = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object');
    if (!unaSola) return json(route, lista);
    if (lista.length === 0) {
        return json(route, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }, 406);
    }
    return json(route, lista[0]);
};

/** Partes de un multipart, sin los bytes: el JPEG que sale del canvas no es igual en cada navegador. */
const describirMultipart = (buf: Buffer | null, tipo: string) => {
    if (!buf) return null;
    const texto = buf.toString('latin1');
    const partes = [...texto.matchAll(/Content-Disposition: form-data; name="([^"]*)"(?:; filename="[^"]*")?\r\n(?:Content-Type: ([^\r\n]+)\r\n)?/g)]
        .map(m => ({ nombre: m[1], tipo: m[2] || 'texto' }));
    // No se mira si los bytes son un JPEG: WebKit no expone el cuerpo del
    // archivo dentro de un multipart interceptado, y daba distinto que en
    // Chromium sin que la app hiciera nada distinto. El tipo de la parte sí.
    return { multipart: tipo.startsWith('multipart/'), partes };
};

const tokenFalso = (sub: string) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp })}.firma-falsa`;
};

/** Deja una sesión iniciada en el localStorage, como la dejaría un login real. */
export const iniciarSesionFalsa = async (page: Page, perfil: Perfil) => {
    const sesion = {
        access_token: tokenFalso(perfil.id),
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        refresh_token: 'refresh-falso',
        user: {
            id: perfil.id, aud: 'authenticated', role: 'authenticated', email: perfil.email,
            app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
        },
    };
    await page.addInitScript(([clave, valor]) => {
        if (!window.localStorage.getItem(clave)) window.localStorage.setItem(clave, valor);
    }, [`sb-${HOST.split('.')[0]}-auth-token`, JSON.stringify(sesion)] as const);
};

export const instalarSupabaseFalso = async (page: Page, opciones: Opciones = {}): Promise<Registro> => {
    const registro: Registro = { pedidos: [], otros: [] };
    const perfil = opciones.perfil ?? null;
    const config = opciones.config === undefined ? CONFIG : opciones.config;

    // Realtime: sin servidor del otro lado. La app sigue andando sin él.
    await page.routeWebSocket(/supabase\.co\/realtime/, () => { /* nunca se conecta */ });

    await page.route(`https://${HOST}/**`, async route => {
        const req = route.request();
        const url = new URL(req.url());
        const ruta = url.pathname;
        const metodo = req.method();

        if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

        const anotar = (tipo: Pedido['tipo'], cuerpo: any) =>
            registro.pedidos.push({ tipo, metodo, ruta, consulta: decodeURIComponent(url.search), cuerpo });

        // ── La inscripción ──
        if (ruta === '/rest/v1/nocturna_config') {
            anotar('config', null);
            return filas(route, config ? [config] : []);
        }
        if (ruta.startsWith('/rest/v1/rpc/')) {
            const nombre = ruta.slice('/rest/v1/rpc/'.length);
            const cuerpo = req.postData() ? JSON.parse(req.postData()!) : null;
            const tipo = RPC[nombre];
            if (tipo) anotar(tipo, cuerpo);
            if (nombre === 'nocturna_buscar_grupo') {
                return json(route, (opciones.buscarGrupo || (() => BUSCAR_GRUPO.noExiste))(cuerpo));
            }
            if (nombre === 'register_nocturna') {
                const n = cuerpo?.p_payload?.jovenes?.length || 0;
                return json(route, { ok: true, inscripcion_id: INSCRIPCION_FALSA, codigo_entrada: CODIGO_FALSO, total: n * CONFIG.precio_entrada });
            }
            if (nombre === 'nocturna_agregar_jovenes') {
                const n = cuerpo?.p_payload?.jovenes?.length || 0;
                return json(route, { ok: true, inscripcionId: INSCRIPCION_FALSA, codigoEntrada: CODIGO_FALSO, agregados: n, aPagar: n * CONFIG.precio_entrada, total: (n + 1) * CONFIG.precio_entrada });
            }
            registro.otros.push(`${metodo} ${ruta}`);
            return json(route, null);
        }
        if (ruta.startsWith('/storage/v1/object/nocturna-comprobantes/')) {
            const tipo = req.headers()['content-type'] || '';
            anotar('comprobante', describirMultipart(req.postDataBuffer(), tipo));
            return json(route, { Key: ruta.replace('/storage/v1/object/', ''), Id: '22222222-2222-4222-8222-222222222222' });
        }

        // ── Lo demás: arranque de la app, sesión, perfil ──
        registro.otros.push(`${metodo} ${ruta}`);
        if (ruta === '/auth/v1/user') {
            return perfil
                ? json(route, { id: perfil.id, aud: 'authenticated', role: 'authenticated', email: perfil.email, app_metadata: {}, user_metadata: {} })
                : json(route, { code: 401, msg: 'No autenticado' }, 401);
        }
        if (ruta.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers: CORS });
        if (ruta.startsWith('/auth/v1/')) return json(route, { error: 'falso' }, 400);
        if (ruta === '/rest/v1/users') {
            const porId = url.searchParams.get('id');
            if (perfil && porId === `eq.${perfil.id}`) {
                return filas(route, [{
                    id: perfil.id, name: perfil.name, email: perfil.email, birth_date: perfil.birth_date,
                    phone: perfil.phone || '', role: 'VIEWER', roles: ['VIEWER'], gender: 'Femenino', age: 42,
                    avatar_url: null, is_active: true,
                }]);
            }
            return filas(route, []);
        }
        // Como en producción, app_version tiene su fila (se lee con .single()).
        // Fecha vieja: así no aparece el aviso de "hay una versión nueva".
        if (ruta === '/rest/v1/app_version') {
            return filas(route, [{ version: 'referencia', updated_at: '2000-01-01T00:00:00Z' }]);
        }
        if (metodo === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': '*/0' } });
        if (metodo === 'GET') return filas(route, []);
        return json(route, null);
    });

    return registro;
};
