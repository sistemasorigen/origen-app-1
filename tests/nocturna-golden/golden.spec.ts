import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESCENARIOS } from './escenarios';

/**
 * El golden master: cada escenario se recorre y su traza (pedidos a
 * Supabase, secuencia de pantallas, sessionStorage paso a paso) se compara
 * contra la grabada con la versión anterior al rediseño.
 *
 *   Comparar:  npx playwright test -c tests/nocturna-golden golden
 *   Grabar:    GRABAR=1 npx playwright test -c tests/nocturna-golden golden --project=desktop-1280
 *
 * Grabar pisa los archivos de golden/. Sólo se graba con la versión de
 * referencia: grabar con la versión nueva haría pasar cualquier cambio.
 */

const GRABAR = process.env.GRABAR === '1';
const archivo = (nombre: string) => fileURLToPath(new URL(`./golden/${nombre}.json`, import.meta.url));

for (const [nombre, recorrer] of Object.entries(ESCENARIOS)) {
    test(`golden ${nombre}`, async ({ page }, info) => {
        if (info.project.metadata?.cpuX && info.project.name.includes('android')) {
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: info.project.metadata.cpuX });
        }
        const traza = await recorrer(page, info);
        const texto = JSON.stringify(traza, null, 2) + '\n';
        await info.attach('traza.json', { body: texto, contentType: 'application/json' });

        if (GRABAR) {
            fs.writeFileSync(archivo(nombre), texto);
            return;
        }
        const esperado = JSON.parse(fs.readFileSync(archivo(nombre), 'utf8'));
        expect.soft(traza.pedidos, 'pedidos a Supabase').toEqual(esperado.pedidos);
        expect.soft(traza.secuencia, 'secuencia de pantallas').toEqual(esperado.secuencia);
        expect.soft(traza.pasos.map(p => p.sessionStorage), 'sessionStorage paso a paso').toEqual(esperado.pasos.map((p: any) => p.sessionStorage));
    });
}
