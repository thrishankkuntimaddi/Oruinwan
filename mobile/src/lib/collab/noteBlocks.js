// Live notes: the phone edits a note as one contenteditable, the shared document is the web's
// block list (docs/api/collab.md: Y.Array 'blocks' of Y.Map { id, type, content: Y.Text, meta }).
// Every top-level element of the editor is one block and carries its id in data-bid:
//
//   text       <p> (or the <ul>/<ol>/<blockquote>/<table> it holds)   content = HTML, like the web
//   heading    <h1>-<h3>                                              content = text, meta.level
//   code       <pre>                                                  content = text, meta kept (lang)
//   checklist  <ul data-type="checklist"><li data-checked data-iid>   content = JSON [{ id, text, done }]
//   divider    <hr>
//   others     (image, table, toggle, callout, files…) shown read-only, never rewritten by the phone
//
// Local typing changes only the blocks whose element changed since it was last rendered or
// read, as minimal Y.Text edits. Blocks someone else changed that the editor doesn't show yet
// (a re-render waits while the keyboard is composing) are never overwritten or deleted.
import * as Y from 'yjs';
import { sanitizeHtml } from '../../ui/sanitize.js';
import { caretShift, diffReplaceText } from './textOps.js';

export { LOCAL_ORIGIN } from './TextareaBinding.js';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const parseJson = (v, fallback) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};
const sameMeta = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

let seq = 0;
export function newBlockId() {
  seq = (seq + 1) % 1e6;
  return `b${Date.now().toString(36)}${seq.toString(36)}m`;
}

// ---------------------------------------------------------------- Yjs side

function yMapToBlock(m) {
  if (!(m instanceof Y.Map)) return null;
  const c = m.get('content');
  return {
    id: String(m.get('id') || ''),
    type: String(m.get('type') || 'text'),
    content: c instanceof Y.Text ? c.toString() : typeof c === 'string' ? c : '',
    meta: m.get('meta') ?? null,
  };
}

/** The shared block list as plain blocks. */
export function blocksFromY(yarray) {
  return yarray.toArray().map(yMapToBlock).filter(Boolean);
}

function blockToYMap(block) {
  const m = new Y.Map();
  m.set('id', block.id);
  m.set('type', block.type);
  const text = new Y.Text();
  if (block.content) text.insert(0, block.content);
  m.set('content', text);
  m.set('meta', block.meta ?? null);
  return m;
}

function updateYMap(m, block) {
  if (m.get('type') !== block.type) m.set('type', block.type);
  if (!sameMeta(m.get('meta'), block.meta)) m.set('meta', block.meta ?? null);
  let text = m.get('content');
  if (!(text instanceof Y.Text)) {
    text = new Y.Text();
    m.set('content', text);
  }
  diffReplaceText(text, block.content);
}

/**
 * Apply the editor's blocks to the shared array.
 * @param items     [{ block, changed }] in editor order
 * @param rendered  ids the editor showed after its last render/read: only those may be deleted
 */
export function applyLocal(yarray, items, rendered) {
  const present = new Set(items.map((i) => i.block.id));
  const indexOf = (id) => yarray.toArray().findIndex((m) => m instanceof Y.Map && m.get('id') === id);
  // Deletions: blocks the editor showed and no longer has.
  for (let i = yarray.length - 1; i >= 0; i -= 1) {
    const m = yarray.get(i);
    const id = m instanceof Y.Map ? m.get('id') : null;
    if (id && rendered.has(id) && !present.has(id)) yarray.delete(i, 1);
  }
  let prev = null;
  for (const { block, changed } of items) {
    const at = indexOf(block.id);
    if (at < 0) {
      const after = prev ? indexOf(prev) : -1;
      yarray.insert(after + 1, [blockToYMap(block)]);
    } else if (changed && !block.foreign) {
      updateYMap(yarray.get(at), block);
    }
    prev = block.id;
  }
}

// ---------------------------------------------------------------- DOM side

