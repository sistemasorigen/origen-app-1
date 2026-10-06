import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { CODIGO_FALSO } from './supabase-falso';

/**
 * Cómo se maneja la inscripción desde el test.
 *
 * TODOS los selectores viven en este archivo. Se buscan por rol y nombre
 * accesible —lo que lee un lector de pantalla—, no por clases ni por
 * posición: el rediseño cambia todo el CSS y eso no puede romper las pruebas.
 *
 * Si el rediseño cambia un texto de botón (por ejemplo "Siguiente" por
 * "Seguir"), se corrige ACÁ y en ningún otro lado. Lo que no puede cambiar es
 * lo que se graba: los pedidos, la secuencia de pantallas y el borrador.
 */

export const RUTA = '/#/nocturna-inscripcion';
export const CLAVE_BORRADOR = 'nocturna.inscripcion.borrador';
export const COMPROBANTE = fileURLToPath(new URL('../fixtures/comprobante.png', import.meta.url));

export type Pantalla = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'noAut' | 'fuera' | '?';

export interface Adulto { nombre: string; apellido: string; dni: string; email: string; nac: string; }
export interface Chico { nombre: string; apellido: string; dni: string; nac: string; tribu: 'Trueno' | 'Garra' | 'Sin tribu'; }

const boton = (page: Page, nombre: string | RegExp) =>
    page.getByRole('button', { name: nombre, exact: typeof nombre === 'string' });

/** Un texto exacto, sin importar mayúsculas: el rediseño las pone por CSS. */
const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exacto = (texto: string) => new RegExp(`^${escapar(texto)}$`, 'i');

/** Los botones de la portada: sin sesión, o "Continuar como <nombre>" con sesión. */
const ENTRADA = /^(entrar sin sesión|continuar como .+|continuar con la inscripción)$/i;

/**
 * El botón del pie que avanza: "Siguiente" del paso 1 al 6, "Listo" en el
 * pago, y "Reintentar" en el pago después de un corte de conexión.
 */
export const botonSeguir = (page: Page) => page.getByRole('button', { name: /^(siguiente|listo|reintentar)$/i });

/** Un campo del adulto (paso 1), por su etiqueta: "Nombre", "DNI"… */
export const campoAdulto = (page: Page, etiqueta: string) => page.getByLabel(etiqueta, { exact: true });

// ── En qué pantalla está ───────────────────────────────────────────────────

/**
 * La pantalla actual, sin mirar el diseño.
 *
 * Del 1 al 7 la dice el borrador (`paso`), que el formulario guarda en cada
 * cambio. El 0 y el 8 no tienen borrador: el 0 se reconoce por los botones de
 * entrada y el 8 por el código de entrada falso, que sólo aparece ahí.
 */
export const pantallaActual = async (page: Page): Promise<Pantalla> => {
    // Salió del formulario (por ejemplo, "Salir de la inscripción" lleva al inicio).
    if (!page.url().includes('nocturna-inscripcion')) return 'fuera';
    if (await page.getByText(CODIGO_FALSO, { exact: false }).first().isVisible().catch(() => false)) return 8;
    if (await boton(page, exacto('Salir de la inscripción')).isVisible().catch(() => false)) return 'noAut';
    const borrador = await page.evaluate(k => sessionStorage.getItem(k), CLAVE_BORRADOR);
    if (borrador) {
        const b = JSON.parse(borrador);
        return (Number(b.paso) || '?') as Pantalla;
    }
    const entrada = await page.getByRole('button', { name: ENTRADA }).first().isVisible().catch(() => false);
    return entrada ? 0 : '?';
};

// ── Acciones ───────────────────────────────────────────────────────────────

export const abrir = async (page: Page) => {
    await page.goto(RUTA);
    await expect(page.getByRole('button', { name: ENTRADA }).first()).toBeVisible({ timeout: 20_000 });
};

