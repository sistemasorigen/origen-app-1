import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { campoAdulto, CLAVE_BORRADOR, RUTA } from './soporte/formulario';
import { BUSCAR_GRUPO, instalarSupabaseFalso } from './soporte/supabase-falso';

/**
 * Una familia que está a mitad de la inscripción el día que se publica.
 *
 * Se toman los borradores que dejó en sessionStorage la versión ANTERIOR al
 * rediseño (grabados en golden/, uno por paso) y se abre la versión actual
 * con cada uno: tiene que retomar en el mismo paso, con lo cargado a la
 * vista, y sin descartar ni reescribir el borrador.
 *
 * Los UUID del golden están normalizados (<uuid-1>…): se cambian por UUID
 * reales, los mismos en todo el borrador, porque el formulario los usa como
 * id de cada chico.
 */

const GOLDEN = fileURLToPath(new URL('./golden/', import.meta.url));

const uuid = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const desnormalizar = (texto: string) => texto.replace(/<uuid-(\d+)>/g, (_, n) => uuid(Number(n)));

/** Lo que tiene que verse en cada paso: su título. */
const TITULO: Record<number, RegExp> = {
    1: /adulto responsable/i,
    2: /a quién (vas a anotar|sumás)/i,
    3: /se retiran? solos?/i,
    4: /autorización de asistencia/i,
    5: /fotos y video/i,
    6: /restricción alimentaria/i,
    7: /último paso/i,
};

interface Caso { escenario: string; paso: number; borrador: string; }

const casos: Caso[] = [];
for (const archivo of fs.readdirSync(GOLDEN).filter(f => /^\d-.*\.json$/.test(f)).sort()) {
    const traza = JSON.parse(fs.readFileSync(GOLDEN + archivo, 'utf8'));
    const vistos = new Set<number>();
    for (const p of traza.pasos) {
        const b = p.sessionStorage?.[CLAVE_BORRADOR];
        if (!b || vistos.has(b.paso)) continue;
        vistos.add(b.paso);
        casos.push({ escenario: archivo.replace('.json', ''), paso: b.paso, borrador: desnormalizar(JSON.stringify(b)) });
    }
}

for (const c of casos) {
    test(`borrador viejo: ${c.escenario}, paso ${c.paso}`, async ({ page }) => {
        await page.addInitScript(([clave, valor]) => {
            if (!sessionStorage.getItem('__inyectado')) {
                sessionStorage.setItem(clave, valor);
                sessionStorage.setItem('__inyectado', '1');
            }
        }, [CLAVE_BORRADOR, c.borrador] as const);
        await instalarSupabaseFalso(page, { buscarGrupo: () => BUSCAR_GRUPO.noExiste });
        await page.goto(RUTA);

        const b = JSON.parse(c.borrador);
        // Retoma en el mismo paso: se ve su título.
        await expect(page.getByRole('heading', { name: TITULO[b.paso] }).first()).toBeVisible({ timeout: 20_000 });

        // Con lo cargado a la vista.
        if (b.paso === 1 && b.adulto.nombre) await expect(campoAdulto(page, 'Nombre')).toHaveValue(b.adulto.nombre);
        if (b.paso === 2) {
            for (const chico of b.chicos) {
                if (chico.nombre) await expect(page.getByText(`${chico.nombre} ${chico.apellido}`.trim()).first()).toBeVisible();
            }
        }
        if (b.paso === 7 && b.comprobante) await expect(page.getByText(b.comprobante.nombre)).toBeVisible();

        // Y el borrador sigue entero: no se descartó ni cambió de forma.
        await page.waitForTimeout(500);
        const despues = await page.evaluate(k => sessionStorage.getItem(k), CLAVE_BORRADOR);
        expect(JSON.parse(despues || 'null')).toEqual(b);
    });
}
