// Builds the Oruinwan web client in app mode (../client, `vite build --mode app`) and copies it
// into app/, which the desktop shell serves from app://oruinwan. The app version comes from
// mobile/package.json, the one version number for every platform.
// Set ORUINWAN_SKIP_WEB_BUILD=1 to copy an existing client/dist-app instead.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = join(root, '..', 'client');
const dist = join(client, 'dist-app');
const target = join(root, 'app');
const version = JSON.parse(readFileSync(join(root, '..', 'mobile', 'package.json'), 'utf8')).version;

if (process.env.ORUINWAN_SKIP_WEB_BUILD !== '1') {
  execSync('npx vite build --mode app', {
    cwd: client,
    stdio: 'inherit',
    env: { ...process.env, ORUINWAN_APP_VERSION: version },
  });
}
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No app build at ${dist}. Install the client's dependencies (yarn install at the repo root) first.`);
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(dist, target, { recursive: true });
// The public key for signed quick updates (docs/UPDATES.md), shipped next to main.js.
// ORUINWAN_UPDATE_PUBLIC_KEY overrides platform/update-public-key.txt (e.g. for a fork).
const keyFile = join(root, '..', 'platform', 'update-public-key.txt');
const key = process.env.ORUINWAN_UPDATE_PUBLIC_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '');
writeFileSync(join(root, 'electron', 'update-public-key.txt'), key.endsWith('\n') ? key : `${key}\n`);
console.log(`Bundled ${dist} → ${target} (version ${version})`);
