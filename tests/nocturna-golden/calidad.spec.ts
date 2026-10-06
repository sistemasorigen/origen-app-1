import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as F from './soporte/formulario';
import { BUSCAR_GRUPO, CODIGO_FALSO, CONFIG, instalarSupabaseFalso, type Opciones } from './soporte/supabase-falso';

/**
 * Calidad de cada pantalla, en cada dispositivo del config:
 *
 *  · una captura de pantalla completa (capturas/<dispositivo>/<pantalla>.png),
 *    para mirar, no para comparar: el rediseño cambia todo lo visual;
 *  · que NUNCA haya scroll horizontal;
 *  · accesibilidad con axe-core (WCAG 2.1 A y AA): fallan los problemas
 *    "critical" y "serious"; los demás quedan en el reporte;
 *  · errores de consola y excepciones sin atrapar.
 *
 * Todo con el Supabase falso: nada llega a la base.
 */

const ADULTO: F.Adulto = { nombre: 'Laura', apellido: 'Golden', dni: '30111222', email: 'laura.golden@example.com', nac: '1982-06-15' };
const CHICOS: F.Chico[] = [
    { nombre: 'Martina', apellido: 'Golden', dni: '50111001', nac: '2011-04-10', tribu: 'Trueno' },
    { nombre: 'Bruno', apellido: 'Golden', dni: '50111002', nac: '2013-09-21', tribu: 'Garra' },
];
const EXISTENTE: F.Adulto = { nombre: 'Golden', apellido: 'PRUEBA', dni: '95000777', email: 'prueba@origen.test', nac: '1984-02-02' };

interface Hallazgos { pantalla: string; scrollHorizontal?: number; axe: { id: string; impacto: string; nodos: number; ayuda: string; donde: string[] }[] }

const capturasDir = (info: TestInfo) => fileURLToPath(new URL(`./capturas/${info.project.name}/`, import.meta.url));

const preparar = async (page: Page, info: TestInfo, opciones: Opciones = {}) => {
    if (info.project.metadata?.cpuX && info.project.name.includes('android')) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: info.project.metadata.cpuX });
    }
    const errores: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errores.push(`consola: ${m.text()}`); });
    page.on('pageerror', e => errores.push(`excepción: ${e.message}`));
    await instalarSupabaseFalso(page, opciones);
    fs.mkdirSync(capturasDir(info), { recursive: true });
    return errores;
};

/** Mira la pantalla actual: captura, scroll horizontal y axe. */
const revisar = async (page: Page, info: TestInfo, nombre: string, todos: Hallazgos[]) => {
    // Arriba de todo: con la página scrolleada, la captura de página completa
    // dibuja la cabecera pegajosa encima del contenido.
    await page.evaluate(() => window.scrollTo(0, 0));
    // Que terminen las entradas: las letras del título tardan hasta ~1,3 s.
    await page.waitForTimeout(1600);
    await page.screenshot({ path: capturasDir(info) + `${nombre}.png`, fullPage: true });

    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const h: Hallazgos = {
        pantalla: nombre,
        ...(sobra > 0 ? { scrollHorizontal: sobra } : {}),
        axe: axe.violations.map(v => ({
            id: v.id, impacto: v.impact || '?', nodos: v.nodes.length, ayuda: v.help,
            donde: v.nodes.slice(0, 5).map(n => `${n.target.join(' ')} → ${n.html.slice(0, 140)}`),
        })),
    };
    todos.push(h);
    expect.soft(sobra, `${nombre}: scroll horizontal de ${sobra}px`).toBeLessThanOrEqual(0);
    const graves = h.axe.filter(v => v.impacto === 'critical' || v.impacto === 'serious');
    expect.soft(graves, `${nombre}: problemas de accesibilidad graves`).toEqual([]);
};

const cerrar = async (info: TestInfo, todos: Hallazgos[], errores: string[]) => {
    const cuerpo = JSON.stringify({ dispositivo: info.project.name, prueba: info.title, hallazgos: todos, errores }, null, 2);
    await info.attach('hallazgos.json', { body: cuerpo, contentType: 'application/json' });
    const dir = fileURLToPath(new URL(`./hallazgos/`, import.meta.url));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dir + `${info.project.name}--${info.title.replace(/[^a-z0-9]+/gi, '-')}.json`, cuerpo);
    expect.soft(errores, 'errores de consola').toEqual([]);
};

