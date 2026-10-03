import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev and preview proxy target, from the shell or client/.env (loadEnv reads both).
const apiProxyTarget = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', __dirname, '')
  .API_PROXY_TARGET || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],

  // Tell Vite/esbuild to treat .js files as JSX (matches CRA Babel behavior)
  esbuild: {
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
    loader: 'jsx',
  },

  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },

  // Dev and preview proxy target. Override to reach an API on another machine:
  //   API_PROXY_TARGET=http://100.64.0.10:8080 (shell or client/.env)
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },

  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@api': path.resolve(__dirname, 'src/api'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@platform': path.resolve(__dirname, '../platform'),
    },
  },

  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy vendors out of the app chunk so they cache independently.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-realtime': ['socket.io-client', 'axios'],
          'vendor-charts': ['recharts'],
          'vendor-markdown': ['react-markdown', 'remark-breaks', 'react-syntax-highlighter'],
          'vendor-emoji': ['emoji-picker-react'],
        },
      },
    },
  },
});
