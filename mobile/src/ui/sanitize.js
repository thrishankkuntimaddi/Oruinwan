// Allow-list HTML sanitiser for note and page content created by the web editor.
// Anything not listed is unwrapped (children kept) or dropped (scripts, styles, embeds).

const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'CODE', 'PRE', 'BLOCKQUOTE', 'A', 'BR', 'HR', 'SPAN', 'DIV', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT']);
const ATTRS = { A: ['href'], UL: ['data-type'], LI: ['data-checked'], '*': [] };

function clean(node, doc) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue;
    if (child.nodeType !== 1) {
      child.remove();
      continue;
    }
    const tag = child.tagName;
    if (DROP.has(tag)) {
      child.remove();
      continue;
    }
    clean(child, doc);
    if (!ALLOWED.has(tag)) {
      // Unwrap unknown elements but keep their text.
      const frag = doc.createDocumentFragment();
      while (child.firstChild) frag.appendChild(child.firstChild);
      child.replaceWith(frag);
      continue;
    }
    const keep = ATTRS[tag] || ATTRS['*'];
    for (const attr of [...child.attributes]) {
      if (!keep.includes(attr.name)) child.removeAttribute(attr.name);
    }
    if (tag === 'A') {
      const href = child.getAttribute('href') || '';
      if (!/^(https?:|mailto:)/i.test(href)) child.removeAttribute('href');
      child.setAttribute('target', '_blank');
      child.setAttribute('rel', 'noreferrer noopener');
    }
  }
}

export function sanitizeHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  clean(root, doc);
  return root.innerHTML;
}

export function htmlToText(html, max = 140) {
  if (!html) return '';
  // Block boundaries become spaces so "<li>a</li><li>b</li>" reads "a b", not "ab".
  const spaced = html.replace(/<\/(p|h[1-6]|li|div|pre|blockquote|tr|td|th)>|<br\s*\/?>/gi, '$& ');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, max);
}
