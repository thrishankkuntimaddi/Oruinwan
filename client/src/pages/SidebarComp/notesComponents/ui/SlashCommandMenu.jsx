import React, { useEffect, useRef, useState } from 'react';
import {
    Type, Heading1, Heading2, Heading3, Code2, CheckSquare,
    ChevronRight, Info, Minus, Table2, Image, Video, Mic
} from 'lucide-react';

const BLOCKS = [
    { type: 'text', label: 'Text', icon: Type, desc: 'Plain paragraph text', keys: ['p', 'text'] },
    { type: 'heading', label: 'Heading 1', icon: Heading1, desc: 'Big section title', keys: ['h1', 'heading'], meta: { level: 1 } },
    { type: 'heading', label: 'Heading 2', icon: Heading2, desc: 'Medium section title', keys: ['h2'], meta: { level: 2 } },
    { type: 'heading', label: 'Heading 3', icon: Heading3, desc: 'Small section title', keys: ['h3'], meta: { level: 3 } },
    { type: 'code', label: 'Code', icon: Code2, desc: 'Code block with highlighting', keys: ['code', 'snippet'] },
    { type: 'checklist', label: 'Checklist', icon: CheckSquare, desc: 'To-do list with checkboxes', keys: ['check', 'todo', 'task'] },
    { type: 'toggle', label: 'Toggle', icon: ChevronRight, desc: 'Collapsible section', keys: ['toggle', 'collapse'] },
    { type: 'callout', label: 'Callout', icon: Info, desc: 'Highlighted info/warning', keys: ['callout', 'info', 'warning', 'note'] },
    { type: 'divider', label: 'Divider', icon: Minus, desc: 'Horizontal separator', keys: ['divider', 'hr', 'line'] },
    { type: 'table', label: 'Table', icon: Table2, desc: 'Data table with rows/cols', keys: ['table', 'grid'] },
    { type: 'image', label: 'Image', icon: Image, desc: 'Upload or embed an image', keys: ['img', 'image', 'photo'] },
    { type: 'video', label: 'Video', icon: Video, desc: 'Upload or embed a video', keys: ['video', 'youtube'] },
    { type: 'audio', label: 'Audio', icon: Mic, desc: 'Record or upload audio', keys: ['audio', 'mic', 'record'] },
];

const SlashCommandMenu = ({ position, query, onSelect, onClose }) => {
    const [activeIdx, setActiveIdx] = useState(0);
    const menuRef = useRef(null);

    const filtered = BLOCKS.filter(b =>
        !query || b.keys.some(k => k.startsWith(query.toLowerCase())) || b.label.toLowerCase().startsWith(query.toLowerCase())
    );

    useEffect(() => { setActiveIdx(0); }, [query]);

    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIdx]) onSelect(filtered[activeIdx]); }
            if (e.key === 'Escape') { onClose(); }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [activeIdx, filtered, onSelect, onClose]);

    // Scroll active item into view
    useEffect(() => {
        const el = menuRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIdx]);

    if (filtered.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-72 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
            style={{ left: position.x, top: position.y }}
        >
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    {query ? `Results for "/${query}"` : 'Add a block'}
                </p>
            </div>
            <div className="py-1">
                {filtered.map((block, idx) => {
                    const Icon = block.icon;
                    return (
                        <button
                            key={`${block.type}-${idx}`}
                            data-idx={idx}
                            onClick={() => onSelect(block)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${idx === activeIdx ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${idx === activeIdx ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                <Icon size={15} />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-sm font-medium leading-tight ${idx === activeIdx ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                                    {block.label}
                                </p>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight truncate">{block.desc}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SlashCommandMenu;
