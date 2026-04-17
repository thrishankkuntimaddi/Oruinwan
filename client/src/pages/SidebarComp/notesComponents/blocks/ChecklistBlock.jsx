import React, { useRef } from 'react';
import { Trash2, Plus } from 'lucide-react';

const ChecklistBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const listRef = useRef(null);

    const items = (() => {
        try {
            const parsed = JSON.parse(block.content);
            return Array.isArray(parsed) ? parsed : [{ id: Date.now(), text: '', done: false }];
        } catch {
            return [{ id: Date.now(), text: block.content || '', done: false }];
        }
    })();

    const save = (newItems) => onBlockChange(block.id, JSON.stringify(newItems), block.meta);
    const toggleItem = (id) => save(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
    const updateText = (id, text) => save(items.map(it => it.id === id ? { ...it, text } : it));
    const removeItem = (id) => {
        const next = items.filter(it => it.id !== id);
        save(next.length > 0 ? next : [{ id: Date.now(), text: '', done: false }]);
    };
    const addItem = () => {
        save([...items, { id: Date.now(), text: '', done: false }]);
        setTimeout(() => {
            const inputs = listRef.current?.querySelectorAll('input[type="text"]');
            inputs?.[inputs.length - 1]?.focus();
        }, 50);
    };

    const handleKeyDown = (e, id, idx) => {
        if (e.key === 'Enter') { e.preventDefault(); addItem(); }
        if (e.key === 'Backspace' && items[idx].text === '' && items.length > 1) {
            e.preventDefault(); removeItem(id);
        }
    };

    const done = items.filter(i => i.done).length;
    const total = items.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className="group relative mb-3">
            <div style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', overflow: 'hidden' }}>

                {/* Progress header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px 8px' }}>
                    <div style={{ flex: 1, height: '3px', background: 'var(--bg-active)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: pct === 100 ? '#34d399' : '#b8956a', width: `${pct}%`, transition: 'width 500ms ease' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', color: pct === 100 ? '#34d399' : 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>
                        {done}/{total}
                    </span>
                    <button
                        onClick={() => onRemoveBlock(block.id)}
                        style={{ padding: '3px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                        className="group-hover:!opacity-100"
                        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>

                {/* Items */}
                <div style={{ padding: '0 10px 6px' }} ref={listRef}>
                    {items.map((item, idx) => (
                        <div key={item.id} className="group/item"
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 4px', transition: 'background 100ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {/* Checkbox */}
                            <button
                                onClick={() => toggleItem(item.id)}
                                style={{
                                    flexShrink: 0, width: '16px', height: '16px', border: item.done ? '2px solid #34d399' : '2px solid var(--border-accent)',
                                    background: item.done ? '#34d399' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', transition: 'all 150ms ease',
                                }}
                                onMouseEnter={e => { if (!item.done) e.currentTarget.style.borderColor = '#34d399'; }}
                                onMouseLeave={e => { if (!item.done) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            >
                                {item.done && (
                                    <svg width="8" height="6" viewBox="0 0 10 8" fill="none">
                                        <path d="M1 4L3.5 6.5L9 1" stroke="#0c0c0c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>

                            <input
                                type="text"
                                value={item.text}
                                onChange={e => updateText(item.id, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, item.id, idx)}
                                placeholder="To-do item..."
                                style={{
                                    flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px',
                                    color: item.done ? 'var(--text-muted)' : 'var(--text-primary)',
                                    textDecoration: item.done ? 'line-through' : 'none',
                                    transition: 'all 200ms ease', fontFamily: 'Inter, system-ui, sans-serif',
                                }}
                            />

                            <button
                                onClick={() => removeItem(item.id)}
                                style={{ padding: '3px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                                className="group-hover/item:!opacity-100"
                                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.15)'}
                            >
                                <Trash2 size={10} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add item footer */}
                <button
                    onClick={addItem}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', width: '100%',
                        textAlign: 'left', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)',
                        background: 'transparent', border: 'none', borderTop: '1px solid var(--border-subtle)',
                        cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#b8956a'; e.currentTarget.style.background = 'rgba(184,149,106,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <Plus size={12} /> Add item
                </button>
            </div>
        </div>
    );
};

export default ChecklistBlock;
