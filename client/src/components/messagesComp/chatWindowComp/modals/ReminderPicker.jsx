import React, { useState } from "react";
import { X, Bell, Clock } from "lucide-react";
import api from '@services/api';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

const PRESETS = [
    { label: "In 20 minutes", delta: 20 * 60 * 1000 },
    { label: "In 1 hour",     delta: 60 * 60 * 1000 },
    { label: "In 3 hours",    delta: 3 * 60 * 60 * 1000 },
    { label: "Tomorrow",      delta: 24 * 60 * 60 * 1000 },
    { label: "Next week",     delta: 7 * 24 * 60 * 60 * 1000 },
];

const inputStyle = {
    width: '100%', padding: '7px 10px', fontSize: '13px',
    backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
    borderRadius: '2px', outline: 'none', color: 'var(--text-primary)',
    fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 100ms ease',
    colorScheme: 'dark',
};

export default function ReminderPicker({ messageId, onClose, onSet }) {
    const [customDate, setCustomDate] = useState("");
    const [note,       setNote]       = useState("");
    const [saving,     setSaving]     = useState(false);
    const [error,      setError]      = useState(null);
    const [success,    setSuccess]    = useState(false);

    const save = async (remindAt) => {
        setSaving(true);
        setError(null);
        try {
            const res = await api.post(`/api/messages/${messageId}/remind`, {
                remindAt: new Date(remindAt).toISOString(),
                note,
            });
            setSuccess(true);
            onSet?.(res.data.reminder);
            setTimeout(onClose, 1200);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to set reminder");
        } finally {
            setSaving(false);
        }
    };

    const handlePreset = (delta) => save(Date.now() + delta);
    const handleCustom = () => { if (!customDate) return; save(customDate); };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
                fontFamily: FONT,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: '100%', maxWidth: '380px', margin: '0 16px 16px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: '4px',
                    boxShadow: '0 -16px 48px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    animation: 'fadeIn 180ms ease',
                }}
                onClick={e => e.stopPropagation()}
            >
                {}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-default)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={15} style={{ color: 'var(--accent)' }} />
                        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', fontFamily: FONT }}>
                            Set a Reminder
                        </h3>
                    </div>
                    <CloseBtn onClick={onClose} />
                </div>

                {}
                <div style={{ padding: '8px 10px' }}>
                    {PRESETS.map(preset => (
                        <PresetBtn
                            key={preset.label}
                            label={preset.label}
                            disabled={saving}
                            onClick={() => handlePreset(preset.delta)}
                        />
                    ))}
                </div>

                {}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: FONT }}>
                        Custom time
                    </label>
                    <input
                        type="datetime-local"
                        value={customDate}
                        onChange={e => setCustomDate(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                    />
                    <input
                        type="text"
                        placeholder="Optional note…"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                    />
                    <SubmitBtn onClick={handleCustom} disabled={!customDate || saving}>
                        {saving ? "Saving…" : "Set Reminder"}
                    </SubmitBtn>
                </div>

                {}
                {success && (
                    <div style={{ padding: '0 16px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--state-success)', fontWeight: 500, fontFamily: FONT }}>
                        ✅ Reminder set!
                    </div>
                )}
                {error && (
                    <div style={{ padding: '0 16px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--state-danger)', fontFamily: FONT }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}

function PresetBtn({ label, onClick, disabled }) {
    const [hov, setHov] = useState(false);
    return (
        <button
            onClick={onClick} disabled={disabled}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', textAlign: 'left', padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', color: hov ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: hov ? 'var(--bg-hover)' : 'transparent',
                border: 'none', outline: 'none', borderRadius: '2px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1, transition: '100ms ease',
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            {label}
        </button>
    );
}

function SubmitBtn({ onClick, disabled, children }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} disabled={disabled}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '9px 0', fontSize: '13px', fontWeight: 600,
                backgroundColor: disabled ? 'var(--bg-active)' : (hov ? 'var(--accent-hover)' : 'var(--accent)'),
                color: disabled ? 'var(--text-muted)' : '#0c0c0c',
                border: `1px solid ${disabled ? 'var(--border-default)' : 'var(--accent)'}`,
                borderRadius: '2px', cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none', transition: '100ms ease', opacity: disabled ? 0.5 : 1,
                fontFamily: 'Inter, system-ui, sans-serif',
            }}>
            {children}
        </button>
    );
}

function CloseBtn({ onClick }) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                padding: '5px', border: 'none', outline: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '2px', display: 'flex', transition: '100ms',
                color: hov ? 'var(--state-danger)' : 'var(--text-muted)',
            }}>
            <X size={15} />
        </button>
    );
}
