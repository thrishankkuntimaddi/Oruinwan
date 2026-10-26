/**
 * "Make a task" from a note or a file: the pre-filled draft, the endpoints and how a
 * linked task opens. The server links both ways (task.linkedNote / task.linkedFile and
 * the source's linkedTaskId) and answers 409 { taskId } when a task already exists.
 */

export const NOTE_EXCERPT = 500;

/** Title and description for a task made from a note (plain text of its content). */
export function noteTaskDraft(title, plainText) {
    const name = String(title || '').trim() || 'Untitled';
    const text = String(plainText || '').replace(/\s+/g, ' ').trim();
    const excerpt = text.length > NOTE_EXCERPT ? `${text.slice(0, NOTE_EXCERPT).trimEnd()}…` : text;
    return {
        title: name.slice(0, 200),
        description: [excerpt, `From note: ${name}`].filter(Boolean).join('\n\n'),
    };
}

/** "budget-2026.xlsx" -> "budget-2026"; names without an extension stay as they are. */
export function fileTaskTitle(name) {
    const n = String(name || '').trim();
    const stripped = n.replace(/\.[^./\\]{1,8}$/, '');
    return (stripped || n || 'File').slice(0, 200);
}

/** Title and description for a task made from a file. */
export function fileTaskDraft(name) {
    return { title: fileTaskTitle(name), description: `From file: ${String(name || 'File').trim()}` };
}

/** POST endpoint that makes the task. */
export function sourceTaskEndpoint(kind, id) {
    if (kind === 'note') return `/api/v2/notes/${id}/task`;
    // A file sent in a chat becomes a task through its message.
    if (kind === 'message') return `/api/v2/messages/${id}/convert-task`;
    return `/api/v2/files/${id}/task`;
}

export function taskPath(workspaceId, taskId) {
    return `/workspace/${workspaceId}/tasks/${taskId}`;
}

/** Open a task from anywhere in the web app (the router listens to popstate). */
export function openTaskInApp(workspaceId, taskId) {
    if (!workspaceId || !taskId) return;
    window.history.pushState({}, '', taskPath(workspaceId, taskId));
    window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Menu entry for a note / file: "Open task" when it already is one, else "Make a task". */
export function sourceTaskMenuLabel(linkedTaskId) {
    return linkedTaskId ? 'Open task' : 'Make a task';
}
