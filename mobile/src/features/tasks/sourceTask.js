// "Make a task" from a note or a file (phone). The server links both ways and answers with the
// existing task when one is already there; see server/src/features/tasks/tasks.linked.js.
import { htmlToText } from '../../ui/sanitize.js';

export const NOTE_EXCERPT = 500;

/** Pre-fill for a task made from a note: its title, the start of its text, then "From note". */
export function noteTaskInitial(note, html) {
  const title = String(note?.title || '').trim() || 'Untitled';
  const text = htmlToText(html ?? note?.content ?? '', NOTE_EXCERPT * 2).replace(/\s+/g, ' ').trim();
  const excerpt = text.length > NOTE_EXCERPT ? `${text.slice(0, NOTE_EXCERPT).trimEnd()}…` : text;
  return {
    title: title.slice(0, 200),
    description: [excerpt, `From note: ${title}`].filter(Boolean).join('\n\n'),
  };
}

/** "budget-2026.xlsx" -> "budget-2026". */
export function fileTaskTitle(name) {
  const n = String(name || '').trim();
  return (n.replace(/\.[^./\\]{1,8}$/, '') || n || 'File').slice(0, 200);
}

export function fileTaskInitial(file) {
  return { title: fileTaskTitle(file?.name), description: `From file: ${String(file?.name || 'File').trim()}` };
}

/** Menu entry for a note or file. */
export function sourceTaskAction(linkedTaskId) {
  return linkedTaskId ? 'Open task' : 'Make a task';
}
