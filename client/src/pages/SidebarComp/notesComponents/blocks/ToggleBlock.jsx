import React, { useState } from 'react';
import { Trash2, ChevronRight } from 'lucide-react';

const ToggleBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const [open, setOpen] = useState(block.meta?.open ?? false);

    const title = block.meta?.title || '';
    const body = block.content || '';

    const setTitle = (t) => onBlockChange(block.id, body, { ...block.meta, title: t, open });
    const setBody = (b) => onBlockChange(block.id, b, { ...block.meta, title, open });

    const toggle = () => {
        const next = !open;
        setOpen(next);
        onBlockChange(block.id, body, { ...block.meta, title, open: next });
    };

    return (
        <div className="group relative mb-2">
        <div style={{
            border: open ? '1px solid var(--border-default)' : '1px solid transparent',
                transition: 'border 200ms ease, box-shadow 200ms ease',
                overflow: 'hidden',
                boxShadow: open ? '0 4px 20px rgba(0,0,0,0.15)' : 'none',
            }}>
                {}
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', transition: 'background 150ms ease', background: open ? 'var(--bg-hover)' : 'transparent' }}
                    onClick={toggle}
                    onMouseEnter={e => { if (!open) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
                >
                    <div style={{ flexShrink: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: open ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)', transition: 'background 150ms ease' }}>
                        <ChevronRight
                            size={12}
                            style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: open ? '#b8956a' : 'rgba(228,228,228,0.35)' }}
                        />
                    </div>
                    <input
                        type="text"
                        value={title}
                        onChange={e => { e.stopPropagation(); setTitle(e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        placeholder="Section title..."
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}
                        className="placeholder-gray-700"
                    />
                    <button
                        onClick={e => { e.stopPropagation(); onRemoveBlock(block.id); }}
                        style={{ padding: '3px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                        className="group-hover:!opacity-100"
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                    >
                        <Trash2 size={11} />
                    </button>
                </div>

                {}
                {open && (
                    <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
                        <textarea
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            placeholder="Add content..."
                            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.65, minHeight: '50px', fontFamily: 'Inter, system-ui, sans-serif' }}
                            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ToggleBlock;
