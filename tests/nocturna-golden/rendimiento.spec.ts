import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as F from './soporte/formulario';
import { CODIGO_FALSO, instalarSupabaseFalso } from './soporte/supabase-falso';

/**
 * Cuánto cuesta moverse por la inscripción en un Android de gama media.
 *
 * Sólo corre en el proyecto `android-lento` (Chromium con la CPU 4 veces más
 * lenta). En cada transición mide, durante 1,5 s:
 *  · las tareas largas (> 50 ms, el navegador no responde mientras duran);
 *  · los cuadros: cuántos tardaron más de 50 ms (se nota el salto) y los
 *    cuadros por segundo promedio.
 *
 * No falla: deja los números en resultados-rendimiento.json para el reporte.
 */

interface Medida { transicion: string; tareasLargas: number; tareaMasLargaMs: number; cuadros: number; cuadrosLentos: number; peorCuadroMs: number; fps: number; }

const medir = async (page: Page, transicion: string, hacer: () => Promise<unknown>): Promise<Medida> => {
    await page.evaluate(() => {
        const w = window as unknown as { __lt: number[]; __cuadros: number[]; __obs?: PerformanceObserver };
        w.__lt = []; w.__cuadros = [];
        w.__obs?.disconnect();
        w.__obs = new PerformanceObserver(l => { for (const e of l.getEntries()) w.__lt.push(e.duration); });
        w.__obs.observe({ type: 'longtask', buffered: false });
        const t0 = performance.now();
        const paso = (t: number) => { w.__cuadros.push(t); if (t - t0 < 1500) requestAnimationFrame(paso); };
        requestAnimationFrame(paso);
    });
    await hacer();
    await page.waitForTimeout(1600);
    const r = await page.evaluate(() => {
        const w = window as unknown as { __lt: number[]; __cuadros: number[] };
        const deltas = w.__cuadros.slice(1).map((t, i) => t - w.__cuadros[i]);
        const total = (w.__cuadros[w.__cuadros.length - 1] - w.__cuadros[0]) || 1;
        return {
            tareasLargas: w.__lt.length,
            tareaMasLargaMs: Math.round(Math.max(0, ...w.__lt)),
            cuadros: w.__cuadros.length,
            cuadrosLentos: deltas.filter(d => d > 50).length,
            peorCuadroMs: Math.round(Math.max(0, ...deltas)),
            fps: Math.round((deltas.length / total) * 1000),
        };
    });
    return { transicion, ...r };
};

test('transiciones con la CPU ×4', async ({ page }, info) => {
    test.skip(info.project.name !== 'android-lento', 'sólo en el Android lento');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await instalarSupabaseFalso(page);

    const medidas: Medida[] = [];
    await F.abrir(page);
    medidas.push(await medir(page, 'portada → datos del adulto', () => F.entrarSinSesion(page)));
    await F.llenarAdulto(page, { nombre: 'Laura', apellido: 'Golden', dni: '30111222', email: 'laura@example.com', nac: '1982-06-15' });
    medidas.push(await medir(page, 'adulto → adolescentes', () => F.seguir(page)));
    medidas.push(await medir(page, 'agregar un adolescente (tarjeta abierta)', () =>
        page.getByRole('button', { name: /^agregar un adolescente$/i }).click()));
    await page.getByLabel('Nombre del adolescente').fill('Martina');
    await page.getByLabel('Apellido del adolescente').fill('Golden');
    await page.getByLabel('DNI del adolescente').fill('50111001');
    await page.getByLabel('Fecha de nacimiento del adolescente').fill('2011-04-10');
    medidas.push(await medir(page, 'elegir la tribu (pulsera)', () => page.getByRole('button', { name: /^trueno$/i }).click()));
    medidas.push(await medir(page, 'guardar al adolescente', () => page.getByRole('button', { name: /^listo, guardar a martina$/i }).click()));
    medidas.push(await medir(page, 'adolescentes → retiro', () => F.seguir(page)));
    await F.elegirRetiro(page, { tipo: 'solos' });
    await F.seguir(page);
    await F.autorizar(page, true);
    await F.seguir(page);
    await F.fotos(page, true);
    await F.seguir(page);
    await F.restriccion(page, 'Ninguna');
    await F.seguir(page);
    await F.subirComprobante(page);
    medidas.push(await medir(page, 'listo → la entrada (confeti)', async () => {
        await F.seguir(page);
        await page.getByText(CODIGO_FALSO).first().waitFor({ timeout: 30_000 });
    }));

    const salida = fileURLToPath(new URL('./resultados-rendimiento.json', import.meta.url));
    fs.writeFileSync(salida, JSON.stringify(medidas, null, 2) + '\n');
    console.table(medidas);
});
