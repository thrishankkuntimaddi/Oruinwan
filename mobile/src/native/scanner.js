// QR scanning for sign-in.
//
//  - Android app: Google's code scanner through @capacitor-mlkit/barcode-scanning (a system
//    screen; the app itself doesn't need the camera for it).
//  - iPhone / iPad app, desktop and browsers: the camera in the page (getUserMedia) with the
//    browser's BarcodeDetector, or the barcode-detector ponyfill (ZXing, WebAssembly bundled
//    with the app, nothing fetched from elsewhere) where there is none. The ML Kit plugin needs
//    CocoaPods on iOS and this app uses Swift Package Manager, so iOS scans in the page.
//  - Anywhere scanning isn't possible the screen offers to paste the code.
import { isAndroid, isNative } from './index.js';

/** Android: one scan with Google's scanner. → the text, null when cancelled. Throws UNAVAILABLE. */
export async function nativeScan() {
  if (!(isNative && isAndroid)) throw Object.assign(new Error('Native scanner unavailable'), { code: 'UNAVAILABLE' });
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
  const { supported } = await BarcodeScanner.isSupported().catch(() => ({ supported: false }));
  if (!supported) throw Object.assign(new Error('Native scanner unavailable'), { code: 'UNAVAILABLE' });
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable().catch(() => ({ available: false }));
  if (!available) {
    // First use: Play services downloads the scanner module; wait for it (up to a minute).
    await new Promise((resolve, reject) => {
      let handle;
      const timer = setTimeout(() => {
        handle?.remove?.();
        reject(Object.assign(new Error('The scanner is still downloading. Try again in a moment.'), { code: 'UNAVAILABLE' }));
      }, 60000);
      BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (e) => {
        // state 4 = COMPLETED, 5 = FAILED, 3 = CANCELED (Google's ModuleInstallStatusUpdate)
        if (e?.state === 4) {
          clearTimeout(timer);
          handle?.remove?.();
          resolve();
        } else if (e?.state === 5 || e?.state === 3) {
          clearTimeout(timer);
          handle?.remove?.();
          reject(Object.assign(new Error("Couldn't get the scanner ready."), { code: 'UNAVAILABLE' }));
        }
      }).then((h) => {
        handle = h;
      });
      BarcodeScanner.installGoogleBarcodeScannerModule().catch(reject);
    });
  }
  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    return barcodes?.[0]?.rawValue || barcodes?.[0]?.displayValue || null;
  } catch (err) {
    if (/cancel/i.test(err?.message || '')) return null;
    throw err;
  }
}

/** Is the native scanner the way to scan here? */
export const usesNativeScanner = () => isNative && isAndroid;

/** Can this device show the camera in the page? */
export const cameraAvailable = () => Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);

let ponyfill = null;

/** A detector with detect(source) → [{ rawValue }], native when the browser has one. */
export async function createDetector() {
  const Native = globalThis.BarcodeDetector;
  if (Native) {
    try {
      const formats = (await Native.getSupportedFormats?.()) || ['qr_code'];
      if (formats.includes('qr_code')) return new Native({ formats: ['qr_code'] });
    } catch {
      /* fall through to the ponyfill */
    }
  }
  ponyfill ||= (async () => {
    const [mod, wasm] = await Promise.all([import('barcode-detector/ponyfill'), import('zxing-wasm/reader/zxing_reader.wasm?url')]);
    mod.prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasm.default : prefix + path) } });
    return mod.BarcodeDetector;
  })();
  const Detector = await ponyfill;
  return new Detector({ formats: ['qr_code'] });
}

/** Opens the back camera. The caller stops the stream's tracks when done. */
export function openCamera() {
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
}
