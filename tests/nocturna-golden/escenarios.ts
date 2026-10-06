import { expect, type Page, type TestInfo } from '@playwright/test';
import * as F from './soporte/formulario';
import {
    BUSCAR_GRUPO, CODIGO_FALSO, iniciarSesionFalsa, instalarSupabaseFalso,
    type Opciones, type Perfil, type Registro,
} from './soporte/supabase-falso';
import { abrirStorage, Normalizador } from './soporte/normalizar';

/**
 * Los 9 escenarios del golden master.
 *
 * Cada uno devuelve una "traza": qué pantallas recorrió, qué había en
 * sessionStorage después de cada acción, y qué pedidos salieron hacia
 * Supabase. Lo que se compara es esa traza, no cómo se ve la pantalla.
 *
 * Los datos son inventados. Ningún pedido llega a la base: los contesta
 * soporte/supabase-falso.ts.
 */

export interface Paso {
    accion: string;
    pantalla: F.Pantalla;
    sessionStorage: Record<string, unknown>;
}

export interface Traza {
    escenario: string;
    secuencia: F.Pantalla[];
    pasos: Paso[];
    pedidos: Registro['pedidos'];
    /** Notas que no se comparan: para leer el archivo, no para el test. */
    notas?: string[];
}

// ── Datos de prueba ───────────────────────────────────────────────────────

const ADULTO: F.Adulto = { nombre: 'Laura', apellido: 'Golden', dni: '30111222', email: 'laura.golden@example.com', nac: '1982-06-15' };
const CHICOS: F.Chico[] = [
    { nombre: 'Martina', apellido: 'Golden', dni: '50111001', nac: '2011-04-10', tribu: 'Trueno' },
    { nombre: 'Bruno', apellido: 'Golden', dni: '50111002', nac: '2013-09-21', tribu: 'Garra' },
    { nombre: 'Julia', apellido: 'Golden', dni: '50111003', nac: '2009-12-02', tribu: 'Sin tribu' },
];
/** El adulto de la inscripción real grabada en golden/respuestas-reales.json. */
const ADULTO_EXISTENTE: F.Adulto = { nombre: 'Golden', apellido: 'PRUEBA', dni: '95000777', email: 'prueba@origen.test', nac: '1984-02-02' };
const PERFIL: Perfil = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Mariela Ramos Duarte',
    email: 'mariela.cuenta@example.com',
    birth_date: '1980-04-12',
    // Sin teléfono la app pide "Completá tu perfil" antes de cualquier pantalla.
    phone: '1155551234',
};

// ── La grabadora ──────────────────────────────────────────────────────────

class Grabadora {
    secuencia: F.Pantalla[] = [];
    pasos: Paso[] = [];
    registro!: Registro;
    norm = new Normalizador();

    constructor(public page: Page) {}

    async iniciar(opciones: Opciones = {}) {
        if (opciones.perfil) await iniciarSesionFalsa(this.page, opciones.perfil);
        this.registro = await instalarSupabaseFalso(this.page, opciones);
    }

    /** Hace algo y anota dónde quedó. Espera a que la pantalla se asiente. */
    async paso(accion: string, hacer: () => Promise<unknown>) {
        await hacer();
        await this.page.waitForTimeout(250);
        // Con tope: en Firefox siempre queda una conexión abierta y "networkidle" no llega nunca.
        await this.page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
        const pantalla = await F.pantallaActual(this.page);
        const storage = await this.page.evaluate(() => {
            const o: Record<string, string> = {};
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i)!;
                o[k] = sessionStorage.getItem(k)!;
            }
            return o;
        });
        if (this.secuencia[this.secuencia.length - 1] !== pantalla) this.secuencia.push(pantalla);
        this.pasos.push({ accion, pantalla, sessionStorage: abrirStorage(storage) });
    }

    traza(escenario: string, notas?: string[]): Traza {
        return this.norm.valor({
            escenario,
            secuencia: this.secuencia,
            pasos: this.pasos,
            pedidos: this.registro.pedidos,
            ...(notas ? { notas } : {}),
        });
    }
}

