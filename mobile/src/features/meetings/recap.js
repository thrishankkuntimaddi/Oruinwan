// "Meeting ended · View recap": when a call I was part of ends, the server sends `meeting:ended`
// to my user room (docs/api/meetings-unified.md). People stay where they are; a banner offers the
// recap (the meeting page on Summary & actions).
import { create } from 'zustand';
import { on } from '../../lib/bus.js';
import { invalidate } from '../../data/query.js';

const MAX = 3;
const SHOW_MS = 20_000;

/** recaps: [{ meetingId, title, kind, endedAt, durationSec }] — newest last. */
export const useRecap = create(() => ({ recaps: [] }));

const timers = new Map();

export function dismissRecap(meetingId) {
  clearTimeout(timers.get(meetingId));
  timers.delete(meetingId);
  useRecap.setState((s) => ({ recaps: s.recaps.filter((r) => r.meetingId !== meetingId) }));
}

/** Adds (or refreshes) the banner for one ended meeting. */
export function showRecap(payload, { autoHideMs = SHOW_MS } = {}) {
  const meetingId = payload?.meetingId ? String(payload.meetingId) : null;
  if (!meetingId) return;
  const entry = {
    meetingId,
    title: payload.title || (payload.kind === 'huddle' ? 'Huddle' : 'Meeting'),
    kind: payload.kind || 'scheduled',
    endedAt: payload.endedAt || null,
    durationSec: payload.durationSec ?? null,
  };
  useRecap.setState((s) => ({ recaps: [...s.recaps.filter((r) => r.meetingId !== meetingId), entry].slice(-MAX) }));
  clearTimeout(timers.get(meetingId));
  if (autoHideMs) timers.set(meetingId, setTimeout(() => dismissRecap(meetingId), autoHideMs));
}

let bound = false;
/** Listen for `meeting:ended` (once, app-wide). Returns a cleanup. */
export function bindRecap() {
  if (bound) return () => {};
  bound = true;
  const off = on('meeting', ({ event, payload }) => {
    if (event !== 'meeting:ended') return;
    // The lists and the page show it as ended now.
    invalidate('meetingpage:', 'meeting:', 'meetings:');
    showRecap(payload);
  });
  return () => {
    bound = false;
    off();
  };
}

/** For tests. */
export function __resetRecap() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  useRecap.setState({ recaps: [] });
}
