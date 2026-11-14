// Taps on the home-screen widgets arrive as oruinwan://widget/<action>[/<id>] links (rows that open
// a conversation or task use the app's ordinary links, handled by features/home/openTarget.js).
//   tab/<name>     a tab or screen (chats, tasks, huddles…)
//   meeting/<id>   a meeting's page
//   new-message · new-task · new-note · start-huddle
import { create } from 'zustand';
import { nav, BAR_TABS } from '../../app/nav.js';
import { useSession } from '../../data/session.js';

/** A "create" request waiting for its screen to open (Tasks / Notes pick it up when they mount). */
export const useWidgetIntent = create(() => ({ intent: null }));
export function takeWidgetIntent(kind) {
  if (useWidgetIntent.getState().intent !== kind) return false;
  useWidgetIntent.setState({ intent: null });
  return true;
}

/** { action, id } for a widget link, else null. */
export function parseWidgetLink(url) {
  let u;
  try {
    u = new URL(String(url || ''));
  } catch {
    return null;
  }
  if (u.protocol !== 'oruinwan:' || u.host !== 'widget') return null;
  const [action, id] = u.pathname.replace(/^\/+/, '').split('/').map((p) => decodeURIComponent(p || ''));
  return action ? { action, id: id || null } : null;
}

let startHuddle = null;
/** The huddle starter (features/huddles/huddle.js), plugged in by the app to avoid an import cycle. */
export function setWidgetHuddleStarter(fn) {
  startHuddle = fn;
}

function run({ action, id }) {
  if (action === 'tab' && id) {
    if (BAR_TABS.includes(id)) nav.setTab(id);
    else nav.push(id);
  } else if (action === 'meeting' && id) nav.push('meeting', { id });
  else if (action === 'new-message') {
    nav.setTab('chats');
    nav.push('newMessage');
  } else if (action === 'new-task') {
    useWidgetIntent.setState({ intent: 'new-task' });
    nav.setTab('tasks');
  } else if (action === 'new-note') {
    useWidgetIntent.setState({ intent: 'new-note' });
    nav.setTab('notes');
  } else if (action === 'start-huddle') {
    nav.push('huddles');
    startHuddle?.();
  }
}

/** Handles a widget link (once signed in). Returns false when the link isn't one. */
let pendingOff = null;
export function openWidgetLink(url) {
  const link = parseWidgetLink(url);
  if (!link) return false;
  pendingOff?.();
  pendingOff = null;
  if (useSession.getState().status === 'signed-in') run(link);
  else {
    pendingOff = useSession.subscribe((s) => {
      if (s.status !== 'signed-in') return;
      pendingOff?.();
      pendingOff = null;
      run(link);
    });
  }
  return true;
}
