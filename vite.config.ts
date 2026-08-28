import os from 'os';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generado por scripts/generate-build-version.js, que corre ANTES de
// `vite build` (ver el script "build" en package.json) — así el mismo
// identificador queda embebido en este bundle Y es lo que notify-deploy.js
// manda a app_version al final del deploy. Si el archivo no existe —por
// ejemplo, alguien corre `vite build`/`vite` directo sin pasar por ese
// paso— se cae a 'dev' en vez de romper el build local.
const readBuildVersion = (): string => {
  try {
    return readFileSync(path.join(__dirname, '.build-version'), 'utf-8').trim();
  } catch {
    return 'dev';
  }
};

export default defineConfig(({ mode }) => {
  // NOTE: VITE_ prefixed variables are automatically exposed via import.meta.env.
  // Do NOT use the `define` block to inline API keys — it embeds them as
  // plain-text literals in the compiled bundle.
  // Keep VITE_GEMINI_API_KEY in .env.local (gitignored) and access it with
  //   import.meta.env.VITE_GEMINI_API_KEY
  // inside source files.
  // __BUILD_VERSION__ es la única excepción a la regla de arriba: no es un
  // secreto, es un identificador público de build (ver hooks/useVersionCheck.ts).
  const _env = loadEnv(mode, '.', ''); // retained so loadEnv import is used
  void _env; // suppress unused-variable warning
  return {
    define: {
      __BUILD_VERSION__: JSON.stringify(readBuildVersion()),
    },
    server: {
      // El harness asigna el puerto por PORT cuando 5173 ya está tomado por
      // otro dev server; sin esa variable se mantiene el 5173 de siempre.
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
      host: 'localhost',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Move dep optimization cache outside OneDrive to avoid file-lock read errors
    cacheDir: path.join(os.tmpdir(), 'vite-origen-app'),
  };
});
