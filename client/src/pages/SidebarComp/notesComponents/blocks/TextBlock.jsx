import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Bold, Italic, Strikethrough, Heading1, Heading2, List } from 'lucide-react';

const TextBlock = ({ block, onBlockChange, onRemoveBlock, onSlashCommand, onAddBlockAfter, registerRef }) => {
    const [showToolbar, setShowToolbar] = useState(false);
    const editorRef = useRef(null);

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

    const handleInput = () => {
        const html = editorRef.current?.innerHTML || '';
        onBlockChange(block.id, html);
    };

    const handleKeyDown = (e) => {
        const text = editorRef.current?.innerText || '';

        // Shift + Enter → create new block below (Notion-style)
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (onAddBlockAfter) {
                onAddBlockAfter(block.id);
            }
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

        // Enter (no Shift) → default browser behavior (soft newline within block)
    };

    return (
        <div className="group relative mb-1">
            {/* Format Toolbar */}
            {showToolbar && (
                <div className="flex items-center gap-0.5 mb-2 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md w-fit">
                    <button onMouseDown={e => { e.preventDefault(); execFormat('bold'); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Bold"><Bold size={14} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execFormat('italic'); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Italic"><Italic size={14} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execFormat('strikeThrough'); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Strikethrough"><Strikethrough size={14} /></button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />
                    <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h1'); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Heading 1"><Heading1 size={14} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h2'); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Heading 2"><Heading2 size={14} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execFormat('insertUnorderedList'); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Bullet List"><List size={14} /></button>
                    <button onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'p'); }} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-medium transition-colors" title="Normal text">¶</button>
                </div>
            )}

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
                    onFocus={() => setShowToolbar(true)}
                    onBlur={() => setTimeout(() => setShowToolbar(false), 150)}
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    dangerouslySetInnerHTML={{ __html: block.content }}
                    className="w-full text-gray-700 dark:text-gray-200 text-base leading-relaxed bg-transparent outline-none min-h-[1.75em] pr-8
                        [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-2 [&>h1]:text-gray-900 [&>h1]:dark:text-white
                        [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:text-gray-800 [&>h2]:dark:text-gray-100
                        [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1
                        [&>p]:mb-1"
                    style={{ caretColor: 'currentColor' }}
                />
                {!block.content && (
                    <div className="absolute top-0 left-0 text-gray-300 dark:text-gray-600 text-base pointer-events-none select-none">
                        Type <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">/</span> for commands, or start typing…
                    </div>
                )}
            </div>
        </div>
    );
};

export default TextBlock;
