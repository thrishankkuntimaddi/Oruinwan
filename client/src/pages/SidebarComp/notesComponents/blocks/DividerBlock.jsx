import React from 'react';
import { Trash2 } from 'lucide-react';

const STYLES = [
    { label: 'Line', value: 'line' },
    { label: '✦', value: 'dots' },
    { label: '◈', value: 'diamond' },
];

const DividerBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const label = block.content || '';
    const style = block.meta?.style || 'line';

    const cycleStyle = () => {
        const keys = STYLES.map(s => s.value);
        const next = keys[(keys.indexOf(style) + 1) % keys.length];
        onBlockChange(block.id, label, { ...block.meta, style: next });
    };

    return (
        <div className="group relative my-7">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Left line */}
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />

                {/* Center element */}
                {label ? (
                    <input
                        type="text"
                        value={label}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', minWidth: '60px', maxWidth: '180px', padding: '0 8px', fontFamily: 'monospace' }}
                        placeholder="SECTION"
                    />
                ) : (
                    <button
                        onClick={cycleStyle}
                        style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0 4px', transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Click to change style"
                    >
                        {style === 'line' ? '⋯' : style === 'dots' ? '✦' : '◈'}
                    </button>
                )}

                {/* Right line */}
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />

                <button
                    onClick={() => onRemoveBlock(block.id)}
                    style={{ position: 'absolute', right: 0, top: '-4px', padding: '6px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                    className="group-hover:!opacity-100"
                    onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Add label prompt */}
            {!label && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                    <input
                        type="text"
                        value={label}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        placeholder="Add section label..."
                        style={{ fontSize: '10px', textAlign: 'center', color: 'var(--text-muted)', background: 'transparent', border: 'none', outline: 'none', width: '160px', fontFamily: 'monospace' }}
                    />
                </div>
            )}
        </div>
    );
};

export default DividerBlock;
