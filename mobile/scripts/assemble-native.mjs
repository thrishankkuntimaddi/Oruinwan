// Assembles www/, the bundle the Android and iOS apps load (capacitor.config.json → webDir):
//
//   www/            the Oruinwan web client in app mode (../client, `vite build --mode app`):
//                   tablets and iPads get the full desktop-class UI
//   www/phone/      this app's phone UI (dist/, `npm run build`)
//
// A tiny script at the top of www/index.html sends phones (shortest screen side under 600 dp)
// to phone/ before anything else loads. Set ORUINWAN_SKIP_WEB_BUILD=1 to reuse an existing
// client/dist-app (CI builds it once for every platform).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = join(root, '..', 'client');
const clientDist = join(client, 'dist-app');
const phoneDist = join(root, 'dist');
const www = join(root, 'www');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

if (!existsSync(join(phoneDist, 'index.html'))) {
  console.error('No phone UI build in dist/. Run `npm run build` first.');
  process.exit(1);
}
if (process.env.ORUINWAN_SKIP_WEB_BUILD !== '1') {
  execSync('npx vite build --mode app', { cwd: client, stdio: 'inherit', env: { ...process.env, ORUINWAN_APP_VERSION: version } });
}
if (!existsSync(join(clientDist, 'index.html'))) {
  console.error(`No web client app build at ${clientDist}. Install its dependencies (yarn install at the repo root) first.`);
  process.exit(1);
}

rmSync(www, { recursive: true, force: true });
cpSync(clientDist, www, { recursive: true });
cpSync(phoneDist, join(www, 'phone'), { recursive: true });
// Capacitor's error page for an outdated Android System WebView (capacitor.config.json → errorPath).
cpSync(join(phoneDist, 'webview-update.html'), join(www, 'webview-update.html'));

const PICK_UI = `<script>
      // Phones (shortest screen side under 600 dp) use the phone UI; tablets stay on the web client.
      (function () { try { if (Math.min(screen.width, screen.height) < 600) location.replace('/phone/index.html'); } catch (e) {} })();
    </script>`;
const indexPath = join(www, 'index.html');
const html = readFileSync(indexPath, 'utf8');
if (!/<head>/i.test(html)) throw new Error('www/index.html has no <head>');
// viewport-fit=cover: iPads report the safe areas (env(safe-area-inset-*)) the page pads by.
const appHtml = html
  .replace(/<head>/i, (head) => `${head}\n    ${PICK_UI}`)
  .replace(/(<meta name="viewport" content="[^"]*)"/i, (m, start) => (start.includes('viewport-fit') ? m : `${start}, viewport-fit=cover"`));
writeFileSync(indexPath, appHtml);

console.log(`Assembled ${www}: web client for tablets, phone UI in phone/ (version ${version})`);
