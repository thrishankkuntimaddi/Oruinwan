// Personal reminders ("Call the bank at 4"): kept on this phone per workspace, with a local
// notification at the time (in the apps), and shown on the calendar with the other reminders.
import { create } from 'zustand';
import { LocalNotifications } from '@capacitor/local-notifications';
import { prefs } from '../../native/storage.js';
import { isNative } from '../../native/index.js';

const keyOf = (ws) => `reminders.personal:${ws}`;
export const usePersonalReminders = create(() => ({ byWs: {} }));

function load(ws) {
  try {
    const v = prefs.get(keyOf(ws));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function personalReminders(ws) {
  const cached = usePersonalReminders.getState().byWs[ws];
  if (cached) return cached;
  const list = load(ws);
  usePersonalReminders.setState((s) => ({ byWs: { ...s.byWs, [ws]: list } }));
  return list;
}

function save(ws, list) {
  usePersonalReminders.setState((s) => ({ byWs: { ...s.byWs, [ws]: list } }));
  try {
    prefs.set(keyOf(ws), list);
  } catch {
    /* storage not ready */
  }
}

// Local notification ids are 32-bit integers.
const notifId = (id) => {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 1_900_000_000) + 1;
};

/** Adds a reminder { title, at } and schedules its notification. Returns it. */
export async function addPersonalReminder(ws, { title, at }) {
  const r = { id: `p${Date.now().toString(36)}`, title: String(title || '').trim() || 'Reminder', at: new Date(at).toISOString(), personal: true };
  save(ws, [...personalReminders(ws), r].sort((a, b) => new Date(a.at) - new Date(b.at)));
  if (isNative && new Date(r.at) > new Date()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') await LocalNotifications.requestPermissions();
      await LocalNotifications.schedule({ notifications: [{ id: notifId(r.id), title: 'Reminder', body: r.title, schedule: { at: new Date(r.at), allowWhileIdle: true } }] });
    } catch {
      /* shown on the calendar either way */
    }
  }
  return r;
}

export async function removePersonalReminder(ws, id) {
  save(ws, personalReminders(ws).filter((r) => r.id !== id));
  if (isNative) await LocalNotifications.cancel({ notifications: [{ id: notifId(id) }] }).catch(() => {});
}

/** True when something is on the calendar in the next `hours` (for the dot on the calendar icon). */
export function hasUpcoming(events, hours = 24, now = Date.now()) {
  return (events || []).some((e) => {
    const t = new Date(e.at).getTime();
    return t >= now && t - now <= hours * 3_600_000;
  });
}
