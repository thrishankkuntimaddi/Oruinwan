'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const ota = require('../ota');
const { extractZip, safeName } = require('../unzip');

/** A minimal zip writer for tests: entries [{ name, data, deflate }]. */
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data = Buffer.alloc(0), deflate = false } of entries) {
    const nameBuf = Buffer.from(name);
    const body = deflate ? zlib.deflateRawSync(data) : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'oruinwan-ota-'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const signed = (bytes, version, target = 'desktop') => ({
  version,
  sha256: sha(bytes),
  signature: crypto.sign(null, Buffer.from(ota.bundleMessage(target, version, sha(bytes))), privateKey).toString('base64'),
});
const appZip = (marker = 'new') => makeZip([
  { name: 'index.html', data: Buffer.from(`<html>${marker}</html>`), deflate: true },
  { name: 'assets/', data: Buffer.alloc(0) },
  { name: 'assets/app.js', data: Buffer.from('console.log(1)'.repeat(50)), deflate: true },
]);

test('unzip extracts stored and deflated files', () => {
  const dir = path.join(tmp(), 'out');
  const names = extractZip(appZip(), dir);
  assert.deepEqual(names.sort(), ['assets/app.js', 'index.html']);
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), '<html>new</html>');
  assert.equal(fs.readFileSync(path.join(dir, 'assets/app.js'), 'utf8'), 'console.log(1)'.repeat(50));
});

test('unzip refuses unsafe names and oversized archives', () => {
  for (const name of ['../evil.js', 'a/../../evil.js', '/etc/passwd', 'C:/x', 'a\\b']) {
    assert.throws(() => extractZip(makeZip([{ name, data: Buffer.from('x') }]), path.join(tmp(), 'o')), /Unsafe/);
  }
  assert.equal(safeName('dir/'), null);
  assert.throws(
    () => extractZip(makeZip([{ name: 'big', data: Buffer.alloc(100) }]), path.join(tmp(), 'o'), { maxEntries: 10, maxTotalBytes: 50 }),
    /too large/,
  );
  assert.throws(() => extractZip(Buffer.from('not a zip at all, definitely not'), path.join(tmp(), 'o')), /Not a zip/);
});

test('unzip reads archives made by the zip tool (as CI does)', (t) => {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch {
    t.skip('zip is not installed');
    return;
  }
  const src = tmp();
  fs.mkdirSync(path.join(src, 'assets'));
  fs.writeFileSync(path.join(src, 'index.html'), '<html>zip</html>');
  fs.writeFileSync(path.join(src, 'assets', 'a.js'), 'x'.repeat(5000));
  const zipFile = path.join(tmp(), 'b.zip');
  execFileSync('zip', ['-qr', '-X', zipFile, '.'], { cwd: src });
  const dir = path.join(tmp(), 'out');
  extractZip(fs.readFileSync(zipFile), dir);
  assert.equal(fs.readFileSync(path.join(dir, 'assets', 'a.js'), 'utf8'), 'x'.repeat(5000));
});

test('verifyBundle checks hash and signature, bound to target and version', () => {
  const bytes = appZip();
  const b = signed(bytes, '2.2.0');
  assert.equal(ota.verifyBundle(bytes, { target: 'desktop', ...b, publicKey: PUB }), b.sha256);
  assert.throws(() => ota.verifyBundle(Buffer.concat([bytes, Buffer.from('x')]), { target: 'desktop', ...b, publicKey: PUB }), { code: 'CHECKSUM' });
  assert.throws(() => ota.verifyBundle(bytes, { target: 'phone', ...b, publicKey: PUB }), { code: 'SIGNATURE' });
  assert.throws(() => ota.verifyBundle(bytes, { target: 'desktop', ...b, version: '2.3.0', publicKey: PUB }), { code: 'SIGNATURE' });
  assert.throws(() => ota.verifyBundle(bytes, { target: 'desktop', ...b, signature: null, publicKey: PUB }), { code: 'SIGNATURE' });
  assert.throws(() => ota.verifyBundle(bytes, { target: 'desktop', ...b, publicKey: '' }), { code: 'NO_KEY' });
});

test('public key file parsing and loading', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'update-public-key.txt'), `# comment\n${PUB}\n`);
  assert.equal(ota.loadPublicKey(dir, {}), PUB);
  assert.equal(ota.loadPublicKey(dir, { ORUINWAN_UPDATE_PUBLIC_KEY: 'bad' }), '');
  assert.equal(ota.parsePublicKey('# none'), '');
  // The repo's own key file parses.
  assert.match(ota.loadPublicKey(path.join(__dirname, '..'), {}), /^[A-Za-z0-9+/]{43}=$/);
});

