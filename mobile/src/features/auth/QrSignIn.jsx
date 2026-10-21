// "Scan QR code" on the start screen: sign in by scanning the code a signed-in computer shows
// (web or desktop: Settings → Devices → Sign in a phone). The computer confirms, then this
// device gets its session and its message key, so messages open right away.
import { useEffect, useRef, useState } from 'react';
import { Laptop, QrCode, TriangleAlert } from 'lucide-react';
import { useSession } from '../../data/session.js';
import { Header } from '../../ui/Screen.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { Spinner } from '../../ui/Feedback.jsx';
import { SERVER_URL } from '../../config/env.js';
import { deviceNoun, platformLabel } from '../../native/index.js';
import { qrMessage } from '../../data/live/adapter.signin.js';
import { QrScanSheet } from './QrScanSheet.jsx';

export const QR_POLL_MS = 2000;

const WRONG_SIDE = `This code is for signing in on a computer. Sign in on this ${deviceNoun} first, then scan it from Settings → Scan to sign in.`;

export function QrSignIn({ onBack, server = SERVER_URL }) {
  const qrClaim = useSession((s) => s.qrClaim);
  const qrPoll = useSession((s) => s.qrPoll);
  const qrForget = useSession((s) => s.qrForget);
  const [scanning, setScanning] = useState(true);
  const [claim, setClaim] = useState(null); // { code, secret, approver }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useRef(true);
  useEffect(() => () => {
    live.current = false;
  }, []);

  const onCode = async (code) => {
    setScanning(false);
    setBusy(true);
    setError('');
    try {
      const res = await qrClaim({ server, code });
      if (live.current) setClaim({ code, secret: res.secret, approver: res.approver });
    } catch (err) {
      if (live.current) setError(err.code === 'QR_WRONG_SIDE' ? WRONG_SIDE : qrMessage(err));
    } finally {
      if (live.current) setBusy(false);
    }
  };

  // Waiting for the computer to allow it.
  useEffect(() => {
    if (!claim) return undefined;
    let stop = false;
    let timer = null;
    const tick = async () => {
      try {
        const res = await qrPoll({ code: claim.code, secret: claim.secret });
        if (stop || res.status === 'done' || res.status === 'challenge') return;
      } catch (err) {
        if (stop) return;
        setClaim(null);
        setError(qrMessage(err));
        return;
      }
      timer = setTimeout(tick, QR_POLL_MS);
    };
    timer = setTimeout(tick, QR_POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [claim, qrPoll]);

  const again = () => {
    if (claim) qrForget(claim.code);
    setClaim(null);
    setError('');
    setScanning(true);
  };

  const me = platformLabel || `this ${deviceNoun}`;

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header title="Sign in with a QR code" onBack={onBack} />
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-10">
        {claim ? (
          <div className="mt-8 flex flex-col items-center text-center" data-testid="qr-waiting">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
              <Icon as={Laptop} />
            </span>
            <h2 className="mt-4 text-xl font-bold tracking-tight">Confirm on your computer</h2>
            <p className="mt-2 max-w-sm text-sm text-text-2">
              {claim.approver?.deviceName ? <span className="font-medium text-text">{claim.approver.deviceName}</span> : 'Your computer'} asks:
              “Allow {me} to sign in?” Choose Allow there.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-text-2">
              <Spinner /> Waiting for your computer…
            </div>
            <Button variant="secondary" className="mt-8" onClick={again}>
              Scan a different code
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-accent-ink">
              <Icon as={QrCode} />
            </span>
            <h2 className="mt-4 text-xl font-bold tracking-tight">Scan the code on your computer</h2>
            <p className="mt-2 max-w-sm text-sm text-text-2">
              On a computer where you're signed in to Oruinwan, open Settings → Devices → Sign in a phone, then scan the code it shows.
            </p>
            {error && (
              <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-left text-sm text-danger">
                <Icon as={TriangleAlert} size="sm" className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}
            <Button size="lg" className="mt-6" loading={busy} icon={QrCode} onClick={again}>
              Scan QR code
            </Button>
          </div>
        )}
      </div>
      <QrScanSheet
        open={scanning}
        onClose={() => setScanning(false)}
        onCode={onCode}
        hint="Point the camera at the code on your computer's screen."
      />
    </div>
  );
}
