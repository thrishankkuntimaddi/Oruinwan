// Meetings: scheduling with "Find a time", and a meeting's page (the same for scheduled
// meetings and quick huddles, before, during and after the call: MeetingPanel.jsx). The list of
// meetings is the Huddles screen (features/huddles/HuddlesScreen.jsx).
import { useState } from 'react';
import { ClipboardList, Trash2, Users, Wand2 } from 'lucide-react';
import { nav } from '../../app/nav.js';
import { api, useSession } from '../../data/session.js';
import { useDirectory } from '../../data/hooks.js';
import { invalidate } from '../../data/query.js';
import { toast } from '../../lib/bus.js';
import { Body, Header, Screen } from '../../ui/Screen.jsx';
import { Button, IconButton } from '../../ui/Button.jsx';
import { Field, Segmented } from '../../ui/Controls.jsx';
import { Dialog, Sheet } from '../../ui/Overlay.jsx';
import { Icon } from '../../ui/Icon.jsx';
import { cx } from '../../ui/cx.js';
import { PeoplePicker, toDateInput } from '../tasks/TaskEditorSheet.jsx';
import { combineDateTime, meetingTab, meetingWhen, STATUS_LABEL } from './meetingsUi.js';
import { MeetingTabBar, MeetingTabContent, MeetingUnavailable, meetingKey, useMeetingLive } from './MeetingPanel.jsx';

// ---------------------------------------------------------------- schedule

const DURATIONS = [15, 30, 45, 60, 90].map((m) => ({ value: m, label: m < 60 ? `${m} min` : `${m / 60} h`.replace('1.5 h', '1½ h') }));

export function ScheduleMeetingSheet({ open, onClose, channelId }) {
  const ws = useSession((s) => s.workspaceId);
  const me = useSession((s) => s.user?.id);
  const directory = useDirectory();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => toDateInput(new Date().toISOString()));
  const [time, setTime] = useState(() => {
    const d = new Date(Date.now() + 3_600_000);
    return `${String(d.getHours()).padStart(2, '0')}:00`;
  });
  const [duration, setDuration] = useState(30);
  const [people, setPeople] = useState([]);
  const [picking, setPicking] = useState(false);
  const [link, setLink] = useState('');
  const [slots, setSlots] = useState(null);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);

  const findTime = async () => {
    setFinding(true);
    try {
      const found = await api().suggestTimes({ participantIds: [me, ...people].filter(Boolean), minutes: duration });
      setSlots(found);
      if (!found.length) toast('No free time found. Pick one yourself.', 'warning');
    } catch (err) {
      toast(err.message || "Couldn't find a time", 'danger');
    } finally {
      setFinding(false);
    }
  };
  const pickSlot = (slot) => {
    const d = new Date(slot.start);
    setDate(toDateInput(slot.start));
    setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  };

  const save = async () => {
    const start = combineDateTime(date, time);
    if (!start) return toast('Pick a date and time', 'warning');
    setBusy(true);
    try {
      const m = await api().scheduleMeeting(ws, { title: title.trim(), start, duration, participantIds: people, link: link.trim(), channelId });
      invalidate('meetings', 'meetinglist', 'meetingpage:');
      toast('Meeting scheduled', 'success');
      onClose();
      nav.push('meeting', { id: m.id });
    } catch (err) {
      toast(err.message || "Couldn't schedule the meeting", 'danger');
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Sheet open={open} onClose={onClose} title="Schedule a meeting" full footer={<Button block loading={busy} disabled={!title.trim()} onClick={save}>Schedule</Button>}>
      <div className="space-y-4 px-5 pb-4">
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly sync" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Field label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-text-2">Length</p>
          <Segmented size="sm" options={DURATIONS} value={duration} onChange={setDuration} />
        </div>
        <button type="button" onClick={() => setPicking(true)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-input px-3.5 py-3 text-left">
          <Icon as={Users} size="sm" className="text-text-3" />
          <span className="min-w-0 flex-1 truncate text-[15px]">
            {people.length ? people.map((id) => directory[id]?.name || 'Someone').join(', ') : 'Invite people'}
          </span>
        </button>
        <div className="rounded-card border border-line-soft bg-surface p-3">
          <div className="flex items-center gap-3">
            <Icon as={Wand2} size="sm" className="text-accent-ink" />
            <p className="min-w-0 flex-1 text-[14px]">Find a time that works</p>
            <Button size="sm" variant="secondary" loading={finding} onClick={findTime}>
              Find a time
            </Button>
          </div>
          {slots?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {slots.map((s) => {
                const active = combineDateTime(date, time) === new Date(s.start).toISOString();
                return (
                  <button key={s.start} type="button" onClick={() => pickSlot(s)} className={cx('pressable rounded-full border px-3 py-1.5 text-[13px]', active ? 'border-accent bg-accent/15 text-accent-ink' : 'border-line bg-surface-2')}>
                    {meetingWhen(s.start)}
                  </button>
                );
              })}
            </div>
          )}
          {slots?.[0]?.note && <p className="mt-2 text-xs text-text-3">{slots[0].note}</p>}
        </div>
        <Field label="Call link (optional)" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
      </div>
      <PeoplePicker open={picking} onClose={() => setPicking(false)} value={people} onChange={setPeople} title="Invite" />
    </Sheet>
  );
}

// ---------------------------------------------------------------- the meeting page

export function MeetingScreen({ id, tab: initialTab }) {
  const { data: meeting, loading, error, refetch } = useMeetingLive(id);
  const me = useSession((s) => s.user?.id);
  const [tab, setTab] = useState(() => meetingTab(initialTab));
  const [cancel, setCancel] = useState(false);

  if (!meeting) {
    return (
      <Screen>
        <Header title="Meeting" />
        <MeetingUnavailable error={error} loading={loading} />
      </Screen>
    );
  }

  const canCancel = meeting.kind === 'scheduled' && meeting.organizer?.id === me && meeting.status === 'scheduled';
  const subtitle = [meeting.kind === 'huddle' ? 'Huddle' : null, STATUS_LABEL[meeting.status]].filter(Boolean).join(' · ');

  return (
    <Screen>
      <Header title={meeting.title} subtitle={subtitle} actions={canCancel ? <IconButton icon={Trash2} label="Cancel meeting" onClick={() => setCancel(true)} /> : null} />
      <div className="shrink-0 px-4 pt-1 pb-3">
        <MeetingTabBar meeting={meeting} tab={tab} onChange={setTab} />
      </div>
      {/* No pull-to-refresh on the whiteboard: a downward stroke would refresh the page. */}
      <Body onRefresh={tab === 'whiteboard' || tab === 'notes' ? undefined : refetch}>
        <div className="pt-1">
          <MeetingTabContent meeting={meeting} tab={tab} />
        </div>
      </Body>
      <Dialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Cancel this meeting?"
        body="Everyone invited sees it as cancelled."
        confirmLabel="Cancel meeting"
        danger
        onConfirm={async () => {
          setCancel(false);
          try {
            await api().cancelMeeting(id);
            invalidate(meetingKey(id), 'meetinglist', 'meetings', 'meetingpage:');
            toast('Meeting cancelled');
          } catch (err) {
            toast(err.message || "Couldn't cancel the meeting", 'danger');
          }
        }}
      />
    </Screen>
  );
}

export const MEETINGS_ICON = ClipboardList;
