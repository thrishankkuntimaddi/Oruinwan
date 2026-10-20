// The first-run tour on the phone: its steps, when it opens by itself, where the card goes, and a
// tiny store so Settings › Support › "Take the tour again" can reopen it. UI: PhoneTour.jsx.
//
// Shown once per account: preferences.tour.done is saved on the server (PUT /auth/me), the same
// flag the web, desktop and tablet apps use, so finishing or skipping anywhere hides it everywhere.
import { create } from 'zustand';

/** Each step points at an element marked data-tour="<target>"; none on screen = centred card. */
export const TOUR_STEPS = [
  { target: 'workspace', title: 'Your workspace', body: 'Tap here to switch workspaces or create a new one.' },
  { target: 'chats', title: 'Chats', body: 'Channels and direct messages, all in one list.' },
  { target: 'search', title: 'Search', body: 'Find messages, files and people in this workspace.' },
  { target: 'ai', title: 'AI & agents', body: 'Ask Oruinwan AI about your work, or chat with Claude and other agents.' },
  { target: 'tasks', title: 'Tasks', body: 'What’s assigned to you and what’s due, in one place.' },
  { target: 'profile', title: 'You’re all set', body: 'Your profile and settings are here. Take this tour again any time from Settings.' },
];

/**
 * Whether the tour opens by itself: the signed-in account hasn't seen it (tourDone is false, as
 * read from the server; unknown, e.g. offline, counts as seen so it never repeats by mistake),
 * a workspace is open, nothing is in front of it, and it wasn't closed in this session already.
 */
export function shouldAutoStart({ user, workspaceId, blocked = false, closedThisSession = false }) {
  if (!user || !workspaceId || blocked || closedThisSession) return false;
  return user.tourDone === false;
}

/** Next index for 'next' | 'back'; null when moving past the last step (= finished). */
export function moveStep(index, count, dir) {
  if (dir === 'back') return Math.max(0, index - 1);
  return index + 1 >= count ? null : index + 1;
}

/**
 * Where the card goes: above an element in the lower half of the screen (the tab bar), below one
 * in the upper half (the header), full width minus margins, clamped to the screen. No rect = centred.
 */
export function placeCard(rect, card, viewport, gap = 14, margin = 16) {
  const width = Math.min(card.width, viewport.width - margin * 2);
  const left = Math.max(margin, (viewport.width - width) / 2);
  const clampY = (y) => Math.max(margin, Math.min(y, viewport.height - card.height - margin));
  if (!rect) return { placement: 'center', top: clampY((viewport.height - card.height) / 2), left, width };
  const below = rect.top + rect.height / 2 < viewport.height / 2;
  return below
    ? { placement: 'bottom', top: clampY(rect.top + rect.height + gap), left, width }
    : { placement: 'top', top: clampY(rect.top - gap - card.height), left, width };
}

export const useTour = create((set) => ({
  open: false,
  closedThisSession: false,
  start: () => set({ open: true }),
  close: () => set({ open: false, closedThisSession: true }),
}));

/** Settings › Support › "Take the tour again". */
export const startTour = () => useTour.getState().start();
