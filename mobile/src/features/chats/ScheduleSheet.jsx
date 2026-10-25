// "Send later": pick when a message goes out. Quick choices, or any date and time.
import { useEffect, useState } from 'react';
import { CalendarClock, Clock3, Moon, Sun, Sunrise } from 'lucide-react';
import { Sheet } from '../../ui/Overlay.jsx';
import { Button } from '../../ui/Button.jsx';
import { Field } from '../../ui/Controls.jsx';
import { Icon } from '../../ui/Icon.jsx';

const at = (base, days, h, m = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Quick choices for now: in an hour, this evening (if still ahead), tomorrow morning, next Monday. */
export function scheduleChoices(now = new Date()) {
  const n = new Date(now);
  const list = [{ id: 'hour', label: 'In 1 hour', icon: Clock3, when: new Date(n.getTime() + 3600_000) }];
  const evening = at(n, 0, 20);
  if (evening.getTime() - n.getTime() > 30 * 60_000) list.push({ id: 'evening', label: 'This evening', icon: Moon, when: evening });
  list.push({ id: 'tomorrow', label: 'Tomorrow morning', icon: Sunrise, when: at(n, 1, 9) });
  const toMonday = ((8 - n.getDay()) % 7) || 7;
  list.push({ id: 'monday', label: 'Next Monday', icon: Sun, when: at(n, toMonday, 9) });
  return list;
}

const fmt = (d) => d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const localInput = (d) => {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ScheduleSheet({ open, onClose, onPick, preview }) {
  const [custom, setCustom] = useState('');
  useEffect(() => {
    if (open) setCustom(localInput(new Date(Date.now() + 2 * 3600_000)));
  }, [open]);
  const choices = scheduleChoices();
  const customDate = custom ? new Date(custom) : null;
  const customOk = customDate && customDate.getTime() > Date.now() + 60_000;
  return (
    <Sheet open={open} onClose={onClose} title="Send later">
      {preview && <p className="mx-5 mb-2 line-clamp-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-text-2">{preview}</p>}
      <div className="px-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.when)}
            className="flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left active:bg-surface-2"
          >
            <Icon as={c.icon} className="text-text-2" />
            <span className="flex-1 text-[15px]">{c.label}</span>
            <span className="text-[13px] text-text-2">{fmt(c.when)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-3 px-5 pt-2 pb-4">
        <Field label="Pick a date and time" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} icon={CalendarClock} />
        <Button block variant="secondary" disabled={!customOk} onClick={() => customOk && onPick(customDate)}>
          {customOk ? `Send ${fmt(customDate)}` : 'Pick a time in the future'}
        </Button>
        <p className="text-[12px] text-text-3">It stays encrypted. Find it under Drafts & scheduled in the side panel, where you can change or cancel it.</p>
      </div>
    </Sheet>
  );
}
