// What the person is looking at, for Oruinwan AI's quick window: a short label ("#general",
// "Task: Ship v2"), a few lines of context (the latest messages here, the task's details, the
// note's text — decrypted on this phone, never stored), and suggestions that fit.
import { useNav } from './nav.js';
import { useSession } from '../data/session.js';
import { getQueryData } from '../data/query.js';
import { htmlToText } from '../ui/sanitize.js';

const clip = (t, n) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

const TAB_LABEL = { home: 'Home', chats: 'Chats', tasks: 'Tasks', notes: 'Notes', activity: 'Activity', files: 'Files', knowledge: 'Knowledge', huddles: 'Huddles' };

const TAB_SUGGESTIONS = {
  home: ['What did I miss today?', 'What’s due for me?', 'Draft a status update'],
  chats: ['Which chats need a reply from me?', 'What did I miss today?', 'Draft a status update'],
  tasks: ['What’s due for me this week?', 'Which of my tasks are overdue?', 'Plan my day'],
  notes: ['Which notes changed recently?', 'Start a meeting notes outline', 'What’s due for me?'],
  activity: ['Summarise my notifications', 'What needs my attention first?', 'What’s coming up today?'],
};

/** { label, text, suggestions } for the current screen, or null for a plain tab. */
export function currentAiContext(state = useNav.getState(), ws = useSession.getState().workspaceId, me = useSession.getState().user?.id) {
  const tab = state.tab;
  const stack = state.stacks?.[tab] || [];
  const top = stack[stack.length - 1];
  const base = { label: TAB_LABEL[tab] || null, text: '', suggestions: TAB_SUGGESTIONS[tab] || TAB_SUGGESTIONS.home };
  if (!top) return { ...base, text: tab ? `I'm on the ${TAB_LABEL[tab] || tab} tab.` : '' };
  const p = top.params || {};
  const people = Object.fromEntries((getQueryData(`members:${ws}`) || []).map((u) => [u.id, u.name]));

  if (top.name === 'conversation' || top.name === 'thread') {
    const id = top.name === 'thread' ? p.convId : p.id;
    const kind = p.kind;
    const list = getQueryData(kind === 'channel' ? `channels:${ws}` : `dms:${ws}`) || [];
    const row = list.find((c) => c.id === id);
    const name = kind === 'channel' ? `#${row?.name || 'channel'}` : row?.user?.name || row?.name || 'a direct message';
    const cached = getQueryData(top.name === 'thread' ? `thread:${p.messageId}` : `messages:${id}`);
    const items = [...(cached?.parent ? [cached.parent] : []), ...(cached?.items || [])].filter((m) => m.state === 'ok' && m.text).slice(-15);
    const lines = items.map((m) => `${m.authorId === me ? 'Me' : people[m.authorId] || m.author?.name || 'Someone'}: ${clip(m.text, 220)}`);
    return {
      label: top.name === 'thread' ? `Thread in ${name}` : name,
      text: `I'm looking at ${top.name === 'thread' ? `a thread in ${name}` : name}.${lines.length ? ` The latest messages:\n${lines.join('\n')}` : ''}`,
      suggestions: ['Summarise this chat', 'What do they need from me?', 'Draft a reply'],
    };
  }
  if (top.name === 'task') {
    const t = getQueryData(`task:${p.id}`) || (getQueryData(`tasks:${ws}`) || []).find((x) => x.id === p.id);
    if (!t) return { ...base, label: 'A task' };
    const who = (t.assigneeIds || []).map((x) => people[x]).filter(Boolean).join(', ');
    return {
      label: `Task: ${clip(t.title, 40)}`,
      text: `I'm looking at the task "${t.title}" (status ${t.status || 'todo'}${t.due ? `, due ${new Date(t.due).toDateString()}` : ''}${who ? `, assigned to ${who}` : ''}). ${clip(t.description, 800)}`,
      suggestions: ['Break this task into steps', 'Write a status update for it', 'What could block this?'],
    };
  }
  if (top.name === 'note' || top.name === 'page') {
    const n = getQueryData(`${top.name}:${p.id}`) || (getQueryData(top.name === 'note' ? `notes:${ws}` : `knowledge:${ws}`) || []).find((x) => x.id === p.id);
    if (!n) return { ...base, label: top.name === 'note' ? 'A note' : 'A page' };
    return {
      label: `${top.name === 'note' ? 'Note' : 'Page'}: ${clip(n.title || 'Untitled', 40)}`,
      text: `I'm reading the ${top.name === 'note' ? 'note' : 'knowledge page'} "${n.title || 'Untitled'}":\n${clip(htmlToText(n.content || '', 3000), 2500)}`,
      suggestions: ['Summarise this', 'Pull out the action items', 'What’s missing here?'],
    };
  }
  if (top.name === 'meeting') return { ...base, label: 'A meeting', text: "I'm looking at a meeting's page.", suggestions: ['Summarise this meeting', 'What were the action items?', 'Draft a follow-up'] };
  return base;
}
