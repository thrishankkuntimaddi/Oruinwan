// What the Android home-screen widgets show (android/.../widgets/*): a small snapshot the app
// builds from data it already has and hands to the native side, which draws the widgets from it.
// Pure functions (tested in widgetSnapshot.test.js); WidgetSync.jsx keeps it up to date.
//
// The owner chose message previews in the Chats widget: the latest (already decrypted) preview
// text is part of the snapshot and stays in the app's private storage on the device.

import { isUnreadRow, previewText } from '../chats/chatList.js';
import { dueLabel, meetingTimeLabel } from './widgetTime.js';

export const SNAPSHOT_VERSION = 1;
const MAX_CHATS = 4;
const MAX_TASKS = 4;
const MAX_CONTACTS = 4;

/** oruinwan:// links the app already opens (features/home/openTarget.js), plus widget actions. */
export const widgetLinks = {
  conversation: (ws, kind, id) => `oruinwan://workspace/${encodeURIComponent(ws)}/${kind === 'channel' ? 'channel' : 'dm'}/${encodeURIComponent(id)}`,
  task: (ws, id) => `oruinwan://workspace/${encodeURIComponent(ws)}/tasks/${encodeURIComponent(id)}`,
  meeting: (id) => `oruinwan://widget/meeting/${encodeURIComponent(id)}`,
  tab: (tab) => `oruinwan://widget/tab/${tab}`,
  action: (name) => `oruinwan://widget/${name}`,
};

const chatTitle = (row) => (row.kind === 'channel' ? `#${String(row.item.name || 'channel').replace(/^#+/, '')}` : row.item.user?.name || row.item.name || 'Conversation');
const initialOf = (name) => (String(name || '?').replace(/^#/, '').trim()[0] || '?').toUpperCase();
const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const shortTime = (iso, now) => {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/**
 * The widget snapshot. Inputs are what the app's hooks return:
 *   rows      chat rows (features/chats/chatList.js allChats) — channels, DMs, groups
 *   tasks     useTasks() data; me — my user id; live — useHuddle live map + names
 *   meetings  upcoming meetings (first page); plain — Markdown → plain text for previews
 */
export function buildWidgetSnapshot({ workspace, me, rows = [], tasks = [], live = [], meetings = [], plain = (t) => t, now = Date.now() }) {
  const ws = workspace?.id;
  if (!ws) return { v: SNAPSHOT_VERSION, signedIn: false, updatedAt: now };

  // Chats: unread first (newest first), then the most recent, never archived.
  const visible = rows.filter((r) => !r.archivedAt);
  const byRecent = (a, b) => String(b.item.lastAt || '').localeCompare(String(a.item.lastAt || ''));
  const unreadRows = visible.filter(isUnreadRow).sort(byRecent);
  const recent = visible.filter((r) => !isUnreadRow(r)).sort(byRecent);
  const chats = [...unreadRows, ...recent].slice(0, MAX_CHATS).map((r) => ({
    title: clip(chatTitle(r), 40),
    preview: clip(previewText(r, me, plain), 90),
    unread: r.item.muted ? 0 : r.item.unread || 0,
    time: shortTime(r.item.lastAt, now),
    initial: initialOf(chatTitle(r)),
    link: widgetLinks.conversation(ws, r.kind, r.item.id),
  }));
  const unreadTotal = unreadRows.reduce((n, r) => n + (r.item.unread || 0), 0);

  // Tasks: mine and open, overdue first, then by due date; undated ones last.
  const open = (tasks || []).filter((t) => (t.assigneeIds || []).includes(me) && !['done', 'cancelled'].includes(t.status));
  const dueAt = (t) => (t.due ? new Date(t.due).getTime() : Infinity);
  const mine = [...open].sort((a, b) => dueAt(a) - dueAt(b));
  const taskRows = mine.slice(0, MAX_TASKS).map((t) => {
    const due = dueLabel(t.due, now);
    return { title: clip(t.title || 'Untitled task', 60), due: due?.text || '', tone: due?.tone || 'none', link: widgetLinks.task(ws, t.id) };
  });
  const overdue = open.filter((t) => dueLabel(t.due, now)?.tone === 'overdue').length;
  const today = open.filter((t) => dueLabel(t.due, now)?.tone === 'today').length;

  // Huddles: what's live now (tap opens its conversation) and the next meeting.
  const liveRows = (live || []).slice(0, 3).map((h) => ({
    title: clip(h.title || 'Huddle', 40),
    people: h.count || 0,
    link: h.kind && h.id ? widgetLinks.conversation(ws, h.kind, h.id) : widgetLinks.tab('huddles'),
  }));
  const next = (meetings || []).filter((m) => m.start && new Date(m.start).getTime() + (m.duration || 30) * 60000 > now)
    .sort((a, b) => new Date(a.start) - new Date(b.start))[0];

  // Contacts: pinned chats first, then the people I talk to most recently (1:1 DMs).
  const pinned = visible.filter((r) => r.pinnedAt).sort((a, b) => String(a.pinnedAt).localeCompare(String(b.pinnedAt)));
  const people = visible.filter((r) => r.kind === 'dm' && !r.item.isGroup && !r.item.agentId && !r.pinnedAt).sort(byRecent);
  const contacts = [...pinned, ...people].slice(0, MAX_CONTACTS).map((r) => ({
    title: clip(chatTitle(r).replace(/^#/, ''), 14),
    initial: initialOf(chatTitle(r)),
    unread: isUnreadRow(r) ? r.item.unread || 0 : 0,
    link: widgetLinks.conversation(ws, r.kind, r.item.id),
  }));

  return {
    v: SNAPSHOT_VERSION,
    signedIn: true,
    updatedAt: now,
    workspace: clip(workspace.name || 'Workspace', 30),
    chats: { unread: unreadTotal, items: chats, open: widgetLinks.tab('chats') },
    tasks: { overdue, today, open: open.length, items: taskRows, all: widgetLinks.tab('tasks'), create: widgetLinks.action('new-task') },
    huddles: {
      live: liveRows,
      next: next ? { title: clip(next.title || 'Meeting', 40), when: meetingTimeLabel(next.start, next.duration, now), link: widgetLinks.meeting(next.id) } : null,
      all: widgetLinks.tab('huddles'),
      start: widgetLinks.action('start-huddle'),
    },
    quick: {
      contacts,
      actions: [
        { label: 'Message', link: widgetLinks.action('new-message') },
        { label: 'Task', link: widgetLinks.action('new-task') },
        { label: 'Note', link: widgetLinks.action('new-note') },
        { label: 'Huddle', link: widgetLinks.action('start-huddle') },
      ],
    },
  };
}

/** What the widgets show after sign-out: no data, a prompt to open the app. */
export const signedOutSnapshot = (now = Date.now()) => ({ v: SNAPSHOT_VERSION, signedIn: false, updatedAt: now });
