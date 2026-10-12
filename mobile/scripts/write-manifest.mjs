// Writes the update manifest the apps read (see src/update/manifest.js): the APK for Android,
// and `downloads` with the desktop installers published in the same release.
// Usage: node scripts/write-manifest.mjs <apk> <out.json> [--notes notes.md] [--min 1.0.0] [--url https://…]
//                                         [--version x.y.z] [--android-only]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [apk, out, ...rest] = process.argv.slice(2);
if (!apk || !out) {
  console.error('usage: write-manifest.mjs <apk> <out.json> [--notes file] [--min version] [--url apkUrl] [--android-only]');
  process.exit(1);
}
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const version = opt('version') || JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const repo = process.env.GITHUB_REPOSITORY || 'thrishankkuntimaddi/Oruniwan';
const tag = process.env.RELEASE_TAG || `v${version}`;
const asset = (name) => `https://github.com/${repo}/releases/download/${tag}/${name}`;
// Stable names (see .github/workflows/apps.yml), so releases/latest/download/<name> links never change.
const downloads = rest.includes('--android-only')
  ? undefined
  : {
      'mac-arm64': asset('Oruinwan-Mac-AppleSilicon.dmg'),
      'mac-x64': asset('Oruinwan-Mac-Intel.dmg'),
      'win-x64': asset('Oruinwan-Windows-Setup.exe'),
      'linux-appimage': asset('Oruinwan-Linux.AppImage'),
      'linux-deb': asset('Oruinwan-Linux.deb'),
    };
const manifest = {
  version,
  apkUrl: opt('url') || asset('Oruinwan-Android.apk'),
  pageUrl: `https://github.com/${repo}/releases/tag/${tag}`,
  sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
  size: readFileSync(apk).length,
  notes: opt('notes') ? readFileSync(opt('notes'), 'utf8').trim() : '',
  minVersion: opt('min') || null,
  publishedAt: new Date().toISOString(),
  downloads,
};
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${out}: ${version} sha256=${manifest.sha256}`);