const llegarAlPago = async (g: Grabadora, adulto: F.Adulto, chicos: F.Chico[], retiro: F.Retiro, aceptaFotos: boolean) => {
    const { page } = g;
    await g.paso('abrir', () => F.abrir(page));
    await g.paso('entrar sin sesión', () => F.entrarSinSesion(page));
    await g.paso('datos del adulto', () => F.llenarAdulto(page, adulto));
    await g.paso('seguir (1→2)', () => F.seguir(page));
    for (const c of chicos) await g.paso(`agregar a ${c.nombre}`, () => F.agregarChico(page, c));
    await g.paso('seguir (2→3)', () => F.seguir(page));
    await g.paso(`retiro: ${retiro.tipo}`, () => F.elegirRetiro(page, retiro));
    await g.paso('seguir (3→4)', () => F.seguir(page));
    await g.paso('autorizo', () => F.autorizar(page, true));
    await g.paso('seguir (4→5)', () => F.seguir(page));
    await g.paso(aceptaFotos ? 'acepta fotos' : 'no acepta fotos', () => F.fotos(page, aceptaFotos));
    await g.paso('seguir (5→6)', () => F.seguir(page));
};

const terminar = async (g: Grabadora) => {
    await g.paso('subir comprobante', () => F.subirComprobante(g.page));
    await g.paso('listo (envío)', () => F.seguir(g.page));
    await expect(g.page.getByText(CODIGO_FALSO).first()).toBeVisible({ timeout: 20_000 });
    await g.paso('entrada en pantalla', async () => {});
};

// ── Los escenarios ────────────────────────────────────────────────────────

