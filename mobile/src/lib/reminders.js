// "Remind me about this": quick choices and a custom date and time, in the phone's local time.

const at = (base, h, m = 0) => {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

/** The quick choices for now: [{ id, label, at: Date }]. "This evening" is offered until 5 pm. */
export function reminderPresets(now = new Date()) {
  const list = [
    { id: '20m', label: 'In 20 minutes', at: new Date(now.getTime() + 20 * 60_000) },
    { id: '1h', label: 'In 1 hour', at: new Date(now.getTime() + 60 * 60_000) },
    { id: '3h', label: 'In 3 hours', at: new Date(now.getTime() + 3 * 60 * 60_000) },
  ];
  if (now.getHours() < 17) list.push({ id: 'evening', label: 'This evening', at: at(now, 18) });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  list.push({ id: 'tomorrow', label: 'Tomorrow morning', at: at(tomorrow, 9) });
  const monday = new Date(now);
  // Next Monday (a week from today when today is Monday).
  monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  list.push({ id: 'monday', label: 'Next Monday', at: at(monday, 9) });
  return list;
}

/** A custom choice from a date input ("2026-01-31") and a time input ("14:30"); null when invalid or past. */
export function customReminder(date, time, now = new Date()) {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time || '09:00');
  if (!dm || !tm) return null;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]), 0, 0);
  if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(dm[2]) - 1 || d <= now) return null;
  return d;
}

/** "Today 18:00", "Tomorrow 09:00", "Mon, 12 Jan 09:00". */
export function reminderLabel(value, now = new Date()) {
  const d = new Date(value);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86_400_000);
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}
