// PDF pages for design review pins. The phone's WebView has no PDF renderer, so pages are drawn
// with pdf.js (legacy build: runs on older Android System WebViews and iOS WKWebView) into a
// canvas, and pins sit on top of it in the same normalised coordinates as on images.
// pdf.js is loaded on first use, so it never weighs on app start.

let lib = null;
async function pdfjs() {
  if (!lib) {
    lib = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([m, worker]) => {
      m.GlobalWorkerOptions.workerSrc = worker.default;
      return m;
    });
    lib.catch(() => {
      lib = null;
    });
  }
  return lib;
}

/** Opens a PDF from a URL the app can fetch (signed or proxied). Resolves with the pdf.js document. */
export async function openPdf(url, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Couldn't load the PDF (${res.status}).`);
  const data = new Uint8Array(await res.arrayBuffer());
  const m = await pdfjs();
  return m.getDocument({ data, isEvalSupported: false }).promise;
}

/** Scale that fits a page `pageWidth` points wide into `boxWidth` CSS pixels (never upscaled past 2x). */
export function fitScale(pageWidth, boxWidth) {
  if (!(pageWidth > 0) || !(boxWidth > 0)) return 1;
  return Math.min(2, boxWidth / pageWidth);
}

/** Clamps a page number into 1..count. */
export function clampPage(page, count) {
  const n = Math.max(1, Math.floor(Number(page) || 1));
  return count > 0 ? Math.min(n, count) : n;
}

/**
 * Draws page `n` of `doc` into `canvas`, `boxWidth` CSS pixels wide, sharp on high-density screens.
 * Returns a cancel function.
 */
export function drawPage(doc, n, canvas, boxWidth, dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1) {
  let task = null;
  let cancelled = false;
  const done = doc.getPage(n).then((page) => {
    if (cancelled) return;
    const base = page.getViewport({ scale: 1 });
    const scale = fitScale(base.width, boxWidth);
    const view = page.getViewport({ scale: scale * dpr });
    canvas.width = Math.floor(view.width);
    canvas.height = Math.floor(view.height);
    canvas.style.width = `${Math.floor(view.width / dpr)}px`;
    canvas.style.height = `${Math.floor(view.height / dpr)}px`;
    task = page.render({ canvasContext: canvas.getContext('2d'), viewport: view });
    return task.promise;
  });
  return {
    done,
    cancel() {
      cancelled = true;
      task?.cancel();
    },
  };
}
