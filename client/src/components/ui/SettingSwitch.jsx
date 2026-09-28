import React from 'react';

/**
 * The app's standard on/off switch (as used by Settings → Notifications / AI):
 * 36×20, accent track when on, theme tokens only.
 */
export default function SettingSwitch({ checked, onChange, disabled = false, label, id }) {
    return (
        <button
            type="button"
            role="switch"
            id={id}
            aria-checked={!!checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            style={{
                position: 'relative',
                flexShrink: 0,
                display: 'inline-flex',
                height: 20,
                width: 36,
                padding: 0,
                borderRadius: 10,
                border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`,
                backgroundColor: checked ? 'var(--accent)' : 'var(--bg-active)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                transition: 'background-color 150ms ease, border-color 150ms ease',
            }}
        >
            <span style={{
                display: 'inline-block',
                height: 14,
                width: 14,
                borderRadius: '50%',
                backgroundColor: checked ? 'var(--bg-base)' : 'var(--text-muted)',
                transform: checked ? 'translateX(17px)' : 'translateX(2px)',
                marginTop: 2,
                transition: 'transform 150ms ease, background-color 150ms ease',
            }} />
        </button>
    );
}

/** A labelled settings row with a switch on the right. */
export function SettingSwitchRow({ label, description, checked, onChange, disabled, last = false }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: '12px 0',
            borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
        }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                {description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>
                )}
            </div>
            <SettingSwitch checked={checked} onChange={onChange} disabled={disabled} label={label} />
        </div>
    );
}
