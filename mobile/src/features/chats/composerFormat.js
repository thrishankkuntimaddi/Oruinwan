// Formatting for the phone composer: pure text transforms on the textarea's value and
// selection. They write the same Markdown the web composer sends (turndown defaults:
// **bold**, _italic_, `code`, ``` blocks, - bullets, [text](url)), plus ~~strike~~,
// "1. " numbered lists and "> " quotes, which the message renderer also reads.

export const FORMATS = ['bold', 'italic', 'strike', 'code', 'codeblock', 'link', 'ul', 'ol', 'quote'];

const WRAP = { bold: '**', italic: '_', strike: '~~', code: '`' };
const LINE = { ul: /^- /, ol: /^\d+\. /, quote: /^> ?/ };

const clamp = (n, text) => Math.max(0, Math.min(Number.isFinite(n) ? n : text.length, text.length));

function wrap(text, start, end, mark) {
  const sel = text.slice(start, end);
  // Already wrapped (markers just outside the selection): unwrap.
  if (start >= mark.length && text.slice(start - mark.length, start) === mark && text.slice(end, end + mark.length) === mark) {
    return {
      text: text.slice(0, start - mark.length) + sel + text.slice(end + mark.length),
      start: start - mark.length,
      end: end - mark.length,
    };
  }
  // Keep surrounding spaces outside the markers ("**word** " not "**word **").
  const lead = sel.match(/^\s*/)[0].length;
  const trail = sel.length - sel.trimEnd().length;
  const core = sel.slice(lead, sel.length - trail);
  const s = start + lead;
  const out = text.slice(0, s) + mark + core + mark + text.slice(s + core.length);
  return { text: out, start: s + mark.length, end: s + mark.length + core.length };
}

function codeBlock(text, start, end) {
  const sel = text.slice(start, end);
  const before = start > 0 && text[start - 1] !== '\n' ? '\n' : '';
  const after = end < text.length && text[end] !== '\n' ? '\n' : '';
  const open = `${before}\`\`\`\n`;
  const out = `${text.slice(0, start)}${open}${sel}\n\`\`\`${after}${text.slice(end)}`;
  const s = start + open.length;
  return { text: out, start: s, end: s + sel.length };
}

function lines(text, start, end, kind) {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  let to = text.indexOf('\n', end > start && text[end - 1] === '\n' ? end - 1 : end);
  if (to < 0) to = text.length;
  const block = text.slice(from, to).split('\n');
  const re = LINE[kind];
  const all = block.every((l) => re.test(l));
  const next = all
    ? block.map((l) => l.replace(re, ''))
    : block.map((l, i) => {
        const bare = l.replace(LINE.ul, '').replace(LINE.ol, '').replace(LINE.quote, '');
        if (kind === 'ul') return `- ${bare}`;
        if (kind === 'ol') return `${i + 1}. ${bare}`;
        return `> ${bare}`;
      });
  const joined = next.join('\n');
  const out = text.slice(0, from) + joined + text.slice(to);
  // A single empty line: put the caret after the new marker, ready to type.
  if (start === end && block.length === 1) {
    const caret = from + joined.length;
    return { text: out, start: caret, end: caret };
  }
  return { text: out, start: from, end: from + joined.length };
}

/** A URL as the renderer links it: https:// is added when there's no scheme. */
export function normalizeUrl(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return `mailto:${u}`;
  return `https://${u.replace(/^\/+/, '')}`;
}

/** [label](url) in place of the selection (the selection is the label; else the URL is). */
export function insertLink(text, start, end, url, label = '') {
  const s = clamp(start, text);
  const e = Math.max(s, clamp(end, text));
  const href = normalizeUrl(url);
  if (!href) return { text, start: s, end: e };
  const name = (text.slice(s, e).trim() || String(label).trim() || href.replace(/^(https?:\/\/|mailto:)/i, '')).replace(/[[\]]/g, '');
  const md = `[${name}](${href})`;
  const out = text.slice(0, s) + md + text.slice(e);
  return { text: out, start: s + md.length, end: s + md.length };
}

/**
 * Applies one format to `text` with the selection [start, end).
 * Returns { text, start, end }: the new value and the selection to restore.
 * 'link' needs a URL: use insertLink.
 */
export function applyFormat(text, start, end, kind) {
  const value = String(text ?? '');
  const s = clamp(start, value);
  const e = Math.max(s, clamp(end, value));
  if (WRAP[kind]) return wrap(value, s, e, WRAP[kind]);
  if (kind === 'codeblock') return codeBlock(value, s, e);
  if (LINE[kind]) return lines(value, s, e, kind);
  return { text: value, start: s, end: e };
}

/** Puts `insert` at the selection (replacing it); the caret goes after it. */
export function insertAt(text, start, end, insert) {
  const value = String(text ?? '');
  const s = clamp(start, value);
  const e = Math.max(s, clamp(end, value));
  const out = value.slice(0, s) + insert + value.slice(e);
  return { text: out, start: s + insert.length, end: s + insert.length };
}
