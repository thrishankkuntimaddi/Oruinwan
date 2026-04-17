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

    useEffect(() => {
        const el = menuRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIdx]);

    if (filtered.length === 0) return null;

    return (
        <div
            ref={menuRef}
            style={{
                position: 'fixed', zIndex: 50, left: position.x, top: position.y,
                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                boxShadow: 'var(--card-shadow)',
                width: '288px', maxHeight: '320px', overflowY: 'auto',
            }}
        >
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {query ? `Results for "/${query}"` : 'Add a block'}
                </p>
            </div>

            <div style={{ padding: '4px 0' }}>
                {filtered.map((block, idx) => {
                    const Icon = block.icon;
                    const isActive = idx === activeIdx;
                    return (
                        <button
                            key={`${block.type}-${idx}`}
                            data-idx={idx}
                            onClick={() => onSelect(block)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 12px', textAlign: 'left', background: isActive ? 'rgba(184,149,106,0.1)' : 'transparent',
                                border: 'none', cursor: 'pointer', transition: 'background 100ms ease',
                            }}
                        >
                            <div style={{
                                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                                background: isActive ? 'rgba(184,149,106,0.15)' : 'var(--bg-hover)',
                                border: `1px solid ${isActive ? 'rgba(184,149,106,0.3)' : 'var(--border-subtle)'}`,
                                color: isActive ? '#b8956a' : 'var(--text-muted)',
                            }}>
                                <Icon size={14} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.3, color: isActive ? '#b8956a' : 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                    {block.label}
                                </p>
                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {block.desc}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SlashCommandMenu;