export const ESCENARIOS: Record<string, (page: Page, info: TestInfo) => Promise<Traza>> = {

    '1-sin-sesion-un-chico-se-retira-solo': async page => {
        const g = new Grabadora(page);
        await g.iniciar();
        await llegarAlPago(g, ADULTO, [CHICOS[0]], { tipo: 'solos' }, true);
        await g.paso('sin restricción', () => F.restriccion(page, 'Ninguna'));
        await g.paso('seguir (6→7)', () => F.seguir(page));
        await terminar(g);
        return g.traza('1 · Sin sesión, 1 chico, se retira solo, acepta fotos, sin restricciones');
    },

    '2-sin-sesion-tres-chicos-otra-persona-restricciones': async page => {
        const g = new Grabadora(page);
        await g.iniciar();
        await llegarAlPago(g, ADULTO, CHICOS, { tipo: 'otro', nombre: 'Raúl', apellido: 'Tercero', dni: '28999111', telefono: '1155550000' }, false);
        // Martina celíaca y Bruno con diabetes. Cambiar de restricción no
        // desmarca a quien ya estaba marcado con la otra (arreglado en 3d65205).
        await g.paso('celíaco', () => F.restriccion(page, 'Celíaco'));
        await g.paso('marcar a Martina', () => F.marcarRestriccion(page, 'Martina Golden'));
        await g.paso('diabetes', () => F.restriccion(page, 'Diabetes'));
        await g.paso('marcar a Bruno', () => F.marcarRestriccion(page, 'Bruno Golden'));
        await g.paso('seguir (6→7)', () => F.seguir(page));
        await terminar(g);
        return g.traza('2 · Sin sesión, 3 chicos, los retira otra persona, no acepta fotos, celíaco + diabetes', [
            'Regrabado el 2026-10-06 después de integrar 3d65205: antes del arreglo, elegir la segunda restricción',
            'devolvía a "ninguna" a los marcados con la primera, y el pedido salía sin la celiaquía de Martina.',
        ]);
    },

    '3-con-sesion-dos-chicos-lo-retiro-yo-nombre-corregido': async page => {
        const g = new Grabadora(page);
        await g.iniciar({ perfil: PERFIL });
        await g.paso('abrir', () => F.abrir(page));
        await g.paso('continuar con la sesión', () => F.entrarConSesion(page));
        // Autocompletó "Mariela" / "Ramos Duarte": el apellido compuesto se
        // corrige a mano y se completa el DNI, que la cuenta no tiene.
        await expect(F.campoAdulto(page, 'Nombre')).toHaveValue('Mariela');
        await g.paso('corregir apellido y DNI', () => F.llenarAdulto(page, { apellido: 'Ramos', dni: '27444555' }));
        await g.paso('seguir (1→2)', () => F.seguir(page));
        for (const c of CHICOS.slice(0, 2)) await g.paso(`agregar a ${c.nombre}`, () => F.agregarChico(page, { ...c, apellido: 'Ramos' }));
        await g.paso('seguir (2→3)', () => F.seguir(page));
        await g.paso('retiro: lo retiro yo', () => F.elegirRetiro(page, { tipo: 'yo' }));
        await g.paso('seguir (3→4)', () => F.seguir(page));
        await g.paso('autorizo', () => F.autorizar(page, true));
        await g.paso('seguir (4→5)', () => F.seguir(page));
        await g.paso('acepta fotos', () => F.fotos(page, true));
        await g.paso('seguir (5→6)', () => F.seguir(page));
        await g.paso('sin restricción', () => F.restriccion(page, 'Ninguna'));
        await g.paso('seguir (6→7)', () => F.seguir(page));
        await terminar(g);
        return g.traza('3 · Con sesión (autocompletado), 2 chicos, "lo retiro yo", apellido corregido a mano');
    },

    '4-adulto-menor-de-18-bloqueo': async page => {
        const g = new Grabadora(page);
        await g.iniciar();
        await g.paso('abrir', () => F.abrir(page));
        await g.paso('entrar sin sesión', () => F.entrarSinSesion(page));
        await g.paso('datos de un menor', () => F.llenarAdulto(page, { ...ADULTO, nac: '2010-05-05' }));
        await g.paso('intentar seguir', () => F.seguir(page));
        await expect(F.botonSeguir(page)).toBeVisible();
        return g.traza('4 · Adulto menor de 18 → bloqueo, no sale ningún pedido de inscripción');
    },

    '5-no-autorizo-salida': async page => {
        const g = new Grabadora(page);
        await g.iniciar();
        await g.paso('abrir', () => F.abrir(page));
        await g.paso('entrar sin sesión', () => F.entrarSinSesion(page));
        await g.paso('datos del adulto', () => F.llenarAdulto(page, ADULTO));
        await g.paso('seguir (1→2)', () => F.seguir(page));
        await g.paso('agregar a Martina', () => F.agregarChico(page, CHICOS[0]));
        await g.paso('seguir (2→3)', () => F.seguir(page));
        await g.paso('retiro: solos', () => F.elegirRetiro(page, { tipo: 'solos' }));
        await g.paso('seguir (3→4)', () => F.seguir(page));
        await g.paso('no autorizo', () => F.autorizar(page, false));
        await g.paso('salir de la inscripción', () => page.getByRole('button', { name: /^salir de la inscripción$/i }).click());
        return g.traza('5 · "No autorizo" → salida, no sale ningún pedido de inscripción');
    },

    '6-sumar-chicos-dni-y-fecha-coinciden': async page => {
        const g = new Grabadora(page);
        await g.iniciar({ buscarGrupo: c => (c?.p_fecha_nacimiento === ADULTO_EXISTENTE.nac ? BUSCAR_GRUPO.coincide : BUSCAR_GRUPO.noCoincide) });
        await g.paso('abrir', () => F.abrir(page));
        await g.paso('entrar sin sesión', () => F.entrarSinSesion(page));
        await g.paso('datos de un adulto ya inscripto', () => F.llenarAdulto(page, ADULTO_EXISTENTE));
        await g.paso('seguir (1→ aviso)', () => F.seguir(page));
        await expect(page.getByRole('button', { name: 'Sumar a alguien más', exact: true })).toBeVisible();
        await g.paso('sumar a alguien más', () => page.getByRole('button', { name: 'Sumar a alguien más', exact: true }).click());
        await g.paso('agregar a Lola', () => F.agregarChico(page, { nombre: 'Lola', apellido: 'PRUEBA', dni: '95000779', nac: '2013-05-05', tribu: 'Garra' }));
        // En el modo "sumar" los pasos siguientes dependen de lo que ya está
        // guardado: se avanza mirando en qué pantalla quedó.
        for (let vuelta = 0; vuelta < 10; vuelta++) {
            const p = await F.pantallaActual(page);
            if (p === 7) break;
            if (p === 3) await g.paso('retiro: lo retiro yo', () => F.elegirRetiro(page, { tipo: 'yo' }));
            if (p === 4) await g.paso('autorizo', () => F.autorizar(page, true));
            if (p === 5) await g.paso('acepta fotos', () => F.fotos(page, true));
            if (p === 6) await g.paso('sin restricción', () => F.restriccion(page, 'Ninguna'));
            await g.paso(`seguir (${p}→)`, () => F.seguir(page));
        }
        await terminar(g);
        return g.traza('6 · Sumar chicos: DNI + fecha coinciden con una inscripción existente');
    },

    '7-mismo-dni-fecha-distinta-cara-b': async page => {
        const g = new Grabadora(page);
        await g.iniciar({ buscarGrupo: c => (c?.p_fecha_nacimiento === ADULTO_EXISTENTE.nac ? BUSCAR_GRUPO.coincide : BUSCAR_GRUPO.noCoincide) });
        await g.paso('abrir', () => F.abrir(page));
        await g.paso('entrar sin sesión', () => F.entrarSinSesion(page));
        await g.paso('mismo DNI, otra fecha', () => F.llenarAdulto(page, { ...ADULTO_EXISTENTE, nac: '1984-02-03' }));
        await g.paso('seguir (1→ aviso)', () => F.seguir(page));
        await expect(page.getByRole('button', { name: 'Revisar mis datos', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Sumar a alguien más', exact: true })).toHaveCount(0);
        await g.paso('revisar mis datos', () => page.getByRole('button', { name: 'Revisar mis datos', exact: true }).click());
        return g.traza('7 · Mismo DNI, fecha que no coincide → cara B del diálogo');
    },

    '8-recarga-en-el-pago-restaura-el-borrador': async page => {
        const g = new Grabadora(page);
        await g.iniciar();
        await llegarAlPago(g, ADULTO, CHICOS.slice(0, 2), { tipo: 'yo' }, true);
        await g.paso('sin restricción', () => F.restriccion(page, 'Ninguna'));
        await g.paso('seguir (6→7)', () => F.seguir(page));
        await g.paso('subir comprobante', () => F.subirComprobante(page));
        await g.paso('recargar la página', async () => {
            await page.reload();
            await expect(F.botonSeguir(page)).toBeVisible({ timeout: 20_000 });
        });
        await g.paso('listo (envío)', () => F.seguir(page));
        await expect(page.getByText(CODIGO_FALSO).first()).toBeVisible({ timeout: 20_000 });
        await g.paso('entrada en pantalla', async () => {});
        return g.traza('8 · Recarga en el paso del pago → el borrador se restaura y la inscripción sale igual');
    },

    '9-doble-toque-en-el-boton-final': async page => {
        const g = new Grabadora(page);
        await g.iniciar();
        await llegarAlPago(g, ADULTO, [CHICOS[1]], { tipo: 'solos' }, true);
        await g.paso('sin restricción', () => F.restriccion(page, 'Ninguna'));
        await g.paso('seguir (6→7)', () => F.seguir(page));
        await g.paso('subir comprobante', () => F.subirComprobante(page));
        await g.paso('doble toque en listo', () => F.botonSeguir(page).dblclick());
        await expect(page.getByText(CODIGO_FALSO).first()).toBeVisible({ timeout: 20_000 });
        await g.paso('entrada en pantalla', async () => {});
        const altas = g.registro.pedidos.filter(p => p.tipo === 'register_nocturna').length;
        expect(altas, 'un doble toque tiene que mandar UNA sola inscripción').toBe(1);
        return g.traza('9 · Doble toque en el botón final → un solo envío');
    },
};

// ── Volver desde el pago (prompt 2) ───────────────────────────────────────

/**
 * Subir el comprobante, volver al paso anterior con [ VOLVER ], avanzar de
 * nuevo y enviar. El comprobante tiene que seguir ahí sin volver a subirse.
 */
const terminarVolviendo = async (g: Grabadora) => {
    const { page } = g;
    await g.paso('subir comprobante', () => F.subirComprobante(page));
    await g.paso('volver (7→ anterior)', () => F.volver(page).click());
    await expect(page.getByRole('heading', { name: /restricción alimentaria/i })).toBeVisible();
    await g.paso('seguir (→7 de nuevo)', () => F.seguir(page));
    await expect(page.getByText('comprobante.png')).toBeVisible();
    await g.paso('listo (envío)', () => F.seguir(page));
    await expect(page.getByText(CODIGO_FALSO).first()).toBeVisible({ timeout: 20_000 });
    await g.paso('entrada en pantalla', async () => {});
};

/**
 * Escenarios que no tienen golden propio: la versión de referencia no tenía
 * [ VOLVER ] en el pago, así que no hay con qué grabarlos. Se comparan con
 * el escenario que hace el MISMO recorrido sin volver (`referencia`): los
 * pedidos a la base tienen que ser idénticos, y la secuencia, la misma con
 * el ida y vuelta 7 → 6 → 7 en el medio.
 */
export const ESCENARIOS_VOLVER: Record<string, { referencia: string; recorrer: (page: Page) => Promise<Traza> }> = {

    '10-volver-desde-el-pago': {
        referencia: '1-sin-sesion-un-chico-se-retira-solo',
        recorrer: async page => {
            const g = new Grabadora(page);
            await g.iniciar();
            await llegarAlPago(g, ADULTO, [CHICOS[0]], { tipo: 'solos' }, true);
            await g.paso('sin restricción', () => F.restriccion(page, 'Ninguna'));
            await g.paso('seguir (6→7)', () => F.seguir(page));
            await terminarVolviendo(g);
            return g.traza('10 · El escenario 1, volviendo del pago a la comida y avanzando de nuevo');
        },
    },

    '10b-sumando-volver-desde-el-pago': {
        referencia: '6-sumar-chicos-dni-y-fecha-coinciden',
        recorrer: async page => {
            const g = new Grabadora(page);
            await g.iniciar({ buscarGrupo: c => (c?.p_fecha_nacimiento === ADULTO_EXISTENTE.nac ? BUSCAR_GRUPO.coincide : BUSCAR_GRUPO.noCoincide) });
            await g.paso('abrir', () => F.abrir(page));
            await g.paso('entrar sin sesión', () => F.entrarSinSesion(page));
            await g.paso('datos de un adulto ya inscripto', () => F.llenarAdulto(page, ADULTO_EXISTENTE));
            await g.paso('seguir (1→ aviso)', () => F.seguir(page));
            await g.paso('sumar a alguien más', () => page.getByRole('button', { name: 'Sumar a alguien más', exact: true }).click());
            await g.paso('agregar a Lola', () => F.agregarChico(page, { nombre: 'Lola', apellido: 'PRUEBA', dni: '95000779', nac: '2013-05-05', tribu: 'Garra' }));
            for (let vuelta = 0; vuelta < 10; vuelta++) {
                const p = await F.pantallaActual(page);
                if (p === 7) break;
                if (p === 3) await g.paso('retiro: lo retiro yo', () => F.elegirRetiro(page, { tipo: 'yo' }));
                if (p === 4) await g.paso('autorizo', () => F.autorizar(page, true));
                if (p === 5) await g.paso('acepta fotos', () => F.fotos(page, true));
                if (p === 6) await g.paso('sin restricción', () => F.restriccion(page, 'Ninguna'));
                await g.paso(`seguir (${p}→)`, () => F.seguir(page));
            }
            await terminarVolviendo(g);
            return g.traza('10b · El escenario 6 (sumando), volviendo del pago: tiene que caer en la comida, no en las fotos');
        },
    },
};
