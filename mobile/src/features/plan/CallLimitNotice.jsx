// The free plan's 30-minute calls: a banner under the call bar at 5 and 1 minute left, and a
// clear message when the call is ended at the limit. Mounted in the huddle layer.
import { Clock, X } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { dismissEndedNotice, dismissTimeWarning, useHuddle } from '../huddles/huddle.js';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { COMING_SOON, timeWarningText } from './planText.js';
import { openPricing } from './plan.js';

export function CallTimeBanner() {
  const call = useHuddle((s) => s.call);
  const warning = useHuddle((s) => s.timeWarning);
  const text = call ? timeWarningText(warning) : null;
  if (!text) return null;
  return (
    <div
      role="status"
      aria-live="assertive"
      data-testid="call-time-warning"
      className="glass-strong fixed inset-x-3 z-[60] mx-auto flex max-w-lg items-center gap-2.5 rounded-2xl border px-3 py-2.5 animate-sheet-in"
      style={{ top: 'calc(env(safe-area-inset-top) + 124px)', borderLeft: '3px solid rgb(var(--c-warning))' }}
    >
      <Icon as={Clock} size={16} className="shrink-0 text-warning" />
      <span className="min-w-0 flex-1 text-[13px] font-medium">{text}</span>
      <button type="button" aria-label="Dismiss" onClick={dismissTimeWarning} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-3 active:bg-surface-2">
        <Icon as={X} size={16} />
      </button>
    </div>
  );
}

export function CallEndedNotice() {
  const notice = useHuddle((s) => s.endedNotice);
  return (
    <Sheet
      open={Boolean(notice)}
      onClose={dismissEndedNotice}
      title="Call ended"
      footer={
        <div className="flex gap-2.5">
          {notice?.meetingId ? (
            <Button
              variant="secondary"
              block
              onClick={() => {
                const id = notice.meetingId;
                dismissEndedNotice();
                nav.push('meeting', { id, tab: 'notes' });
              }}
            >
              Open notes
            </Button>
          ) : (
            <Button
              variant="secondary"
              block
              onClick={() => {
                openPricing();
                dismissEndedNotice();
              }}
            >
              See plans
            </Button>
          )}
          <Button block onClick={dismissEndedNotice}>
            OK
          </Button>
        </div>
      }
    >
      <div className="px-5 pb-4" data-testid="call-time-ended">
        <p className="text-[15px] leading-snug">{notice?.message}</p>
        <p className="mt-2 text-[13px] text-text-2">{COMING_SOON}</p>
      </div>
    </Sheet>
  );
}
