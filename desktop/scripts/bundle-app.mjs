// Builds the Oruinwan app (../mobile, Vite) and copies it into app/, which the desktop shell
// serves from app://oruinwan. Set ORUINWAN_SKIP_WEB_BUILD=1 to copy an existing mobile/dist.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(root, '..', 'mobile');
const dist = join(mobile, 'dist');
const target = join(root, 'app');

if (process.env.ORUINWAN_SKIP_WEB_BUILD !== '1') {
  execSync('npm run build', { cwd: mobile, stdio: 'inherit' });
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No app build at ${dist}. Run "npm ci" in mobile/ first.`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
// webview-update.html is the Android "update your WebView" page; the desktop never needs it.
cpSync(dist, target, { recursive: true, filter: (src) => !src.endsWith('webview-update.html') });
console.log(`Bundled ${dist} → ${target}`);
