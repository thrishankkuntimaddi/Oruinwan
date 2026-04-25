import React, { useRef, useState, useEffect } from 'react';
import { Trash2, ChevronDown } from 'lucide-react';

const LEVEL_STYLES = {
    1: { fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15 },
    2: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 },
    3: { fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25 },
    4: { fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.3 },
};

const LEVEL_PLACEHOLDERS = {
    1: 'Heading 1', 2: 'Heading 2', 3: 'Heading 3', 4: 'Heading 4',
};

const HeadingBlock = ({ block, onBlockChange, onRemoveBlock, onAddBlockAfter, registerRef }) => {
    const [showLevelPicker, setShowLevelPicker] = useState(false);
    const level = block.meta?.level || 1;
    const inputRef = useRef(null);

    useEffect(() => {
        if (registerRef) registerRef(block.id, inputRef.current);
        return () => { if (registerRef) registerRef(block.id, null); };
    }, [block.id, registerRef]);

    const setLevel = (l) => {
        onBlockChange(block.id, block.content, { ...block.meta, level: l });
        setShowLevelPicker(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            if (onAddBlockAfter) onAddBlockAfter(block.id);
        }
    };

    return (
        <div className="group relative mb-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                        onClick={() => setShowLevelPicker(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px',
                            fontWeight: 700, color: 'var(--text-muted)', background: 'transparent',
                            border: 'none', cursor: 'pointer', opacity: 0, width: '32px',
                            transition: 'all 150ms ease', fontFamily: 'monospace',
                        }}
                        className="group-hover:!opacity-100"
                        onMouseEnter={e => e.currentTarget.style.color = '#b8956a'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        H{level}<ChevronDown size={9} />
                    </button>
                    {showLevelPicker && (
                        <div style={{
                            position: 'absolute', left: 0, top: '100%', marginTop: '4px',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                            boxShadow: 'var(--card-shadow)', zIndex: 30, overflow: 'hidden', minWidth: '64px',
                        }}>
                            {[1, 2, 3, 4].map(l => (
                                <button
                                    key={l}
                                    onClick={() => setLevel(l)}
                                    style={{
                                        width: '100%', textAlign: 'left', padding: '7px 12px',
                                        fontSize: '12px', fontWeight: 700, background: l === level ? 'rgba(184,149,106,0.12)' : 'transparent',
                                        color: l === level ? '#b8956a' : 'var(--text-secondary)',
                                        border: 'none', cursor: 'pointer', fontFamily: 'monospace', transition: 'background 100ms ease',
                                    }}
                                    onMouseEnter={e => { if (l !== level) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (l !== level) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    H{l}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    value={block.content}
                    onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                    onKeyDown={handleKeyDown}
                    placeholder={LEVEL_PLACEHOLDERS[level]}
                    style={{
                        flex: 1, border: 'none', background: 'transparent', outline: 'none',
                        padding: 0, fontFamily: 'Inter, system-ui, sans-serif',
                        ...LEVEL_STYLES[level],
                    }}
                    className="placeholder-gray-700 dark:placeholder-gray-700"
                />

                <button
                    onClick={() => onRemoveBlock(block.id)}
                    style={{ padding: '4px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease', flexShrink: 0 }}
                    className="group-hover:!opacity-100"
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};

export default HeadingBlock;
