// Simulated Oruinwan AI for the demo workspace. It reads the demo data so its answers
// match what the user sees, and it streams word by word like the real assistant.
import { dueLabel } from '../../lib/time.js';
import { STATUS_META } from '../constants.js';

function words(text) {
  return text.match(/\S+\s*/g) || [];
}

async function stream(text, onToken, signal) {
  let out = '';
  for (const w of words(text)) {
    if (signal?.aborted) break;
    out += w;
    onToken?.(out);
    await new Promise((r) => setTimeout(r, 18 + Math.random() * 30));
  }
  return out;
}

function myOpenTasks(db, ws) {
  return db.tasks
    .filter((t) => t.ws === ws && !t.trashed && t.assignees?.includes('me') && !['done', 'cancelled'].includes(t.status))
    .sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
}

export async function answerDemoQuestion({ ws, history, db, user, demo, onToken, signal }) {
  const question = history[history.length - 1]?.content || '';
  const q = question.toLowerCase();
  const sources = [];
  const actions = [];
  let text;

  if (/plate|my tasks|to do|todo|due|focus|week/.test(q)) {
    const tasks = myOpenTasks(db, ws);
    if (!tasks.length) {
      text = 'Your list is clear in this workspace. Nothing open is assigned to you.';
    } else {
      const lines = tasks.slice(0, 5).map((t) => {
        const due = dueLabel(t.due);
        return `- **${t.title}** — ${STATUS_META[t.status].label.toLowerCase()}${due ? `, due ${due.text.toLowerCase()}` : ''}`;
      });
      const overdue = tasks.filter((t) => dueLabel(t.due)?.tone === 'overdue').length;
      text = `You have **${tasks.length} open tasks** here.${overdue ? ` ${overdue} ${overdue === 1 ? 'is' : 'are'} overdue.` : ''}\n\n${lines.join('\n')}\n\nI'd start with the first one; it is the most urgent.`;
      tasks.slice(0, 3).forEach((t) => sources.push({ kind: 'task', id: t.id, label: t.title }));
    }
  } else if (/summar|catch me up|unread|what did i miss|happening/.test(q)) {
    const channels = db.channels.filter((c) => c.ws === ws && c.isMember && (c.unread || 0) > 0 && !c.muted);
    if (!channels.length) {
      text = "You're all caught up. No unread channels in this workspace.";
    } else {
      const parts = channels.map((c) => {
        const msgs = db.messages.filter((m) => m.conv === c.id).slice(-2);
        const gist = msgs.map((m) => `${user(m.author).name.split(' ')[0]}: ${m.text.replace(/```[\s\S]*?```/g, '[code]').slice(0, 90)}`).join(' · ');
        sources.push({ kind: 'channel', id: c.id, label: `#${c.name}` });
        return `- **#${c.name}** (${c.unread} new) — ${gist}`;
      });
      text = `Here's what's new:\n\n${parts.join('\n')}\n\nThe one that needs you: Aisha asked you to sign off the release checklist in #engineering.`;
    }
  } else if (/create|add|new/.test(q) && /task/.test(q)) {
    const title = question.replace(/^(please\s+)?(create|add|make)( a| new)? task( to| for| called)?:?\s*/i, '').trim() || 'Follow up from AI chat';
    const task = await demo.createTask(ws, { title: title.charAt(0).toUpperCase() + title.slice(1), priority: 'medium' });
    actions.push({ ok: true, label: `Created task "${task.title}"` });
    sources.push({ kind: 'task', id: task.id, label: task.title });
    text = `Done. I created **${task.title}** and assigned it to you. You can change the due date or priority from Tasks.`;
  } else if (/draft|write|reply|message/.test(q)) {
    text =
      "Here's a draft you can paste:\n\n> Hi team — Android 1.0 is ready for internal testing. Install it from the releases page, try the update flow, and post anything odd in #mobile-launch. Thanks for all the care on this one!\n\nWant it shorter or more formal?";
  } else if (/note|meeting/.test(q)) {
    const notes = db.notes.filter((n) => n.ws === ws && !n.archived).slice(0, 3);
    notes.forEach((n) => sources.push({ kind: 'note', id: n.id, label: n.title }));
    text = `Your most recent notes are ${notes.map((n) => `**${n.title}**`).join(', ')}. The release checklist still has 4 unticked items.`;
  } else if (/hello|hi\b|hey/.test(q)) {
    text = "Hi! I can summarise channels, list what's on your plate, draft messages and create tasks. What would you like to do?";
  } else {
    text =
      "I'm the demo version of Oruinwan AI, so my answers here are simulated from the sample workspace. Try:\n\n- *What's on my plate this week?*\n- *Catch me up on unread channels*\n- *Create a task to review the onboarding copy*\n- *Draft a message announcing the release*\n\nConnected to your own server, Oruinwan AI uses your workspace's model and tools.";
  }

  const final = await stream(text, onToken, signal);
  return { text: final, sources, actions, provider: 'demo' };
}