export const entrarSinSesion = (page: Page) => boton(page, /^entrar sin sesión$/i).click();
export const entrarConSesion = (page: Page) => boton(page, /^(continuar como .+|continuar con la inscripción)$/i).click();

export const llenarAdulto = async (page: Page, a: Partial<Adulto>) => {
    if (a.nombre !== undefined) await campoAdulto(page, 'Nombre').fill(a.nombre);
    if (a.apellido !== undefined) await campoAdulto(page, 'Apellido').fill(a.apellido);
    if (a.dni !== undefined) await campoAdulto(page, 'DNI').fill(a.dni);
    if (a.email !== undefined) await campoAdulto(page, 'Email').fill(a.email);
    if (a.nac !== undefined) await campoAdulto(page, 'Fecha de nacimiento').fill(a.nac);
};

export const seguir = async (page: Page) => {
    await botonSeguir(page).click();
};

export const agregarChico = async (page: Page, c: Chico) => {
    await page.getByRole('button', { name: /^((agregar|sumar) (un|otro) adolescente|sumar a alguien más)$/i }).first().click();
    await page.getByLabel('Nombre del adolescente').last().fill(c.nombre);
    await page.getByLabel('Apellido del adolescente').last().fill(c.apellido);
    await page.getByLabel('DNI del adolescente').last().fill(c.dni);
    await page.getByLabel('Fecha de nacimiento del adolescente').last().fill(c.nac);
    await boton(page, exacto(c.tribu)).last().click();
    await boton(page, exacto(`Listo, guardar a ${c.nombre}`)).click();
};

export type Retiro = { tipo: 'solos' } | { tipo: 'yo' } | { tipo: 'otro'; nombre: string; apellido: string; dni: string; telefono: string };

export const elegirRetiro = async (page: Page, r: Retiro) => {
    if (r.tipo === 'solos') {
        await boton(page, /^sí$/i).click();
        return;
    }
    await boton(page, /^no$/i).click();
    if (r.tipo === 'yo') {
        await page.getByRole('button', { name: /^los? retiro yo$/i }).click();
        return;
    }
    await page.getByRole('button', { name: /^los? retirará otra persona$/i }).click();
    await page.getByLabel('Nombre de quien retira').fill(r.nombre);
    await page.getByLabel('Apellido de quien retira').fill(r.apellido);
    await page.getByLabel('DNI de quien retira').fill(r.dni);
    await page.getByLabel('Teléfono de quien retira').fill(r.telefono);
};

// Cada respuesta lleva abajo su consecuencia ("Autorizo Pueden asistir"):
// se busca por cómo empieza.
export const autorizar = (page: Page, si: boolean) => boton(page, si ? /^autorizo\b/i : /^no autorizo\b/i).click();
export const fotos = (page: Page, si: boolean) => boton(page, si ? /^sí, acepto\b/i : /^no acepto\b/i).click();

export const restriccion = (page: Page, cual: 'Ninguna' | 'Celíaco' | 'Diabetes') => boton(page, exacto(cual)).click();
/**
 * Marca o desmarca a un chico en la lista de la restricción elegida. Si ya
 * tiene la otra restricción, la fila la dice al lado del nombre.
 */
export const marcarRestriccion = (page: Page, nombreCompleto: string) =>
    boton(page, new RegExp(`^${escapar(nombreCompleto)}( (diabetes|celíaco))?$`, 'i')).click();

/** Volver al paso anterior, desde la barra de pasos. */
export const volver = (page: Page) => page.getByRole('button', { name: 'Volver al paso anterior', exact: true });

export const subirComprobante = async (page: Page) => {
    await page.locator('input[type="file"]').first().setInputFiles(COMPROBANTE);
    // Terminó de subir cuando "Listo" deja de esperar.
    await expect.poll(async () => {
        const b = await page.evaluate(k => sessionStorage.getItem(k), CLAVE_BORRADOR);
        return b ? !!JSON.parse(b).comprobante : false;
    }, { timeout: 20_000 }).toBe(true);
};
