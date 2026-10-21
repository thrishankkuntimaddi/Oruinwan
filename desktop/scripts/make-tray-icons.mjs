// Renders the tray icons into assets/tray/ (committed; re-run after changing assets/icon.png):
//   node scripts/make-tray-icons.mjs
//
//  - trayTemplate.png / @2x, trayUnreadTemplate.png / @2x — macOS menu bar template images
//    (black + alpha only; macOS tints them for light/dark menu bars). The logo is too detailed
//    for 16pt, so this is a simple glyph: a ring with the logo's three "typing" dots.
//  - tray.png / @2x, tray-unread.png / @2x (Windows, 16px + 32px) and tray-32.png,
//    tray-unread-32.png (Linux): assets/icon.png scaled down.
// The unread variants carry a dot in the top-right corner.
// Pure Node (zlib), no image dependency.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets', 'tray');
mkdirSync(out, { recursive: true });

// ─── PNG codec (8-bit RGBA, non-interlaced) ───────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function decodePng(buf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('icon.png must be 8-bit RGBA, non-interlaced');
    } else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[y * stride + x] = v & 0xff;
    }
  }
  return { width, height, data: px };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

/** Area-average downscale of a square crop [x0, x0+size) of img to n×n (alpha-weighted). */
function downscale(img, x0, y0, size, n) {
  const data = Buffer.alloc(n * n * 4);
  const step = size / n;
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = Math.floor(y0 + ty * step); sy < Math.floor(y0 + (ty + 1) * step); sy++) {
        for (let sx = Math.floor(x0 + tx * step); sx < Math.floor(x0 + (tx + 1) * step); sx++) {
          const i = (sy * img.width + sx) * 4;
          const al = img.data[i + 3];
          r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al;
          count++;
        }
      }
      const o = (ty * n + tx) * 4;
      if (a > 0) {
        data[o] = Math.round(r / a); data[o + 1] = Math.round(g / a); data[o + 2] = Math.round(b / a);
      }
      data[o + 3] = Math.round(a / count);
    }
  }
  return { width: n, height: n, data };
}

/** Supersampled coverage of shape(x, y) → boolean over the pixel (in 0..1 icon units). */
function coverage(n, px, py, shape, ss = 6) {
  let hit = 0;
  for (let j = 0; j < ss; j++) {
    for (let i = 0; i < ss; i++) if (shape((px + (i + 0.5) / ss) / n, (py + (j + 0.5) / ss) / n)) hit++;
  }
  return hit / (ss * ss);
}

/** Alpha-composite a solid colour with per-pixel coverage of shape onto img. */
function paint(img, shape, [r, g, b]) {
  const n = img.width;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cov = coverage(n, x, y, shape);
      if (!cov) continue;
      const o = (y * n + x) * 4;
      const da = img.data[o + 3] / 255;
      const outA = cov + da * (1 - cov);
      for (const [k, v] of [[0, r], [1, g], [2, b]]) {
        img.data[o + k] = Math.round((v * cov + img.data[o + k] * da * (1 - cov)) / outA);
      }
      img.data[o + 3] = Math.round(outA * 255);
    }
  }
}

/** Clear (make transparent) wherever shape covers. */
function erase(img, shape) {
  const n = img.width;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cov = coverage(n, x, y, shape);
      if (cov) img.data[(y * n + x) * 4 + 3] = Math.round(img.data[(y * n + x) * 4 + 3] * (1 - cov));
    }
  }
}

const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const ring = (cx, cy, r1, r2) => (x, y) => {
  const d = (x - cx) ** 2 + (y - cy) ** 2;
  return d <= r2 * r2 && d >= r1 * r1;
};
const blank = (n) => ({ width: n, height: n, data: Buffer.alloc(n * n * 4) });

// The unread dot: top-right, with a transparent gap around it so it reads on any background.
const DOT = { cx: 0.81, cy: 0.19, r: 0.17, gap: 0.25 };
const GOLD = [232, 190, 112]; // the logo's gold

function template(n, unread) {
  const img = blank(n);
  const black = [0, 0, 0];
  paint(img, ring(0.5, 0.5, 0.34, 0.46), black);
  for (const cx of [0.3, 0.5, 0.7]) paint(img, circle(cx, 0.5, 0.075), black);
  if (unread) {
    erase(img, circle(DOT.cx, DOT.cy, DOT.gap));
    paint(img, circle(DOT.cx, DOT.cy, DOT.r), black);
  }
  return img;
}

const logo = decodePng(readFileSync(join(root, 'assets', 'icon.png')));
// The rounded square spans ~10%..90% of icon.png; crop to it so the tray icon fills its slot.
const crop = Math.round(logo.width * 0.8);
const offset = Math.round(logo.width * 0.1);

function colour(n, unread) {
  const img = downscale(logo, offset, offset, crop, n);
  if (unread) {
    paint(img, circle(DOT.cx, DOT.cy, DOT.gap), [0, 0, 0]); // the icon's black, as a rim
    paint(img, circle(DOT.cx, DOT.cy, DOT.r), GOLD);
  }
  return img;
}

const files = {
  'trayTemplate.png': template(16, false),
  'trayTemplate@2x.png': template(32, false),
  'trayUnreadTemplate.png': template(16, true),
  'trayUnreadTemplate@2x.png': template(32, true),
  'tray.png': colour(16, false),
  'tray@2x.png': colour(32, false),
  'tray-unread.png': colour(16, true),
  'tray-unread@2x.png': colour(32, true),
  'tray-32.png': colour(32, false),
  'tray-unread-32.png': colour(32, true),
};
for (const [name, img] of Object.entries(files)) {
  writeFileSync(join(out, name), encodePng(img));
  console.log(`assets/tray/${name} (${img.width}px)`);
}
