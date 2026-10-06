import { expect, test, type Page } from '@playwright/test';
import * as F from './soporte/formulario';
import { CODIGO_FALSO, instalarSupabaseFalso, type Opciones, type Registro } from './soporte/supabase-falso';

/**
 * El paso del pago (prompt 2):
 *  · [ VOLVER ] no responde mientras sube el comprobante ni mientras se
 *    guarda la inscripción;
 *  · los botones de copiar, con y sin navigator.clipboard (sin él: una
 *    página por http, como la prueba en el celular por la red local, o
 *    algunos navegadores embebidos).
 *
 * El ida y vuelta completo, con el pedido a la base, está en el golden
 * (escenarios 10 y 10b).
 */

const ADULTO: F.Adulto = { nombre: 'Laura', apellido: 'Golden', dni: '30111222', email: 'laura.golden@example.com', nac: '1982-06-15' };
const CHICO: F.Chico = { nombre: 'Martina', apellido: 'Golden', dni: '50111001', nac: '2011-04-10', tribu: 'Trueno' };

const hastaElPago = async (page: Page, opciones: Opciones = {}): Promise<Registro> => {
    const registro = await instalarSupabaseFalso(page, opciones);
    await F.abrir(page);
    await F.entrarSinSesion(page);
    await F.llenarAdulto(page, ADULTO);
    await F.seguir(page);
    await F.agregarChico(page, CHICO);
    await F.seguir(page);
    await F.elegirRetiro(page, { tipo: 'solos' });
    await F.seguir(page);
    await F.autorizar(page, true);
    await F.seguir(page);
    await F.fotos(page, true);
    await F.seguir(page);
    await F.restriccion(page, 'Ninguna');
    await F.seguir(page);
    await expect(page.getByRole('heading', { name: /último paso/i })).toBeVisible();
    return registro;
};

test('volver no responde mientras sube el comprobante ni mientras se guarda', async ({ page }) => {
    let soltarSubida = () => {};
    let soltarAlta = () => {};
    const subida = new Promise<void>(r => { soltarSubida = r; });
    const alta = new Promise<void>(r => { soltarAlta = r; });
    const registro = await hastaElPago(page, { retener: { comprobante: subida, alta } });

    // Subiendo.
    await page.locator('input[type="file"]').first().setInputFiles(F.COMPROBANTE);
    await expect(page.getByText(/subiendo la captura/i)).toBeVisible();
    await expect(F.volver(page)).toBeDisabled();
    await F.volver(page).click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: /último paso/i })).toBeVisible();

    soltarSubida();
    await expect(page.getByText('comprobante.png')).toBeVisible({ timeout: 20_000 });
    await expect(F.volver(page)).toBeEnabled();

    // Guardando.
    await F.seguir(page);
    await expect(page.getByRole('button', { name: /^guardando…$/i })).toBeVisible();
    await expect(F.volver(page)).toBeDisabled();
    await F.volver(page).click({ force: true });
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: /último paso/i })).toBeVisible();

    soltarAlta();
    await expect(page.getByText(CODIGO_FALSO).first()).toBeVisible({ timeout: 20_000 });
    expect(registro.pedidos.filter(p => p.tipo === 'comprobante')).toHaveLength(1);
    expect(registro.pedidos.filter(p => p.tipo === 'register_nocturna')).toHaveLength(1);
});

/**
 * Lo que se copia, visto desde la página: el texto que se le pasa a
 * navigator.clipboard.writeText o lo que está seleccionado cuando se llama a
 * document.execCommand('copy'). Así se puede comprobar en los tres motores
 * sin pedir permiso para leer el portapapeles.
 */
const espiarCopias = (page: Page, sinClipboard: boolean) => page.addInitScript(quitar => {
    const w = window as unknown as { __copias: { via: string; texto: string; ok: boolean }[] };
    w.__copias = [];
    if (quitar) {
        Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true });
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText = async (texto: string) => { w.__copias.push({ via: 'clipboard', texto, ok: true }); };
    }
    const original = document.execCommand.bind(document);
    document.execCommand = (cmd: string, ...resto: unknown[]) => {
        const activo = document.activeElement as HTMLTextAreaElement | null;
        const texto = activo && 'value' in activo ? activo.value.slice(activo.selectionStart ?? 0, activo.selectionEnd ?? undefined) : String(window.getSelection());
        const ok = (original as (...a: unknown[]) => boolean)(cmd, ...resto);
        if (cmd === 'copy') w.__copias.push({ via: 'execCommand', texto, ok });
        return ok;
    };
}, sinClipboard);

const copias = (page: Page) => page.evaluate(() => (window as unknown as { __copias: { via: string; texto: string; ok: boolean }[] }).__copias);

for (const sinClipboard of [false, true]) {
    test(`copiar el alias y el CVU ${sinClipboard ? 'sin' : 'con'} navigator.clipboard`, async ({ page }) => {
        await espiarCopias(page, sinClipboard);
        await hastaElPago(page);
        expect(await page.evaluate(() => !!navigator.clipboard)).toBe(!sinClipboard);

        const botones = page.getByRole('button', { name: /^copiar el (alias|cvu)$/i });
        await expect(botones).toHaveCount(2);

        await page.getByRole('button', { name: /^copiar el alias$/i }).click();
        await expect(page.getByRole('button', { name: /^¡copiado! el alias$/i })).toBeVisible();
        await page.getByRole('button', { name: /^copiar el cvu$/i }).click();
        await expect(page.getByRole('button', { name: /^¡copiado! el cvu$/i })).toBeVisible();

        const hechas = await copias(page);
        expect(hechas.map(c => c.texto)).toEqual(['eventosorigen.mp', '0000003100036316658390']);
        expect(hechas.every(c => c.via === (sinClipboard ? 'execCommand' : 'clipboard'))).toBe(true);
        expect(hechas.every(c => c.ok)).toBe(true);
    });
}
