// The "Meeting" panel of a running call: the call's meeting page (same tabs as the meeting
// screen) without leaving the call. A sheet on phones and split windows, a side panel on wide
// ones. Loaded on demand from the call bar (HuddleLayer.jsx).
import { useEffect, useState } from 'react';
import { CalendarClock, FileText, X } from 'lucide-react';
import { api } from '../../data/session.js';
import { nav } from '../../app/nav.js';
import { useWide } from '../../app/layout.js';
import { useOverlay, Sheet } from '../../ui/Overlay.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { EmptyState, SkeletonRows } from '../../ui/Feedback.jsx';
import { MeetingTabBar, MeetingTabContent, MeetingUnavailable, useMeetingLive } from '../meetings/MeetingPanel.jsx';
import { setCallView, useHuddle } from './huddle.js';

/** The call's meeting record id: from the huddle's socket payloads, else GET /by-huddle/:huddleId. */
export function useCallMeetingId() {
  const call = useHuddle((s) => s.call);
  const [failed, setFailed] = useState(false);
  const huddleId = call?.huddleId;
  const known = call?.meetingId || null;
  useEffect(() => {
    setFailed(false);
    if (!huddleId || known) return undefined;
    let alive = true;
    api()
      .meetingByHuddle?.(huddleId)
      .then((m) => {
        if (!alive) return;
        if (!m) return setFailed(true);
        useHuddle.setState((s) => (s.call?.huddleId === huddleId ? { call: { ...s.call, meetingId: m.id } } : {}));
        return undefined;
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [huddleId, known]);
  return { meetingId: known, failed };
}

function PanelBody({ meetingId, failed, tab, setTab, onClose }) {
  const { data: meeting, loading, error } = useMeetingLive(meetingId);
  if (!meetingId) {
    return failed ? (
      <EmptyState icon={CalendarClock} title="No meeting page for this call" body="Calls started before the update don't have one. The next call here will." className="py-8" />
    ) : (
      <SkeletonRows count={3} avatar={false} />
    );
  }
  if (!meeting) return <MeetingUnavailable error={error} loading={loading} />;
  return (
    <>
      <div className="flex items-center gap-2 px-4 pb-3">
        <MeetingTabBar meeting={meeting} tab={tab} onChange={setTab} className="min-w-0 flex-1" />
      </div>
      <div className="pb-6">
        <MeetingTabContent meeting={meeting} tab={tab} inCall />
      </div>
      <div className="flex justify-center pb-4">
        <Button
          size="sm"
          variant="ghost"
          icon={FileText}
          onClick={() => {
            // The page opens inside the app; the call keeps going in the floating bubble.
            onClose();
            setCallView('mini');
            nav.push('meeting', { id: meeting.id, tab });
          }}
        >
          Open meeting page
        </Button>
      </div>
    </>
  );
}

function SidePanel({ open, onClose, children }) {
  useOverlay(open, onClose);
  if (!open) return null;
  return (
    <aside
      aria-label="Meeting"
      data-testid="meeting-call-panel"
      className="glass-strong fixed right-3 bottom-3 z-[59] flex w-[420px] max-w-[45vw] flex-col overflow-hidden rounded-3xl border"
      style={{ top: 'calc(env(safe-area-inset-top) + 124px)', boxShadow: 'var(--glass-edge), var(--shadow-sheet)' }}
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <h2 className="flex-1 text-[17px] font-semibold">Meeting</h2>
        <IconButton icon={X} size="sm" label="Close the meeting panel" onClick={onClose} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </aside>
  );
}

export default function MeetingCallPanel({ open, onClose }) {
  const wide = useWide();
  const { meetingId, failed } = useCallMeetingId();
  const [tab, setTab] = useState('overview');
  const body = <PanelBody meetingId={meetingId} failed={failed} tab={tab} setTab={setTab} onClose={onClose} />;
  if (wide) {
    return (
      <SidePanel open={open} onClose={onClose}>
        {body}
      </SidePanel>
    );
  }
  return (
    <Sheet open={open} onClose={onClose} title="Meeting" full>
      {body}
    </Sheet>
  );
}
