import React from 'react';
import { Trash2, Info, AlertTriangle, CheckCircle, XCircle, Lightbulb } from 'lucide-react';

// All callout variants use dark surface with colored left bar — no light-mode bg classes
const CALLOUT_TYPES = {
    info: {
        label: 'Info',
        icon: Info,
        bar: '#3b82f6',
        iconColor: '#60a5fa',
        labelColor: '#60a5fa',
        bg: 'rgba(59,130,246,0.06)',
        border: 'rgba(59,130,246,0.2)',
    },
    warning: {
        label: 'Warning',
        icon: AlertTriangle,
        bar: '#f59e0b',
        iconColor: '#fbbf24',
        labelColor: '#fbbf24',
        bg: 'rgba(245,158,11,0.06)',
        border: 'rgba(245,158,11,0.2)',
    },
    success: {
        label: 'Success',
        icon: CheckCircle,
        bar: '#10b981',
        iconColor: '#34d399',
        labelColor: '#34d399',
        bg: 'rgba(16,185,129,0.06)',
        border: 'rgba(16,185,129,0.2)',
    },
    error: {
        label: 'Error',
        icon: XCircle,
        bar: '#ef4444',
        iconColor: '#f87171',
        labelColor: '#f87171',
        bg: 'rgba(239,68,68,0.06)',
        border: 'rgba(239,68,68,0.2)',
    },
    tip: {
        label: 'Tip',
        icon: Lightbulb,
        bar: '#8b5cf6',
        iconColor: '#a78bfa',
        labelColor: '#a78bfa',
        bg: 'rgba(139,92,246,0.06)',
        border: 'rgba(139,92,246,0.2)',
    },
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
                {/* Accent left bar */}
                <div style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '3px', background: style.bar }} />

                {/* Icon button */}
                <button
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

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px', color: style.labelColor, fontFamily: 'monospace' }}>
                        {style.label}
                    </div>
                    <textarea
                        value={block.content}
                        onChange={e => onBlockChange(block.id, e.target.value, block.meta)}
                        placeholder={`Add a ${style.label.toLowerCase()} note...`}
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '13px', lineHeight: 1.6, fontWeight: 450, color: 'var(--text-primary)', minHeight: '1.6em', fontFamily: 'Inter, system-ui, sans-serif' }}
                        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    />
                </div>

                {/* Delete */}
                <button
                    onClick={() => onRemoveBlock(block.id)}
                    style={{ alignSelf: 'flex-start', padding: '5px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0, transition: 'all 150ms ease' }}
                    className="group-hover:!opacity-100"
                    onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.2)'}
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
};

export default CalloutBlock;
