/**
 * Pure helpers for the huddle workspace: note text conversion and the wrap-up
 * message. Kept free of React so they are unit-tested.
 */

/** Stored note HTML (escaped text + <br>) -> plain text for the huddle editor. */
export function htmlToPlain(html) {
    if (!html) return '';
    return String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h\d)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\n+$/, '');
}

/** Notes content (JSON blocks) -> { paragraphs, actions } for the huddle panel. */
export function readNoteBlocks(content) {
    let blocks = [];
    try {
        const parsed = JSON.parse(content || '[]');
        if (Array.isArray(parsed)) blocks = parsed.filter((b) => b && typeof b === 'object');
    } catch {
        blocks = content ? [{ id: 'legacy', type: 'text', content: String(content), meta: {} }] : [];
    }
    const paragraphs = [];
    let actions = [];
    for (const b of blocks) {
        if (b.type === 'text') paragraphs.push({ id: String(b.id), text: htmlToPlain(b.content), author: b.meta?.author || null });
        else if (b.type === 'checklist' && b.meta?.huddleActions) {
            try { actions = (JSON.parse(b.content || '[]') || []).filter((i) => i && typeof i === 'object').map((i) => ({ ...i, id: String(i.id) })); } catch { actions = []; }
        }
    }
    return { paragraphs, actions };
}

/** Everything the notes say, as plain text (for the AI summary). */
export function notesAsText({ paragraphs = [], actions = [] }) {
    const body = paragraphs.map((p) => p.text.trim()).filter(Boolean).join('\n');
    const items = actions.filter((a) => (a.text || '').trim()).map((a) => `- [${a.done ? 'x' : ' '}] ${a.text.trim()}`);
    return [body, items.length ? `Action items:\n${items.join('\n')}` : ''].filter(Boolean).join('\n\n');
}

/** 75 -> "1m 15s", 3900 -> "1h 5m". */
export function formatDuration(totalSec) {
    const s = Math.max(0, Math.round(Number(totalSec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m${sec ? ` ${sec}s` : ''}`;
    return `${sec}s`;
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const escapeMd = (s) => clean(s).replace(/([\\`*_[\]])/g, '\\$1');

/**
 * The "Post summary to channel" message (Markdown, rendered by MessageMarkdown).
 *
 * data: { title, durationSec, participants: [names], notesUrl, notesTitle,
 *         actions: [{ text, done, taskKey? }], tasks: [{ title, key?, status, change? }],
 *         summary?: string (AI or typed), postedBy }
 */
export function buildWrapUp(data = {}) {
    const lines = [];
    lines.push(`**Huddle wrap-up — ${escapeMd(data.title || 'Huddle')}**`);
    const meta = [];
    if (data.durationSec != null) meta.push(`Duration ${formatDuration(data.durationSec)}`);
    const people = (data.participants || []).map(clean).filter(Boolean);
    if (people.length) meta.push(`With ${people.map((p) => `@${p}`).join(', ')}`);
    if (meta.length) lines.push(meta.join(' · '));

    const summary = String(data.summary || '').trim();
    if (summary) lines.push('', summary);

    const actions = (data.actions || []).filter((a) => clean(a.text));
    if (actions.length) {
        lines.push('', '**Action items**');
        for (const a of actions) lines.push(`- [${a.done ? 'x' : ' '}] ${escapeMd(a.text)}${a.taskKey ? ` (${a.taskKey})` : ''}`);
    }

    const tasks = (data.tasks || []).filter((t) => clean(t.title));
    if (tasks.length) {
        lines.push('', '**Tasks**');
        for (const t of tasks) {
            const key = t.key ? `${t.key} ` : '';
            lines.push(`- ${key}${escapeMd(t.title)} — ${t.change || t.status || 'linked'}`);
        }
    }

    if (data.notesUrl) lines.push('', `Notes: [${escapeMd(data.notesTitle || 'Huddle notes')}](${data.notesUrl})`);
    return lines.join('\n');
}

let seq = 0;
/** Short unique id for a note block or action item (matches the server's id rule). */
export const newId = (prefix = 'p') => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
