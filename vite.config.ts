import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // NOTE: VITE_ prefixed variables are automatically exposed via import.meta.env.
  // Do NOT use the `define` block to inline API keys — it embeds them as
  // plain-text literals in the compiled bundle.
  // Keep VITE_GEMINI_API_KEY in .env.local (gitignored) and access it with
  //   import.meta.env.VITE_GEMINI_API_KEY
  // inside source files.
  const _env = loadEnv(mode, '.', ''); // retained so loadEnv import is used
  void _env; // suppress unused-variable warning
  return {
    server: {
      port: 5173,
      host: 'localhost',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
