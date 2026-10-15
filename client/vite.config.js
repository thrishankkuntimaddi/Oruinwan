import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, rmSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev and preview proxy target, from the shell or client/.env (loadEnv reads both).
const apiProxyTarget = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', __dirname, '')
  .API_PROXY_TARGET || 'http://localhost:8080';

// Build modes (vite build --mode …):
//  - default: the web client a server hosts itself (server/server.js serves ../dist).
//  - app:  the web client inside the desktop app (desktop/) and on tablets in the Android/iOS
//          app (mobile/). The user picks the server at runtime (src/appMode), so the
//          server URL is read from globalThis.__ORUINWAN_SERVER__ / __ORUINWAN_API__
//          (set by src/appMode/preboot.js) instead of being baked in.
//  - site: the product website on GitHub Pages: landing, docs and legal pages, with
//          "Open web app" sending people to their own server. SITE_BASE sets the path.
// Files in public/ that the client never loads (legacy brand art, demo media, the service
// worker). App and site bundles ship without them, which keeps the Android/iOS app small; the
// server-hosted client keeps them.
const NOT_IN_APPS = [
  'assets/Background.jpg', 'assets/ChttrixAI-logo.png', 'assets/ChttrixFavico.png',
  'ChttrixAI-animation.mp4', 'hover-animation.mp4', 'chttrix-logo.jpg',
  'icons/Oruinwan.png', 'sw.js',
];
const pruneAppBundle = (outDir) => ({
  name: 'oruinwan-prune-app-bundle',
  apply: 'build',
  closeBundle() {
    for (const file of NOT_IN_APPS) rmSync(path.join(outDir, file), { force: true });
  },
});

// GitHub Pages serves 404.html for any path it doesn't have, so deep links (/docs, /privacy)
// load the single-page site and its router takes over.
const pagesFallback = (outDir) => ({
  name: 'oruinwan-pages-fallback',
  apply: 'build',
  closeBundle() {
    copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
  },
});

export default defineConfig(({ mode }) => {
  const app = mode === 'app';
  const site = mode === 'site';
  const outDir = app ? path.resolve(__dirname, 'dist-app') : site ? path.resolve(__dirname, 'dist-site') : path.resolve(__dirname, '../dist');
  // A server-hosted build made without VITE_BACKEND_URL (the Docker image) talks to the server
  // it was loaded from, so one build works on any domain.
  const env = loadEnv(mode, __dirname, 'VITE_');
  const sameOrigin = !app && !site && !env.VITE_BACKEND_URL
    ? {
        'import.meta.env.VITE_BACKEND_URL': 'globalThis.location.origin',
        ...(env.VITE_API_URL ? {} : { 'import.meta.env.VITE_API_URL': '"/api"' }),
      }
    : {};
  return {
    plugins: [react(), ...(app || site ? [pruneAppBundle(outDir)] : []), ...(site ? [pagesFallback(outDir)] : [])],

    base: site ? process.env.SITE_BASE || '/' : '/',

    define: app
      ? {
          'import.meta.env.VITE_BACKEND_URL': 'globalThis.__ORUINWAN_SERVER__',
          'import.meta.env.VITE_API_URL': 'globalThis.__ORUINWAN_API__',
          // Google sign-in is tied to the web origin it was registered for; apps don't offer it.
          'import.meta.env.VITE_GOOGLE_CLIENT_ID': '""',
          // The Oruinwan app version (mobile/package.json), for the in-app update check.
          'import.meta.env.VITE_ORUINWAN_APP_VERSION': JSON.stringify(process.env.ORUINWAN_APP_VERSION || '0.0.0'),
        }
      : sameOrigin,

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
      outDir,
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
  };
});
