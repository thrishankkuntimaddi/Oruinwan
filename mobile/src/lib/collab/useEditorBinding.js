// Hooks that bind the phone editors to a synced Y.Doc (see noteBlocks.js and TextareaBinding.js).
import { useEffect, useRef } from 'react';
import { applyLocal, blocksFromY, readEditor, renderBlocks } from './noteBlocks.js';
import { LOCAL_ORIGIN, TextareaBinding } from './TextareaBinding.js';

const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16));

/**
 * Note editor (contenteditable) ↔ doc.getArray('blocks'). While `active`, the returned ref's
 * handlers must be wired to the editor: onInput → input(), onCompositionStart/End.
 */
export function useNoteBinding(doc, active, editorRef) {
  const binding = useRef(null);
  useEffect(() => {
    const root = editorRef.current;
    if (!doc || !active || !root) return undefined;
    const yarr = doc.getArray('blocks');
    const sigs = new WeakMap();
    let rendered = new Set();
    let composing = false;
    let queued = false;
    let frame = null;

    const input = () => {
      const prevById = new Map(blocksFromY(yarr).map((b) => [b.id, b]));
      const items = readEditor(root, sigs, prevById);
      doc.transact(() => applyLocal(yarr, items, rendered), LOCAL_ORIGIN);
      rendered = new Set(items.map((i) => i.block.id));
    };
    const render = () => {
      frame = null;
      if (!root.isConnected) return;
      rendered = renderBlocks(root, blocksFromY(yarr), sigs);
    };
    const onUpdate = (_update, origin) => {
      if (origin === LOCAL_ORIGIN) return;
      if (composing) {
        queued = true;
        return;
      }
      if (!frame) frame = nextFrame(render);
    };

    render();
    doc.on('update', onUpdate);
    binding.current = {
      input,
      compositionStart: () => {
        composing = true;
      },
      compositionEnd: () => {
        composing = false;
        input();
        if (queued) {
          queued = false;
          render();
        }
      },
    };
    return () => {
      doc.off('update', onUpdate);
      binding.current = null;
    };
  }, [doc, active, editorRef]);
  return binding;
}

/** Knowledge page textarea ↔ doc.getText('content'). onText gets the full text after each change. */
export function useTextareaBinding(doc, active, textRef, readOnly, onText) {
  const binding = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  useEffect(() => {
    const el = textRef.current;
    if (!doc || !active || !el) return undefined;
    const b = new TextareaBinding(doc.getText('content'), el, { readOnly, onChange: (t) => onTextRef.current?.(t) });
    binding.current = b;
    onTextRef.current?.(doc.getText('content').toString());
    return () => {
      b.destroy();
      binding.current = null;
    };
    // readOnly is updated below without rebinding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, active, textRef]);
  useEffect(() => {
    binding.current?.setReadOnly(readOnly);
  }, [readOnly]);
  return binding;
}
