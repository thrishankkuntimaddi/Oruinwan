// The phone's sticker cut-out engine: MediaPipe from the app bundle (its JavaScript), its
// WebAssembly from the Oruinwan server (/vendor/mediapipe, platform/media/cutout.js), the model
// from Google. Loaded once on first use and kept for the session.
import { createCutter, vendorPath } from '../../../../platform/media/cutout.js';
import { useSession } from '../../data/session.js';
import { webUrlFor } from '../../data/live/webUrl.js';
import { isDesktop, isNative } from '../../native/index.js';

let cutter = null;

/** Where the server's web files are: the page's own origin in a browser, else the server's website. */
export function engineBase() {
  if (!isNative && !isDesktop && typeof window !== 'undefined') return window.location.origin;
  return webUrlFor(useSession.getState().server);
}

/** Resolves the cutter ({ setImage, cut, close }); `onStage` reports engine / model / ready. */
export function getCutter(onStage) {
  if (!cutter) {
    cutter = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      return createCutter(vision, { wasmBase: vendorPath(engineBase()), onStage });
    })().catch((err) => {
      cutter = null;
      throw new Error(/fetch|load|network|404/i.test(String(err?.message)) ? "Couldn't download the cut-out tool. Check your connection and try again." : err?.message || 'Cut-out failed');
    });
  } else onStage?.('ready');
  return cutter;
}
