// AI help that writes into the note itself (not a separate chat): a summary on top, action
// items as a checklist at the end. The AI answers in Markdown; this turns it into the note
// editor's HTML (headings, lists, checklists, bold/italic/code).
import { parseBlocks } from '../../ui/Markdown.jsx';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inlineHtml(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, '$1<em>$2</em>');
}

/** Markdown from the AI → note HTML. "- [ ] item" lines become a checklist. */
export function markdownToNoteHtml(md) {
  return parseBlocks(md)
    .map((b) => {
      if (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') return `<h2>${inlineHtml(b.text)}</h2>`;
      if (b.type === 'quote') return `<blockquote>${inlineHtml(b.text)}</blockquote>`;
      if (b.type === 'code') return `<pre>${esc(b.text)}</pre>`;
      if (b.type === 'ul') {
        const check = b.items.every((it) => /^\[( |x|X)\]\s/.test(it));
        if (check) {
          return `<ul data-type="checklist">${b.items
            .map((it) => `<li data-checked="${/^\[(x|X)\]/.test(it) ? 'true' : 'false'}">${inlineHtml(it.replace(/^\[( |x|X)\]\s/, ''))}</li>`)
            .join('')}</ul>`;
        }
        return `<ul>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join('')}</ul>`;
      }
      if (b.type === 'ol') return `<ol>${b.items.map((it) => `<li>${inlineHtml(it)}</li>`).join('')}</ol>`;
      return `<p>${inlineHtml(b.text).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

/** The block a summary goes in: a heading, the summary, then a divider before the note. */
export function summaryBlock(md, when = new Date()) {
  const date = when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `<h2>✨ Summary · ${esc(date)}</h2>${markdownToNoteHtml(md)}<hr>`;
}

export function actionItemsBlock(md) {
  return `<h2>Action items</h2>${markdownToNoteHtml(md)}`;
}