const EDITABLE = new Set(['text', 'heading', 'code', 'checklist', 'divider']);
const LIST_TAGS =new Set(['UL', 'OL', 'BLOCKQUOTE', 'TABLE']);
const BLOCK_TAGS = new Set(['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'HR']);

function safeSrc(src) {
  const s = String(src || '');
  return /^(https?:|data:image\/)/i.test(s) ? s : '';
}

/** A block type the phone shows but doesn't edit: a read-only card. */
function foreignHtml(block) {
  const meta = block.meta || {};
  let inner;
  if (block.type === 'image' && safeSrc(block.content)) inner = `<img src="${esc(safeSrc(block.content))}" alt="" style="max-width:100%;border-radius:12px">`;
  else if (block.type === 'table') {
    const t = parseJson(block.content, {}) || {};
    const row = (cells, tag) => `<tr>${(cells || []).map((c) => `<${tag}>${esc(c)}</${tag}>`).join('')}</tr>`;
    inner = `<table>${row(t.headers, 'th')}${(t.rows || []).map((r) => row(r, 'td')).join('')}</table>`;
  } else if (block.type === 'toggle') inner = `<p><strong>${esc(meta.title || 'Toggle')}</strong></p><p>${esc(block.content)}</p>`;
  else if (block.type === 'callout') inner = `<blockquote>${esc(block.content)}</blockquote>`;
  else if (block.type === 'image') inner = `<p>${esc(meta.name || 'Image')}</p>`;
  else inner = `<p>${esc(meta.name || meta.title || block.content || block.type)}</p>`;
  return `<div data-bid="${esc(block.id)}" data-foreign="${esc(block.type)}" contenteditable="false" class="my-2 rounded-xl border border-line-soft bg-surface-2 px-3 py-2">${inner}</div>`;
}

/** The editor element for one block (a string of HTML with data-bid). */
export function blockHtml(block) {
  const bid = `data-bid="${esc(block.id)}"`;
  switch (block.type) {
    case 'text': {
      const html = sanitizeHtml(block.content || '');
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const kids = [...tpl.content.childNodes].filter((n) => !(n.nodeType === 3 && !n.textContent.trim()));
      if (kids.length === 1 && kids[0].nodeType === 1 && LIST_TAGS.has(kids[0].tagName)) {
        kids[0].setAttribute('data-bid', block.id);
        return kids[0].outerHTML;
      }
      // Several paragraphs in one block (notes first written on the phone are one HTML block): a <div>.
      if (kids.some((n) => n.nodeType === 1 && BLOCK_TAGS.has(n.tagName))) return `<div ${bid}>${html}</div>`;
      return `<p ${bid}>${html || '<br>'}</p>`;
    }
    case 'heading': {
      const level = Math.min(Math.max(Number(block.meta?.level) || 1, 1), 3);
      return `<h${level} ${bid}>${esc(block.content) || '<br>'}</h${level}>`;
    }
    case 'code':
      return `<pre ${bid}>${esc(block.content) || '<br>'}</pre>`;
    case 'divider':
      return `<hr ${bid}>`;
    case 'checklist': {
      const items = parseJson(block.content, []);
      const list = Array.isArray(items) && items.length ? items : [{ id: 0, text: '', done: false }];
      return `<ul data-type="checklist" ${bid}>${list
        .map((it) => `<li data-checked="${it?.done ? 'true' : 'false'}" data-iid="${esc(it?.id ?? '')}">${esc(it?.text) || '<br>'}</li>`)
        .join('')}</ul>`;
    }
    default:
      return foreignHtml(block);
  }
}

function withoutBid(el) {
  const c = el.cloneNode(true);
  c.removeAttribute('data-bid');
  return c;
}

const emptyHtml = (html) => (html === '<br>' ? '' : html);

/** The block an editor element stands for (prev: the shared block with that id, if any). */
export function elementToBlock(el, id, prev) {
  const tag = el.tagName;
  const meta = prev?.meta ?? null;
  if (el.hasAttribute('data-foreign')) return prev ? { ...prev, foreign: true } : null;
  if (/^H[1-6]$/.test(tag)) {
    return { id, type: 'heading', content: el.textContent, meta: { ...(prev?.type === 'heading' ? meta : null), level: Math.min(Number(tag[1]), 3) } };
  }
  if (tag === 'PRE') return { id, type: 'code', content: el.textContent, meta: prev?.type === 'code' ? meta : null };
  if (tag === 'HR') return { id, type: 'divider', content: '', meta: null };
  if (tag === 'UL' && el.getAttribute('data-type') === 'checklist') {
    const seen = new Set();
    const items = [...el.children]
      .filter((li) => li.tagName === 'LI')
      .map((li, i) => {
        let iid = li.getAttribute('data-iid');
        if (!iid || seen.has(iid)) {
          iid = String(Date.now() + i);
          li.setAttribute('data-iid', iid);
        }
        seen.add(iid);
        return { id: /^\d+$/.test(iid) ? Number(iid) : iid, text: li.textContent, done: li.getAttribute('data-checked') === 'true' };
      });
    return { id, type: 'checklist', content: JSON.stringify(items), meta };
  }
  if (LIST_TAGS.has(tag)) return { id, type: 'text', content: sanitizeHtml(withoutBid(el).outerHTML), meta: prev?.type === 'text' ? meta : null };
  return { id, type: 'text', content: emptyHtml(sanitizeHtml(el.innerHTML)), meta: prev?.type === 'text' ? meta : null };
}

/** Wrap loose text and inline elements at the top level in a <p>, keeping the caret where it was. */
function wrapLoose(root) {
  const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
  const anchor = sel?.rangeCount ? { node: sel.anchorNode, offset: sel.anchorOffset } : null;
  let run = null;
  for (const node of [...root.childNodes]) {
    const loose = node.nodeType === 3 ? node.textContent.length > 0 : node.nodeType === 1 && !BLOCK_TAGS.has(node.tagName) && !node.hasAttribute('data-bid');
    if (!loose) {
      if (node.nodeType === 3) node.remove();
      run = null;
      continue;
    }
    if (!run) {
      run = document.createElement('p');
      root.insertBefore(run, node);
    }
    run.appendChild(node);
  }
  if (anchor?.node && root.contains(anchor.node)) {
    try {
      sel.collapse(anchor.node, anchor.offset);
    } catch {
      /* the node went away */
    }
  }
}

/**
 * Read the editor after an edit.
 * @returns [{ block, changed }] in order. Elements without an id (new, or a copy made by
 * pressing Enter) get a fresh one.
 */
export function readEditor(root, sigs, prevById) {
  wrapLoose(root);
  const seen = new Set();
  const out = [];
  for (const el of [...root.children]) {
    let id = el.getAttribute('data-bid');
    if (!id || seen.has(id)) {
      id = newBlockId();
      el.setAttribute('data-bid', id);
    }
    seen.add(id);
    const html = el.outerHTML;
    const prev = prevById.get(id);
    const changed = !prev || sigs.get(el) !== html;
    const block = changed ? elementToBlock(el, id, prev) : prev;
    if (!block) continue;
    sigs.set(el, el.outerHTML);
    out.push({ block, changed });
  }
  return out;
}

// ---------------------------------------------------------------- caret

function textOffset(el, node, offset) {
  if (!el.contains(node)) return null;
  const range = document.createRange();
  range.setStart(el, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

function placeCaret(el, offset) {
  const sel = window.getSelection?.();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = offset;
  let node = walker.nextNode();
  let last = null;
  while (node) {
    if (left <= node.textContent.length) {
      sel.collapse(node, left);
      return;
    }
    left -= node.textContent.length;
    last = node;
    node = walker.nextNode();
  }
  if (last) sel.collapse(last, last.textContent.length);
  else sel.collapse(el, 0);
}

function caretInfo(root) {
  const sel = window.getSelection?.();
  if (!sel?.rangeCount || !root.contains(sel.anchorNode)) return null;
  let top = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
  while (top && top.parentElement !== root) top = top.parentElement;
  if (!top) return null;
  return { bid: top.getAttribute('data-bid'), offset: textOffset(top, sel.anchorNode, sel.anchorOffset), text: top.textContent };
}

/**
 * Show the shared blocks in the editor, touching only elements that differ, and keep the
 * caret on the same character when its block changed. Returns the ids now shown.
 */
export function renderBlocks(root, blocks, sigs) {
  const caret = caretInfo(root);
  const byId = new Map();
  for (const el of [...root.children]) {
    const id = el.getAttribute('data-bid');
    if (id && !byId.has(id)) byId.set(id, el);
  }
  const tpl = document.createElement('template');
  const used = new Set();
  let caretEl = null;
  blocks.forEach((block, i) => {
    const html = blockHtml(block);
    let el = byId.get(block.id);
    let same = false;
    if (el && sigs.get(el) === el.outerHTML) {
      if (sigs.get(el) === html) same = true;
      else if (!el.hasAttribute('data-foreign') && EDITABLE.has(block.type)) same = sameBlock(elementToBlock(el, block.id, null), block);
    }
    if (!same) {
      tpl.innerHTML = html;
      const fresh = tpl.content.firstElementChild;
      if (el) el.replaceWith(fresh);
      el = fresh;
      sigs.set(el, el.outerHTML);
    }
    used.add(el);
    if (caret && caret.bid === block.id && !same) caretEl = el;
    const at = root.children[i];
    if (at !== el) root.insertBefore(el, at || null);
  });
  for (const node of [...root.childNodes]) if (!used.has(node)) node.remove();
  if (caretEl && caret.offset != null) placeCaret(caretEl, caretShift(caret.text, caretEl.textContent, caret.offset));
  return new Set(blocks.map((b) => b.id));
}

function sameBlock(a, b) {
  return a.type === b.type && a.content === b.content && (a.type !== 'heading' || Number(a.meta?.level || 1) === Number(b.meta?.level || 1));
}