test('stage → apply → boot → confirm', () => {
  const userData = tmp();
  const bundledDir = path.join(userData, 'bundled');
  const base = { userData, bundledDir, shellVersion: '2.1.0' };
  assert.equal(ota.chooseAppDir(base).source, 'bundled');

  const bytes = appZip();
  const staged = ota.stageBundle({ ...base, bytes, bundle: signed(bytes, '2.2.0'), publicKey: PUB });
  assert.equal(staged.version, '2.2.0');
  assert.equal(ota.stagedVersion(base), '2.2.0');
  // Staged only: still the bundled UI until applied.
  assert.equal(ota.chooseAppDir(base).source, 'bundled');

  assert.equal(ota.applyStaged(base), true);
  const first = ota.chooseAppDir(base);
  assert.deepEqual([first.source, first.version, first.pending], ['downloaded', '2.2.0', true]);
  assert.equal(fs.readFileSync(path.join(first.dir, 'index.html'), 'utf8'), '<html>new</html>');

  assert.equal(ota.confirm(base), true);
  const later = ota.chooseAppDir(base);
  assert.deepEqual([later.source, later.version, later.pending], ['downloaded', '2.2.0', false]);
  assert.equal(ota.confirm(base), false);
});

test('a bundle that never confirms is rolled back after two starts and not offered again', () => {
  const userData = tmp();
  const base = { userData, bundledDir: path.join(userData, 'bundled'), shellVersion: '2.1.0' };
  ota.chooseAppDir(base);
  const bytes = appZip('broken');
  ota.stageBundle({ ...base, bytes, bundle: signed(bytes, '2.2.0'), publicKey: PUB });
  ota.applyStaged(base);
  assert.equal(ota.chooseAppDir(base).pending, true); // start 1
  assert.equal(ota.chooseAppDir(base).pending, true); // start 2
  const third = ota.chooseAppDir(base); // start 3: rolled back
  assert.equal(third.source, 'bundled');
  assert.throws(() => ota.stageBundle({ ...base, bytes, bundle: signed(bytes, '2.2.0'), publicKey: PUB }), { code: 'BAD_VERSION' });
  assert.deepEqual(fs.readdirSync(path.join(userData, 'ui-bundles')), []);
});

test('in-session rollback returns to the last good bundle', () => {
  const userData = tmp();
  const base = { userData, bundledDir: path.join(userData, 'bundled'), shellVersion: '2.1.0' };
  ota.chooseAppDir(base);
  const good = appZip('good');
  ota.stageBundle({ ...base, bytes: good, bundle: signed(good, '2.2.0'), publicKey: PUB });
  ota.applyStaged(base);
  ota.chooseAppDir(base);
  ota.confirm(base);
  const bad = appZip('bad');
  ota.stageBundle({ ...base, bytes: bad, bundle: signed(bad, '2.3.0'), publicKey: PUB });
  ota.applyStaged(base);
  assert.equal(ota.chooseAppDir(base).version, '2.3.0');
  const back = ota.rollback(base);
  assert.deepEqual([back.source, back.version, back.pending], ['downloaded', '2.2.0', false]);
  assert.equal(fs.readFileSync(path.join(back.dir, 'index.html'), 'utf8'), '<html>good</html>');
});

test('a new app install (shell) forgets downloaded bundles; old shells get the installer', () => {
  const userData = tmp();
  const base = { userData, bundledDir: path.join(userData, 'bundled'), shellVersion: '2.1.0' };
  ota.chooseAppDir(base);
  const bytes = appZip();
  assert.throws(
    () => ota.stageBundle({ ...base, bytes, bundle: { ...signed(bytes, '2.2.0'), minNativeVersion: '2.2.0' }, publicKey: PUB }),
    { code: 'NATIVE' },
  );
  ota.stageBundle({ ...base, bytes, bundle: signed(bytes, '2.2.0'), publicKey: PUB });
  ota.applyStaged(base);
  ota.chooseAppDir(base);
  ota.confirm(base);
  const upgraded = ota.chooseAppDir({ ...base, shellVersion: '2.3.0' });
  assert.equal(upgraded.source, 'bundled');
  assert.deepEqual(fs.readdirSync(path.join(userData, 'ui-bundles')), []);
});

test('reset goes back to the bundled UI', () => {
  const userData = tmp();
  const base = { userData, bundledDir: path.join(userData, 'bundled'), shellVersion: '2.1.0' };
  ota.chooseAppDir(base);
  const bytes = appZip();
  ota.stageBundle({ ...base, bytes, bundle: signed(bytes, '2.2.0'), publicKey: PUB });
  ota.applyStaged(base);
  ota.chooseAppDir(base);
  ota.confirm(base);
  ota.reset(base);
  assert.equal(ota.chooseAppDir(base).source, 'bundled');
});

test('compareVersions', () => {
  assert.ok(ota.compareVersions('2.10.0', '2.9.9') > 0);
  assert.equal(ota.compareVersions('v2.1.0', '2.1.0'), 0);
  assert.ok(ota.compareVersions('x', '1.0.0') < 0);
});
