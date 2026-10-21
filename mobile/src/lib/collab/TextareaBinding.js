// Binds a plain <textarea> (knowledge pages: Markdown) to a Y.Text.
//
//  - Typing: the textarea's change is diffed against what it showed before and applied as
//    one minimal Yjs edit (never a whole-text replace), mapped through any remote edits the
//    textarea hasn't shown yet.
//  - Someone else's edit: the textarea gets the new text and the caret/selection is moved with
//    the Yjs delta, so it stays on the same character.
//  - While the keyboard is composing (IME, Android autocorrect underline) the textarea isn't
//    touched: remote edits wait and are shown when the composition ends. Rewriting the value
//    mid-composition makes Android keyboards duplicate or drop letters.
import { diffRange, transformIndex } from './textOps.js';

export const LOCAL_ORIGIN = 'oru-local-edit';

export class TextareaBinding {
  /**
   * @param {import('yjs').Text} ytext
   * @param {{ value: string, selectionStart: number, selectionEnd: number, setSelectionRange?: Function }} el
   * @param {{ onChange?: (text: string) => void, readOnly?: boolean }} [opts]
   */
  constructor(ytext, el, opts = {}) {
    this.ytext = ytext;
    this.el = el;
    this.readOnly = Boolean(opts.readOnly);
    this.onChange = opts.onChange || (() => {});
    this.composing = false;
    this.pending = []; // remote deltas not yet shown in the textarea
    this.shown = ytext.toString();
    el.value = this.shown;

    this._observer = (event, txn) => {
      if (txn.origin === LOCAL_ORIGIN) return;
      this.pending.push(event.delta);
      if (!this.composing) this.flush();
    };
    ytext.observe(this._observer);
  }

  /** Map an index in the textarea's text to the Y.Text, through edits it hasn't shown yet. */
  _toY(index, stickLeft) {
    return this.pending.reduce((i, delta) => transformIndex(delta, i, stickLeft), index);
  }

  /** The textarea changed (input event). */
  input() {
    const next = this.el.value;
    if (this.readOnly) {
      this.el.value = this.shown;
      return;
    }
    const d = diffRange(this.shown, next);
    this.shown = next;
    if (!d) return;
    const start = this._toY(d.index, true);
    const end = this._toY(d.index + d.remove, false);
    this.ytext.doc.transact(() => {
      if (end > start) this.ytext.delete(start, end - start);
      if (d.insert) this.ytext.insert(start, d.insert);
    }, LOCAL_ORIGIN);
    // Our edit moved the remote edits' positions: once nothing is composing, re-sync fully.
    if (this.pending.length && !this.composing) this.flush();
    this.onChange(this.shown);
  }

  compositionStart() {
    this.composing = true;
  }

  compositionEnd() {
    this.composing = false;
    this.input();
    this.flush();
  }

  /** Show remote edits, keeping the caret and selection on the same characters. */
  flush() {
    if (!this.pending.length && this.el.value === this.ytext.toString()) return;
    const deltas = this.pending;
    this.pending = [];
    const text = this.ytext.toString();
    const { selectionStart: s = 0, selectionEnd: e = 0 } = this.el;
    const collapsed = s === e;
    let start = s;
    let end = e;
    for (const delta of deltas) {
      start = transformIndex(delta, start, true);
      end = collapsed ? start : transformIndex(delta, end, false);
    }
    this.shown = text;
    if (this.el.value !== text) {
      this.el.value = text;
      const len = text.length;
      this.el.setSelectionRange?.(Math.min(start, len), Math.min(end, len));
    }
    this.onChange(text);
  }

  setReadOnly(readOnly) {
    this.readOnly = Boolean(readOnly);
  }

  destroy() {
    this.ytext.unobserve(this._observer);
  }
}
