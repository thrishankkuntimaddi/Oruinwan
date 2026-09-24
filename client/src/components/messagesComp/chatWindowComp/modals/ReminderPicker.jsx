import React, { useState } from 'react';
import { Bell, Clock, Loader2 } from 'lucide-react';
import api from '@services/api';
import ToolbarModalShell, { fieldStyle, labelStyle, PrimaryButton, FONT } from './ToolbarModalShell';
import { resolveReminderPreset, formatReminderTime } from '../../../../utils/messageActionUtils';

const PRESETS = [
    { key: '20m', label: 'In 20 minutes' },
    { key: '1h', label: 'In 1 hour' },
    { key: '3h', label: 'In 3 hours' },
    { key: 'tomorrow', label: 'Tomorrow at 9:00' },
    { key: 'nextweek', label: 'Next week (Monday 9:00)' },
];

const toLocalInput = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Pick a reminder time for a message. POSTs /api/v2/messages/:id/reminder and
 * calls onSet(reminder, remindAt) on success.
 */
export default function ReminderPicker({ messageId, onClose, onSet }) {
    const [customDate, setCustomDate] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(null);
    const [error, setError] = useState(null);

    const save = async (date, key) => {
        if (!date || Number.isNaN(date.getTime())) { setError('Pick a valid date and time'); return; }
        if (date.getTime() <= Date.now()) { setError('Pick a time in the future'); return; }
        setSaving(key);
        setError(null);
        try {
            const res = await api.post(`/api/v2/messages/${messageId}/reminder`, {
                remindAt: date.toISOString(),
                ...(note.trim() && { note: note.trim() }),
            });
            onSet?.(res.data?.reminder, date);
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to set reminder');
        } finally {
            setSaving(null);
        }
    };

    const now = new Date();

    return (
        <ToolbarModalShell
            title="Remind me about this message"
            icon={<Bell size={14} style={{ color: 'var(--accent)' }} />}
            onClose={onClose}
            width={400}
        >
            <div style={{ padding: '8px' }}>
                {PRESETS.map(p => {
                    const at = resolveReminderPreset(p.key, now);
                    return (
                        <button
                            key={p.key}
                            type="button"
                            disabled={!!saving}
                            onClick={() => save(resolveReminderPreset(p.key, new Date()), p.key)}
                            style={{
                                width: '100%', textAlign: 'left', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px',
                                fontSize: '13px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', outline: 'none',
                                borderRadius: '2px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: FONT,
                                opacity: saving && saving !== p.key ? 0.5 : 1,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        >
                            {saving === p.key
                                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                                : <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                            <span style={{ flex: 1 }}>{p.label}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatReminderTime(at, now)}</span>
                        </button>
                    );
                })}
            </div>

            <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                    <label style={labelStyle} htmlFor="reminder-custom">Custom date &amp; time</label>
                    <input
                        id="reminder-custom"
                        type="datetime-local"
                        value={customDate}
                        min={toLocalInput(now)}
                        onChange={e => setCustomDate(e.target.value)}
                        style={fieldStyle}
                    />
                </div>
                <div>
                    <label style={labelStyle} htmlFor="reminder-note">Note (optional)</label>
                    <input
                        id="reminder-note"
                        type="text"
                        maxLength={280}
                        placeholder="What should you do?"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        style={fieldStyle}
                    />
                </div>
                {error && <div role="alert" style={{ fontSize: '12px', color: 'var(--state-danger)' }}>{error}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <PrimaryButton disabled={!customDate || !!saving} onClick={() => save(new Date(customDate), 'custom')}>
                        {saving === 'custom' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                        Set reminder
                    </PrimaryButton>
                </div>
            </div>
        </ToolbarModalShell>
    );
}
