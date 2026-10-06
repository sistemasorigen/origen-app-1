import { defineConfig, devices } from '@playwright/test';

/**
 * Banco de pruebas del rediseño de Nocturna (ver README.md de esta carpeta).
 *
 * Corre contra el servidor de desarrollo en un puerto propio, con TODO lo que
 * va a Supabase interceptado (soporte/supabase-falso.ts): ningún pedido llega
 * a la base.
 *
 *   npx playwright test -c tests/nocturna-golden
 *   npx playwright test -c tests/nocturna-golden --project=iphone-se
 *   GRABAR=1 npx playwright test -c tests/nocturna-golden golden --project=desktop-1280
 */

const PUERTO = 5199;

// Un Android de gama baja/media. Mismo motor que el Pixel, pantalla chica.
const androidChico = {
    ...devices['Pixel 7'],
    viewport: { width: 360, height: 740 },
    screen: { width: 360, height: 740 },
};

export default defineConfig({
    testDir: '.',
    outputDir: './resultados',
    snapshotPathTemplate: '{testDir}/capturas/{projectName}/{arg}{ext}',
    timeout: 90_000,
    expect: { timeout: 10_000 },
    fullyParallel: true,
    workers: 4,
    retries: 0,
    reporter: [['list'], ['html', { outputFolder: './reporte', open: 'never' }]],
    use: {
        baseURL: `http://localhost:${PUERTO}`,
        locale: 'es-AR',
        timezoneId: 'America/Argentina/Buenos_Aires',
        trace: 'retain-on-failure',
        // El banner de "reducir movimiento" se prueba aparte, en sus proyectos.
        contextOptions: { reducedMotion: 'no-preference' },
    },
    projects: [
        // WebKit: el motor de Safari y de TODO navegador en iPhone (también el
        // de WhatsApp e Instagram).
        { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
        { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
        { name: 'iphone-14-sin-movimiento', use: { ...devices['iPhone 14'], contextOptions: { reducedMotion: 'reduce' } } },
        // Chromium: Chrome de Android y de escritorio.
        { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
        { name: 'android-chico', use: androidChico },
        { name: 'android-lento', use: androidChico, metadata: { cpuX: 4 } },
        { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
        { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'desktop-1440-sin-movimiento', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } } },
        // Firefox de escritorio.
        { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } } },
    ],
    // Contra un build de producción y no contra el servidor de desarrollo: en
    // desarrollo React corre en StrictMode y repite los efectos, y la config
    // se pedía dos veces. El build va a una carpeta propia: el dist/ del repo
    // es el que se publica y no se toca.
    webServer: {
        command: `npx vite build --outDir tests/nocturna-golden/.dist --emptyOutDir && npx vite preview --outDir tests/nocturna-golden/.dist --port ${PUERTO} --strictPort`,
        cwd: '../..',
        url: `http://localhost:${PUERTO}`,
        reuseExistingServer: true,
        timeout: 240_000,
    },
});
