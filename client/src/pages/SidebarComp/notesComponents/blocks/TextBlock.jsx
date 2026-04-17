import React, { useRef, useEffect, useCallback } from 'react';
import { Trash2, Bold, Italic, Strikethrough, List } from 'lucide-react';

const TextBlock = ({ block, onBlockChange, onRemoveBlock, onSlashCommand, onAddBlockAfter, registerRef }) => {
    const editorRef = useRef(null);
    const isComposingRef = useRef(false);

    useEffect(() => {
        if (editorRef.current && block.content !== undefined) {
            editorRef.current.innerHTML = block.content || '';
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block.id]);

    useEffect(() => {
        if (registerRef) registerRef(block.id, editorRef.current);
        return () => { if (registerRef) registerRef(block.id, null); };
    }, [block.id, registerRef]);

    const execFormat = (command, value = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        onBlockChange(block.id, editorRef.current?.innerHTML || '');
    };

    const handleBlur = useCallback(() => {
        const html = editorRef.current?.innerHTML || '';
        onBlockChange(block.id, html);
    }, [block.id, onBlockChange]);

    const handleKeyDown = (e) => {
        if (isComposingRef.current) return;
        const text = editorRef.current?.innerText || '';

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
                const textNode = document.createTextNode('\u200B');
                range.insertNode(textNode);
                range.setStartAfter(textNode); range.setEndAfter(textNode);
                sel.removeAllRanges(); sel.addRange(range);
            }
            return;
        }

        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            onBlockChange(block.id, editorRef.current?.innerHTML || '');
            if (onAddBlockAfter) onAddBlockAfter(block.id);
            return;
        }

        if (e.key === '/' && onSlashCommand) {
            const rawText = text.trim();
            if (rawText === '' || rawText === '/') {
                e.preventDefault();
                const rect = editorRef.current?.getBoundingClientRect();
                onSlashCommand(block.id, '', { x: rect ? rect.left : 160, y: rect ? rect.bottom + 4 : 300 });
                return;
            }
        }

        if (e.key === 'Backspace' && text.trim() === '' && onRemoveBlock) {
            e.preventDefault();
            onRemoveBlock(block.id);
        }
    };

    const fmtBtn = { padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 100ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const fmtBtnHover = (e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; };
    const fmtBtnLeave = (e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; };
    const sep = { width: '1px', height: '14px', background: 'var(--border-default)', margin: '0 3px', flexShrink: 0 };

    return (
        <div className="group relative mb-1">
            {/* Format Toolbar */}
            <div className="hidden group-focus-within:flex items-center gap-0.5 mb-2 w-fit"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '3px 6px', boxShadow: 'var(--card-shadow)' }}>
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
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                >
                    <Trash2 size={14} />
                </button>

                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => { isComposingRef.current = true; }}
                    onCompositionEnd={() => {
                        isComposingRef.current = false;
                        onBlockChange(block.id, editorRef.current?.innerHTML || '');
                    }}
                    className="w-full bg-transparent outline-none min-h-[1.75em] pr-8
                        [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-2
                        [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-2
                        [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1
                        [&>p]:mb-1 whitespace-pre-wrap"
                    style={{
                        color: 'var(--text-primary)',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        fontSize: '15px',
                        fontWeight: 400,
                        lineHeight: 1.75,
                        letterSpacing: '0.01em',
                        caretColor: '#b8956a',
                    }}
                />
                {/* Placeholder */}
                <div
                    style={{ position: 'absolute', top: 0, left: 0, color: 'var(--text-muted)', fontSize: '15px', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 400, lineHeight: 1.75, pointerEvents: 'none', userSelect: 'none', display: block.content && block.content !== '<br>' ? 'none' : undefined }}
                >
                    Type <span style={{ fontFamily: 'monospace', fontSize: '11px', padding: '1px 5px', background: 'var(--bg-active)', border: '1px solid var(--border-default)' }}>/</span> for commands, or start typing…
                </div>
            </div>
        </div>
    );
};

export default TextBlock;
