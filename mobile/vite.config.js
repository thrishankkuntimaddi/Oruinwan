import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// One build serves both the Android shell (Capacitor loads dist/ from disk) and a plain
// browser preview. base './' keeps asset URLs relative so both work.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Inline config stops Vite from picking up the repo root's postcss.config.js (web client).
  css: { postcss: { plugins: [] } },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    reportCompressedSize: false,
  },
  server: { port: 5174 },
  preview: { port: 4174 },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
