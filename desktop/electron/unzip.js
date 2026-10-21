'use strict';

/**
 * A small zip reader for over-the-air UI bundles (ota.js): stored and deflated entries, no
 * zip64, no encryption. The bundle's SHA-256 and signature are checked before this runs; it
 * still refuses unsafe names (absolute paths, "..") and caps sizes so a bad archive can't
 * write outside the target folder or fill the disk.
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const LIMITS = { maxEntries: 20000, maxTotalBytes: 400 * 1024 * 1024 };

function findEndOfCentralDirectory(buf) {
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('Not a zip archive');
}

/** Safe relative path for an entry name, or null for directories. Throws on unsafe names. */
function safeName(name) {
  if (!name || name.includes('\\') || name.includes('\0') || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    throw new Error(`Unsafe file name in archive: ${JSON.stringify(name)}`);
  }
  const parts = name.split('/');
  if (parts.some((p) => p === '..')) throw new Error(`Unsafe file name in archive: ${JSON.stringify(name)}`);
  if (name.endsWith('/')) return null;
  return parts.filter((p) => p && p !== '.').join('/');
}

/** Lists { name, method, compressedSize, size, dataStart } for every file entry. */
function readEntries(buf, limits = LIMITS) {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (count > limits.maxEntries) throw new Error('Too many files in archive');
  const entries = [];
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('Damaged zip archive');
    const flags = buf.readUInt16LE(offset + 8);
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const size = buf.readUInt32LE(offset + 24);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const local = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
    offset += 46 + nameLen + extraLen + commentLen;
    if (flags & 1) throw new Error('Encrypted zip archives are not supported');
    if (compressedSize === 0xffffffff || size === 0xffffffff || local === 0xffffffff) throw new Error('zip64 archives are not supported');
    const rel = safeName(name);
    if (rel === null) continue;
    if (method !== 0 && method !== 8) throw new Error(`Unsupported compression in archive (${method})`);
    total += size;
    if (total > limits.maxTotalBytes) throw new Error('Archive is too large');
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Damaged zip archive');
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (dataStart + compressedSize > buf.length) throw new Error('Damaged zip archive');
    entries.push({ name: rel, method, compressedSize, size, dataStart });
  }
  return entries;
}

/** Extracts a zip (Buffer) into `dest`, which must not exist yet. Returns the file names. */
function extractZip(buf, dest, limits = LIMITS) {
  const entries = readEntries(buf, limits);
  fs.mkdirSync(dest, { recursive: true });
  const root = path.resolve(dest) + path.sep;
  for (const entry of entries) {
    const target = path.resolve(dest, entry.name);
    if (!target.startsWith(root)) throw new Error(`Unsafe file name in archive: ${entry.name}`);
    const raw = buf.subarray(entry.dataStart, entry.dataStart + entry.compressedSize);
    const data = entry.method === 0 ? raw : zlib.inflateRawSync(raw, { maxOutputLength: Math.max(entry.size, 1) });
    if (data.length !== entry.size) throw new Error(`Damaged file in archive: ${entry.name}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  return entries.map((e) => e.name);
}

module.exports = { extractZip, readEntries, safeName, LIMITS };
