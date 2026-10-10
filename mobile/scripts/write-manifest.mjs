// Writes the update manifest the app reads (see src/update/manifest.js).
// Usage: node scripts/write-manifest.mjs <apk> <out.json> [--notes notes.md] [--min 1.0.0] [--url https://…] [--version x.y.z]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [apk, out, ...rest] = process.argv.slice(2);
if (!apk || !out) {
  console.error('usage: write-manifest.mjs <apk> <out.json> [--notes file] [--min version] [--url apkUrl]');
  process.exit(1);
}
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const version = opt('version') || JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const repo = process.env.GITHUB_REPOSITORY || 'thrishankkuntimaddi/Oruniwan';
const tag = process.env.RELEASE_TAG || `mobile-v${version}`;
const manifest = {
  version,
  apkUrl: opt('url') || `https://github.com/${repo}/releases/download/${tag}/Oruinwan-Android.apk`,
  pageUrl: `https://github.com/${repo}/releases/tag/${tag}`,
  sha256: createHash('sha256').update(readFileSync(apk)).digest('hex'),
  size: readFileSync(apk).length,
  notes: opt('notes') ? readFileSync(opt('notes'), 'utf8').trim() : '',
  minVersion: opt('min') || null,
  publishedAt: new Date().toISOString(),
};
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${out}: ${version} sha256=${manifest.sha256}`);
