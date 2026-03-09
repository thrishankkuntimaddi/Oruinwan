import React, { useRef, useEffect, useCallback } from 'react';
import { Trash2, Bold, Italic, Strikethrough, List } from 'lucide-react';

const TextBlock = ({ block, onBlockChange, onRemoveBlock, onSlashCommand, onAddBlockAfter, registerRef }) => {
    const editorRef = useRef(null);
    const isComposingRef = useRef(false); // for IME input (Chinese, Japanese, etc.)

    // ── Set innerHTML only on first mount (never again — avoids cursor-reset bug) ──
    useEffect(() => {
        if (editorRef.current && block.content !== undefined) {
            editorRef.current.innerHTML = block.content || '';
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [block.id]); // only re-run when the block ID changes (i.e., a completely new block)

    // Register DOM node with parent for auto-focus
    useEffect(() => {
        if (registerRef) registerRef(block.id, editorRef.current);
        return () => { if (registerRef) registerRef(block.id, null); };
    }, [block.id, registerRef]);

    const execFormat = (command, value = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        onBlockChange(block.id, editorRef.current?.innerHTML || '');
    };

    // Save on blur — avoids re-rendering on every keystroke (fixes cursor-reset / reversed text)
    const handleBlur = useCallback(() => {
        const html = editorRef.current?.innerHTML || '';
        onBlockChange(block.id, html);
    }, [block.id, onBlockChange]);

    const handleKeyDown = (e) => {
        if (isComposingRef.current) return; // ignore IME composition

        const text = editorRef.current?.innerText || '';

        // Enter → insert a <br> newline within the same block (like a normal text editor)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // Insert a line break at cursor position
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                range.deleteContents();
                const br = document.createElement('br');
                range.insertNode(br);
                // Move cursor after the <br>
                range.setStartAfter(br);
                range.setEndAfter(br);
                sel.removeAllRanges();
                sel.addRange(range);
                // Insert a zero-width space so cursor is visible on empty last line
                const textNode = document.createTextNode('\u200B');
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            return;
        }

        // Shift + Enter → create a new block below (power-user shortcut)
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            // Save current content first
            onBlockChange(block.id, editorRef.current?.innerHTML || '');
            if (onAddBlockAfter) onAddBlockAfter(block.id);
            return;
        }

        // Slash key on empty block → open slash command menu
        if (e.key === '/' && onSlashCommand) {
            const rawText = text.trim();
            if (rawText === '' || rawText === '/') {
                e.preventDefault();
                const rect = editorRef.current?.getBoundingClientRect();
                onSlashCommand(block.id, '', {
                    x: rect ? rect.left : 160,
                    y: rect ? rect.bottom + 4 : 300,
                });
                return;
            }
        }

        // Backspace on completely empty block → remove block
        if (e.key === 'Backspace' && text.trim() === '' && onRemoveBlock) {
            e.preventDefault();
            onRemoveBlock(block.id);
        }
    };

    return (
        <div className="group relative mb-1">
            {/* Format Toolbar — shown via CSS :focus-within so it doesn't cause re-renders */}
            <div className="hidden group-focus-within:flex items-center gap-0.5 mb-2 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 rounded-xl shadow-lg w-fit">
                <button onMouseDown={e => { e.preventDefault(); execFormat('bold'); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors" title="Bold"><Bold size={13} /></button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('italic'); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors" title="Italic"><Italic size={13} /></button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('strikeThrough'); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors" title="Strikethrough"><Strikethrough size={13} /></button>
                <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-600 mx-1" />
                <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h1'); }} className="px-1.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors text-[10px] font-bold" title="H1">H1</button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h2'); }} className="px-1.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors text-[10px] font-bold" title="H2">H2</button>
                <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-600 mx-1" />
                <button onMouseDown={e => { e.preventDefault(); execFormat('insertUnorderedList'); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors" title="Bullet List"><List size={13} /></button>
                <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'p'); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors text-[11px] font-medium" title="Normal">¶</button>
            </div>

            <div className="relative">
                <button
                    onClick={() => onRemoveBlock(block.id)}
                    className="absolute top-1 right-0 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Delete block"
                >
                    <Trash2 size={16} />
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
                    className="w-full text-gray-700 dark:text-gray-200 text-base leading-relaxed bg-transparent outline-none min-h-[1.75em] pr-8
                        [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-2 [&>h1]:text-gray-900 [&>h1]:dark:text-white
                        [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:text-gray-800 [&>h2]:dark:text-gray-100
                        [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1
                        [&>p]:mb-1 whitespace-pre-wrap"
                    style={{ caretColor: 'currentColor' }}
                />
                {/* Placeholder — shown when block is empty */}
                <div
                    className="absolute top-0 left-0 text-gray-300 dark:text-gray-600 text-base pointer-events-none select-none"
                    style={{ display: block.content && block.content !== '<br>' ? 'none' : undefined }}
                >
                    Type <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">/</span> for commands, or start typing…
                </div>
            </div>
        </div>
    );
};

export default TextBlock;
