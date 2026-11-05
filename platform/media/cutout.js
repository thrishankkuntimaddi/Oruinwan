// Sticker cut-outs: keep only the person or thing you tap, drop the background. Runs on the
// device with Google's MediaPipe Interactive Segmenter (Apache-2.0): nothing is uploaded.
//
// The apps pass in the `@mediapipe/tasks-vision` module (each app has it as a dependency) and
// where its WebAssembly engine is served: the Oruinwan server hosts it at /vendor/mediapipe/<v>/
// (client/vite.config.js copies it into the web build), so app updates stay small and the engine
// downloads the first time someone cuts out a sticker. The model comes from Google's storage.

export const MEDIAPIPE_VERSION = '1.2.2';
export const CUTOUT_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/1/interactive_segmentation.task';
/** Roughly what the first cut-out downloads (engine + model), for the "one-time download" note. */
export const CUTOUT_DOWNLOAD_MB = 45;
export const vendorPath = (base = '') => `${String(base).replace(/\/+$/, '')}/vendor/mediapipe/${MEDIAPIPE_VERSION}`;

const BRUSH = { add: 1, remove: 2 }; // BrushMode.POSITIVE / NEGATIVE

/** Taps ({ x, y } in 0..1, mode 'add' | 'remove') → the segmenter's strokes. */
export function strokesFor(taps) {
  return (taps || []).map((t) => ({ brushMode: BRUSH[t.mode] || BRUSH.add, point: [{ x: clamp01(t.x), y: clamp01(t.y) }], isCompleted: true }));
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

/**
 * A segmenter's mask → { width, height, alpha: Uint8ClampedArray } (255 = keep). Masks come as
 * confidences (0..1) or categories (0/1 or 0..255); `taps` fixes the polarity, so the tapped
 * subject is always what is kept.
 */
export function alphaFromMask({ width, height, data }, taps = []) {
  const n = width * height;
  const alpha = new Uint8ClampedArray(n);
  let max = 0;
  for (let i = 0; i < n; i++) if (data[i] > max) max = data[i];
  const scale = max <= 1.0001 ? 255 : 1;
  for (let i = 0; i < n; i++) alpha[i] = data[i] * scale;
  const adds = taps.filter((t) => t.mode !== 'remove');
  if (adds.length) {
    const at = (t) => alpha[Math.min(height - 1, Math.floor(clamp01(t.y) * height)) * width + Math.min(width - 1, Math.floor(clamp01(t.x) * width))];
    const kept = adds.filter((t) => at(t) >= 128).length;
    if (kept * 2 < adds.length) for (let i = 0; i < n; i++) alpha[i] = 255 - alpha[i];
  }
  return { width, height, alpha };
}

/** How much of the picture is kept (0..1): an empty cut-out (0) is reported to the person. */
export function keptShare({ alpha }) {
  let k = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] >= 128) k++;
  return alpha.length ? k / alpha.length : 0;
}

/** Box around the kept pixels in mask units ({ x, y, w, h }), or null when nothing is kept. */
export function keptBox({ width, height, alpha }, threshold = 40) {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < threshold) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function readMask(mp) {
  const width = mp.width;
  const height = mp.height;
  let data;
  if (mp.hasFloat32Array?.()) data = mp.getAsFloat32Array();
  else if (mp.hasUint8Array?.()) data = mp.getAsUint8Array();
  else data = mp.getAsFloat32Array?.() || mp.getAsUint8Array();
  return { width, height, data };
}

/**
 * Loads the engine and model once and returns { setImage(img), cut(taps) → mask, close() }.
 * `onStage('engine' | 'model' | 'ready')` lets the screen say what is happening.
 */
export async function createCutter(vision, { wasmBase, modelUrl = CUTOUT_MODEL_URL, onStage } = {}) {
  if (!vision?.InteractiveSegmenter) throw new Error('Cut-outs are not available in this version');
  onStage?.('engine');
  const fileset = { wasmLoaderPath: `${wasmBase}/vision_wasm_internal.js`, wasmBinaryPath: `${wasmBase}/vision_wasm_internal.wasm` };
  onStage?.('model');
  const segmenter = await vision.InteractiveSegmenter.createFromOptions(fileset, { baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' } });
  onStage?.('ready');
  return {
    setImage(image) {
      segmenter.setImage(image);
    },
    cut(taps) {
      const mp = segmenter.segment(strokesFor(taps));
      try {
        return alphaFromMask(readMask(mp), taps);
      } finally {
        mp.close?.();
      }
    },
    close() {
      segmenter.close();
    },
  };
}

/** A canvas (size × size) holding the mask as alpha, smoothed a little at the edges. */
export function maskCanvas(mask, size) {
  const src = document.createElement('canvas');
  src.width = mask.width;
  src.height = mask.height;
  const img = new ImageData(mask.width, mask.height);
  for (let i = 0; i < mask.alpha.length; i++) img.data[i * 4 + 3] = mask.alpha[i];
  src.getContext('2d').putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if ('filter' in ctx) ctx.filter = `blur(${Math.max(0.6, size / 600)}px)`;
  ctx.drawImage(src, 0, 0, size, size);
  return out;
}
