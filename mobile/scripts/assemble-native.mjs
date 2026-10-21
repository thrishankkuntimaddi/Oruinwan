// Assembles www/, the bundle the Android and iOS apps load (capacitor.config.json → webDir):
// this app's UI (dist/, `npm run build`) on every device. Phones get the one-screen layout;
// tablets and iPads get the split and wide layouts of the same UI (src/app/layout.js).
//
// Until 1.4 tablets ran the web client (../client) from www/ and phones were sent to www/phone/.
// The web client is no longer bundled in the native apps; the desktop apps (../desktop) still use it.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const phoneDist = join(root, 'dist');
const www = join(root, 'www');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

if (!existsSync(join(phoneDist, 'index.html'))) {
  console.error('No app UI build in dist/. Run `npm run build` first.');
  process.exit(1);
}

rmSync(www, { recursive: true, force: true });
cpSync(phoneDist, www, { recursive: true });

// The old phone entry point (www/phone/index.html) forwards to the root, in case anything still
// opens it (a WebView restoring its last URL after the update).
mkdirSync(join(www, 'phone'), { recursive: true });
writeFileSync(
  join(www, 'phone', 'index.html'),
  `<!doctype html><meta charset="utf-8"><script>location.replace('../index.html' + location.search + location.hash)</script>\n`,
);

console.log(`Assembled ${www}: the app UI for phones and tablets (version ${version})`);
