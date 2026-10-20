import React from 'react';
import { Trash2, Info, AlertTriangle, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

// The callout colours a writer can pick: a small set built only from theme tokens, so they
// read well in light and dark. Click the icon to cycle through them.
const tone = (color) => ({
    bar: color,
    iconColor: color,
    labelColor: color,
    bg: `color-mix(in srgb, ${color} 7%, transparent)`,
    border: `color-mix(in srgb, ${color} 28%, transparent)`,
});

export const CALLOUT_TYPES = {
    info: { label: 'Info', icon: Info, ...tone('var(--text-secondary)') },
    warning: { label: 'Warning', icon: AlertTriangle, ...tone('var(--color-warning)') },
    success: { label: 'Success', icon: CheckCircle, ...tone('var(--state-success)') },
    error: { label: 'Error', icon: XCircle, ...tone('var(--state-danger)') },
    tip: { label: 'Tip', icon: Lightbulb, ...tone('var(--accent)') },
};

const CalloutBlock = ({ block, onBlockChange, onRemoveBlock }) => {
    const variant = block.meta?.variant || 'info';
    const style = CALLOUT_TYPES[variant] || CALLOUT_TYPES.info;
    const Icon = style.icon;

    const cycleVariant = () => {
        const keys = Object.keys(CALLOUT_TYPES);
        const next = keys[(keys.indexOf(variant) + 1) % keys.length];
        onBlockChange(block.id, block.content, { ...block.meta, variant: next });
    };

    return (
        <div className="group relative mb-3">
            <div style={{
                position: 'relative', display: 'flex', gap: '12px', padding: '14px 16px',
                background: style.bg, border: `1px solid ${style.border}`,
                transition: 'all 150ms ease', paddingLeft: '20px',
            }}>
                {}
                <div style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '3px', background: style.bar }} />

                {}
                <button
                    type="button"
                    aria-label={`Callout type: ${style.label}. Click to change`}
                    onClick={cycleVariant}
                    style={{
                        marginTop: '2px', flexShrink: 0, width: '28px', height: '28px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${style.bg}`, border: `1px solid ${style.border}`,
                        color: style.iconColor, cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                    title={`Type: ${style.label} — click to change`}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <Icon size={14} strokeWidth={2} />
                </button>

                {}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px', color: style.labelColor, fontFamily: 'var(--font)' }}>
                        {style.label}
                    </div>
                    <textarea
                        value={block.content}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        rows={Math.max(1, (block.content || '').split('\n').length)}
                        placeholder={`Write a ${style.label.toLowerCase()} note`}
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '13px', lineHeight: 1.6, fontWeight: 450, color: 'var(--text-primary)', minHeight: '1.6em', fontFamily: 'var(--font)' }}
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                </div>

                {}
                <button type="button" className="gl-icon-btn gl-x-danger group-hover:!opacity-100"
                    style={{ alignSelf: 'flex-start', opacity: 0 }}
                    onClick={() => onRemoveBlock(block.id)} aria-label="Remove callout" title="Remove callout">
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    );
};

export default CalloutBlock;
