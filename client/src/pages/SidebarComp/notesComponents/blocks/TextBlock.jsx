import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Trash2, Bold, Italic, Strikethrough, List } from 'lucide-react';
import { sanitizeHtml } from '../../../../utils/sanitizeHtml';

const TEXT_STYLE = {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font)',
    fontSize: '15px',
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: '0.01em',
};

const RICH_CLASSES = `[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2
    [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2
    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
    [&_ol]:list-decimal [&_ol]:pl-5
    [&_a]:underline [&_p]:mb-1 whitespace-pre-wrap`;

/** true when the editor shows nothing (ignores <br> and zero-width spaces). */
function isVisuallyEmpty(node) {
    if (!node) return true;
    if (node.querySelector('img,li,hr,table')) return false;
    return (node.textContent || '').replace(/​/g, '').trim() === '';
}

/** Read-only rendering of a text block (sanitised). */
export const TextBlockView = ({ block }) => {
    const html = sanitizeHtml(block.content || '');
    if (!html) return null;
    return (
        <div className={`mb-1 ${RICH_CLASSES}`} style={TEXT_STYLE}
            // Sanitised above with an allowlist (utils/sanitizeHtml).
            dangerouslySetInnerHTML={{ __html: html }} />
    );
};

const TextBlock = ({ block, onBlockChange, onRemoveBlock, onSlashCommand, onAddBlockAfter, registerRef }) => {
    const editorRef = useRef(null);
    const isComposingRef = useRef(false);
    const [empty, setEmpty] = useState(() => !(block.content && block.content !== '<br>'));

    useEffect(() => {
        const node = editorRef.current;
        if (!node) return;
        // Stored content comes from other users too: never inject it unsanitised.
        node.innerHTML = sanitizeHtml(block.content || '');
        setEmpty(isVisuallyEmpty(node));
        // Only on block identity: re-setting innerHTML while typing would move the caret.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block.id]);

    useEffect(() => {
        if (registerRef) registerRef(block.id, editorRef.current);
        return () => { if (registerRef) registerRef(block.id, null); };
    }, [block.id, registerRef]);

    const emitChange = useCallback(() => {
        const node = editorRef.current;
        if (!node) return;
        setEmpty(isVisuallyEmpty(node));
        onBlockChange(block.id, node.innerHTML || '');
    }, [block.id, onBlockChange]);

    const execFormat = (command, value = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        emitChange();
    };

    const handleKeyDown = (e) => {
        if (isComposingRef.current) return;
        const node = editorRef.current;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const br = document.createElement('br');
                range.insertNode(br);
                range.setStartAfter(br); range.setEndAfter(br);
                sel.removeAllRanges(); sel.addRange(range);
                const textNode = document.createTextNode('​');
                range.insertNode(textNode);
                range.setStartAfter(textNode); range.setEndAfter(textNode);
                sel.removeAllRanges(); sel.addRange(range);
            }
            emitChange();
            return;
        }

        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            emitChange();
            if (onAddBlockAfter) onAddBlockAfter(block.id);
            return;
        }

        if (e.key === '/' && onSlashCommand && isVisuallyEmpty(node)) {
            e.preventDefault();
            const rect = node?.getBoundingClientRect();
            onSlashCommand(block.id, '', { x: rect ? rect.left : 160, y: rect ? rect.bottom + 4 : 300 });
            return;
        }

        if (e.key === 'Backspace' && isVisuallyEmpty(node) && onRemoveBlock) {
            e.preventDefault();
            onRemoveBlock(block.id);
        }
    };

    const fmtBtn = { padding: '5px', background: 'transparent', border: 'none', borderRadius: '2px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 100ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const fmtBtnHover = (e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; };
    const fmtBtnLeave = (e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; };
    const sep = { width: '1px', height: '14px', background: 'var(--border-default)', margin: '0 3px', flexShrink: 0 };

    return (
        <div className="group relative mb-1">
            <div className="hidden group-focus-within:flex items-center gap-0.5 mb-2 w-fit"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', padding: '3px 6px', boxShadow: 'var(--card-shadow)' }}>
                <button onMouseDown={e => { e.preventDefault(); execFormat('bold'); }} style={fmtBtn} onMouseEnter={fmtBtnHover} onMouseLeave={fmtBtnLeave} title="Bold"><Bold size={12} /></button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('italic'); }} style={fmtBtn} onMouseEnter={fmtBtnHover} onMouseLeave={fmtBtnLeave} title="Italic"><Italic size={12} /></button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('strikeThrough'); }} style={fmtBtn} onMouseEnter={fmtBtnHover} onMouseLeave={fmtBtnLeave} title="Strikethrough"><Strikethrough size={12} /></button>
                <div style={sep} />
                <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h1'); }} style={{ ...fmtBtn, fontSize: '9px', fontWeight: 700, padding: '4px 5px' }} onMouseEnter={fmtBtnHover} onMouseLeave={fmtBtnLeave} title="H1">H1</button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h2'); }} style={{ ...fmtBtn, fontSize: '9px', fontWeight: 700, padding: '4px 5px' }} onMouseEnter={fmtBtnHover} onMouseLeave={fmtBtnLeave} title="H2">H2</button>
                <div style={sep} />
                <button onMouseDown={e => { e.preventDefault(); execFormat('insertUnorderedList'); }} style={fmtBtn} onMouseEnter={fmtBtnHover} onMouseLeave={fmtBtnLeave} title="Bullet List"><List size={12} /></button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'p'); }} style={{ ...fmtBtn, fontSize: '10px', fontWeight: 500, padding: '4px 5px' }} onMouseEnter={fmtBtnHover} onMouseLeave={fmtBtnLeave} title="Normal">¶</button>
            </div>

            <div className="relative">
                <button
                    onClick={() => onRemoveBlock(block.id)}
                    style={{ position: 'absolute', top: '2px', right: 0, padding: '4px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                    className="group-hover:!opacity-100"
                    title="Delete block"
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--state-danger)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <Trash2 size={14} />
                </button>

                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-testid="note-text-block"
                    onInput={() => { if (!isComposingRef.current) emitChange(); }}
                    onBlur={emitChange}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => { isComposingRef.current = true; }}
                    onCompositionEnd={() => { isComposingRef.current = false; emitChange(); }}
                    className={`w-full bg-transparent outline-none min-h-[1.75em] pr-8 ${RICH_CLASSES}`}
                    style={{ ...TEXT_STYLE, caretColor: 'var(--accent)' }}
                />
                {empty && (
                    <div aria-hidden="true"
                        style={{ position: 'absolute', top: 0, left: 0, color: 'var(--text-muted)', fontSize: '15px', fontFamily: 'var(--font)', fontWeight: 400, lineHeight: 1.75, pointerEvents: 'none', userSelect: 'none' }}
                    >
                        Type <span style={{ fontSize: '11px', padding: '1px 5px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>/</span> for commands, or start typing…
                    </div>
                )}
            </div>
        </div>
    );
};

export default TextBlock;
