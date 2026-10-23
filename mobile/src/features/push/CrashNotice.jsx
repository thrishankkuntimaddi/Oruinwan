// "Oruinwan closed unexpectedly last time": shown once after a native crash (CrashLog.java),
// with the details to copy into a bug report.
import { useEffect, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { Clipboard } from '@capacitor/clipboard';
import { Icon } from '../../ui/Icon.jsx';
import { Button } from '../../ui/Button.jsx';
import { toast } from '../../lib/bus.js';
import { clearCrashReport, lastCrashReport } from '../../native/callSession.js';

export function CrashNotice() {
  const [report, setReport] = useState(null);
  useEffect(() => {
    let gone = false;
    lastCrashReport().then((r) => !gone && setReport(r));
    return () => {
      gone = true;
    };
  }, []);
  if (!report) return null;
  const close = () => {
    clearCrashReport();
    setReport(null);
  };
  return (
    <div
      role="status"
      data-testid="crash-notice"
      className="glass-strong fixed inset-x-3 z-[62] flex items-center gap-3 rounded-2xl border px-3 py-3 animate-sheet-in"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)', borderLeft: '3px solid rgb(var(--c-danger))' }}
    >
      <Icon as={TriangleAlert} size={18} className="shrink-0 text-danger" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">Oruinwan closed unexpectedly</span>
        <span className="block text-xs text-text-2">Copy the details and send them with a bug report.</span>
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await Clipboard.write({ string: report });
            toast('Crash details copied', 'success');
          } catch {
            toast('Could not copy', 'danger');
          }
          close();
        }}
      >
        Copy details
      </Button>
      <button type="button" aria-label="Dismiss" onClick={close} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-3 active:bg-surface-2">
        <Icon as={X} size={16} />
      </button>
    </div>
  );
}
