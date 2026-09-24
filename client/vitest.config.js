import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      // Node environment by default (Web Crypto is available on globalThis).
      // Component tests can opt into jsdom with `// @vitest-environment jsdom`.
      environment: 'node',
      include: ['src/**/*.{test,spec}.{js,jsx}'],
      setupFiles: ['./src/__tests__/setup.js'],
      clearMocks: true,
    },
  })
);
