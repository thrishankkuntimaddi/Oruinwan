#!/usr/bin/env node
// Ed25519 key for over-the-air UI bundle updates (docs/UPDATES.md).
//
//   node scripts/update-signing.mjs keygen [dir]
//       Creates a new key pair: <dir>/ota-ed25519-private.pem (keep secret; paste the whole file
//       into the GitHub Actions secret ORUINWAN_UPDATE_SIGNING_KEY) and prints the public key,
//       which goes into platform/update-public-key.txt. Default dir: ~/.local/oruinwan-signing.
//
//   node scripts/update-signing.mjs public
//       Prints the public key for the private key in $ORUINWAN_UPDATE_SIGNING_KEY.
//
// Changing the key means every installed app refuses bundles signed with the new one until it
// gets a full install that carries the new public key, so keep the private key safe and stable.
import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [command, arg] = process.argv.slice(2);

function rawPublic(publicKey) {
  // SPKI DER for Ed25519 is a 12-byte prefix followed by the 32-byte key.
  return publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64');
}

if (command === 'keygen') {
  const dir = arg || join(homedir(), '.local', 'oruinwan-signing');
  const file = join(dir, 'ota-ed25519-private.pem');
  if (existsSync(file)) {
    console.error(`${file} already exists. Refusing to overwrite it.`);
    process.exit(1);
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  writeFileSync(file, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  chmodSync(file, 0o600);
  console.log(`Private key: ${file}`);
  console.log(`Public key (platform/update-public-key.txt): ${rawPublic(publicKey)}`);
} else if (command === 'public') {
  const pem = process.env.ORUINWAN_UPDATE_SIGNING_KEY;
  if (!pem) {
    console.error('Set ORUINWAN_UPDATE_SIGNING_KEY to the private key (PEM).');
    process.exit(1);
  }
  console.log(rawPublic(createPublicKey(createPrivateKey(pem))));
} else {
  console.error('usage: update-signing.mjs keygen [dir] | public');
  process.exit(1);
}