test('recorrido completo: cada pantalla', async ({ page }, info) => {
    const todos: Hallazgos[] = [];
    const errores = await preparar(page, info);

    await F.abrir(page);
    await revisar(page, info, '00-bienvenida', todos);
    await F.entrarSinSesion(page);
    await revisar(page, info, '01-adulto-vacio', todos);

    await F.llenarAdulto(page, { ...ADULTO, nac: '2010-05-05' });
    await F.seguir(page);
    await revisar(page, info, '01b-adulto-menor-de-18', todos);
    await F.llenarAdulto(page, { nac: ADULTO.nac });
    await F.seguir(page);
    await revisar(page, info, '02-chicos-vacio', todos);
    for (const c of CHICOS) await F.agregarChico(page, c);
    await revisar(page, info, '02b-chicos-cargados', todos);
    await F.seguir(page);

    await F.elegirRetiro(page, { tipo: 'otro', nombre: 'Raúl', apellido: 'Tercero', dni: '28999111', telefono: '1155550000' });
    await revisar(page, info, '03-retiro-otra-persona', todos);
    await F.seguir(page);

    await F.autorizar(page, false);
    await revisar(page, info, '04b-no-autorizo', todos);
    await page.getByRole('button', { name: 'Volver y cambiar mi respuesta', exact: true }).click();
    await revisar(page, info, '04-autorizacion', todos);
    await F.autorizar(page, true);
    await F.seguir(page);

    await F.fotos(page, false);
    await revisar(page, info, '05-fotos-no', todos);
    await F.seguir(page);

    await F.restriccion(page, 'Celíaco');
    await F.marcarRestriccion(page, 'Martina Golden');
    await revisar(page, info, '06-comida-celiaco', todos);
    await F.seguir(page);

    await revisar(page, info, '07-pago-sin-comprobante', todos);
    await F.subirComprobante(page);
    await revisar(page, info, '07b-pago-con-comprobante', todos);
    await F.seguir(page);

    await expect(page.getByText(CODIGO_FALSO).first()).toBeVisible({ timeout: 20_000 });
    await revisar(page, info, '08-entrada', todos);

    await cerrar(info, todos, errores);
});

test('diálogo de inscripción existente: las dos caras', async ({ page }, info) => {
    const todos: Hallazgos[] = [];
    const errores = await preparar(page, info, {
        buscarGrupo: c => (c?.p_fecha_nacimiento === EXISTENTE.nac ? BUSCAR_GRUPO.coincide : BUSCAR_GRUPO.noCoincide),
    });
    await F.abrir(page);
    await F.entrarSinSesion(page);

    await F.llenarAdulto(page, { ...EXISTENTE, nac: '1984-02-03' });
    await F.seguir(page);
    await expect(page.getByRole('button', { name: 'Revisar mis datos', exact: true })).toBeVisible();
    await revisar(page, info, '10-dialogo-cara-b', todos);
    await page.getByRole('button', { name: 'Revisar mis datos', exact: true }).click();

    await F.llenarAdulto(page, { nac: EXISTENTE.nac });
    await F.seguir(page);
    await expect(page.getByRole('button', { name: 'Sumar a alguien más', exact: true })).toBeVisible();
    await revisar(page, info, '11-dialogo-cara-a', todos);
    await page.getByRole('button', { name: 'Sumar a alguien más', exact: true }).click();
    await revisar(page, info, '12-modo-sumar-chicos', todos);

    await cerrar(info, todos, errores);
});

test('la tarjeta de un adolescente: abierta, y fuera de edad', async ({ page }, info) => {
    const todos: Hallazgos[] = [];
    const errores = await preparar(page, info);
    await F.abrir(page);
    await F.entrarSinSesion(page);
    await F.llenarAdulto(page, ADULTO);
    await F.seguir(page);
    await page.getByRole('button', { name: /^agregar un adolescente$/i }).click();
    await page.getByLabel('Nombre del adolescente').fill('Lucas');
    await page.getByLabel('Apellido del adolescente').fill('Golden');
    await page.getByRole('button', { name: /^garra$/i }).click();
    await revisar(page, info, '02c-tarjeta-abierta', todos);
    await page.getByLabel('DNI del adolescente').fill('50111009');
    await page.getByLabel('Fecha de nacimiento del adolescente').fill('2014-07-01');
    await revisar(page, info, '02d-fuera-de-edad', todos);
    await cerrar(info, todos, errores);
});

test('inscripciones cerradas', async ({ page }, info) => {
    const todos: Hallazgos[] = [];
    const errores = await preparar(page, info, { config: { ...CONFIG, inscripciones_abiertas: false } });
    await page.goto(F.RUTA);
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
    await revisar(page, info, '20-cerradas', todos);
    await cerrar(info, todos, errores);
});

test('sin conexión al cargar', async ({ page }, info) => {
    const todos: Hallazgos[] = [];
    const errores = await preparar(page, info);
    // La config no llega: es el estado "sin conexión" de la pantalla.
    await page.route('**/rest/v1/nocturna_config**', r => r.abort('internetdisconnected'));
    await page.goto(F.RUTA);
    await expect(page.getByRole('button', { name: 'Probar de nuevo', exact: true })).toBeVisible({ timeout: 30_000 });
    await revisar(page, info, '21-sin-conexion', todos);
    // El fallo de red que provoca la prueba sí se ve en la consola: es esperado.
    await cerrar(info, todos, errores.filter(e => !/nocturna_config|Failed to load resource|ERR_INTERNET_DISCONNECTED|getNocturnaConfig|NetworkError|Load failed|fetch/i.test(e)));
});
