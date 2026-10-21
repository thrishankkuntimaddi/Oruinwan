// Scans a sign-in QR code. Android uses Google's scanner screen; elsewhere the camera shows in
// this sheet (src/native/scanner.js). Pasting the code always works.
import { useEffect, useRef, useState } from 'react';
import { Camera, ClipboardPaste, QrCode } from 'lucide-react';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cameraAvailable, createDetector, nativeScan, openCamera, usesNativeScanner } from '../../native/scanner.js';
import { parseSignInQr } from '../../data/live/adapter.signin.js';

function CameraView({ onText, onFail }) {
  const video = useRef(null);
  useEffect(() => {
    let stream = null;
    let stopped = false;
    let timer = null;
    (async () => {
      try {
        const detector = await createDetector();
        stream = await openCamera();
        if (stopped) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => {});
        const tick = async () => {
          if (stopped) return;
          try {
            if (video.current?.readyState >= 2) {
              const found = await detector.detect(video.current);
              const text = found?.[0]?.rawValue;
              if (text && onText(text) !== false) return;
            }
          } catch {
            /* next frame */
          }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (err) {
        onFail(err?.name === 'NotAllowedError' ? 'Camera access is off. Allow it in your settings, or paste the code below.' : "The camera couldn't start. Paste the code below.");
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-line bg-black">
      <video ref={video} className="h-full w-full object-cover" muted playsInline aria-label="Camera" />
      <div aria-hidden className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/80" />
    </div>
  );
}

/**
 * open / onClose; onCode(code) gets the parsed sign-in code. `hint` explains where the QR is.
 */
export function QrScanSheet({ open, onClose, onCode, title = 'Scan QR code', hint }) {
  const [mode, setMode] = useState('idle'); // idle | camera | paste
  const [error, setError] = useState('');
  const [pasted, setPasted] = useState('');

  const accept = (text) => {
    const code = parseSignInQr(text);
    if (!code) {
      setError("That isn't an Oruinwan sign-in code.");
      return false;
    }
    setError('');
    onCode(code);
    return true;
  };

  const start = async () => {
    setError('');
    if (usesNativeScanner()) {
      try {
        const text = await nativeScan();
        if (text) accept(text);
        return;
      } catch (err) {
        if (err?.code !== 'UNAVAILABLE') {
          setError(err?.message || "Couldn't scan. Paste the code instead.");
          return;
        }
      }
    }
    if (cameraAvailable()) setMode('camera');
    else setMode('paste');
  };

  useEffect(() => {
    if (!open) {
      setMode('idle');
      setError('');
      setPasted('');
      return;
    }
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="px-5 pb-5">
        {hint && <p className="mb-4 text-sm text-text-2">{hint}</p>}
        {mode === 'camera' && (
          <CameraView
            onText={accept}
            onFail={(msg) => {
              setError(msg);
              setMode('paste');
            }}
          />
        )}
        {mode === 'idle' && (
          <div className="flex flex-col items-center py-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
              <Icon as={QrCode} />
            </span>
            <Button className="mt-4" icon={Camera} onClick={start}>
              Open the scanner
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {mode !== 'paste' ? (
          <button type="button" className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-accent-ink" onClick={() => setMode('paste')}>
            <Icon as={ClipboardPaste} size="sm" /> Paste the code instead
          </button>
        ) : (
          <form
            className="mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              accept(pasted);
            }}
          >
            <Field label="Sign-in code" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="oruinwan://signin?c=…" autoCapitalize="none" autoCorrect="off" />
            <Button type="submit" block className="mt-3" disabled={!pasted.trim()}>
              Continue
            </Button>
          </form>
        )}
      </div>
    </Sheet>
  );
}
