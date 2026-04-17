/**
 * NotificationPreferences.jsx — Monolith Flow dark theme
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, MessageCircle, GitBranch, CheckSquare, Calendar, Mail, Monitor, Save, Loader2 } from 'lucide-react';
import api from '@services/api';

// ── Design tokens ─────────────────────────────────────────────
const T = {
    bg:          'var(--bg-surface)',
    border:      'var(--border-subtle)',
    borderHover: 'var(--border-default)',
    accent:      '#b8956a',
    accentBg:    'var(--accent-dim)',
    accentBorder:'rgba(184,149,106,0.3)',
    text:        'var(--text-primary)',
    muted:       'var(--text-muted)',
    dim:         'var(--text-muted)',
    font:        'Inter, system-ui, sans-serif',
};

const PREF_ITEMS = [
    { key: 'message',     label: 'Messages & Mentions', description: 'New messages, @mentions, and DMs',                      Icon: MessageCircle, dot: '#38bdf8' },
    { key: 'threadReply', label: 'Thread Replies',      description: 'Replies in threads you follow',                         Icon: GitBranch,     dot: '#a78bfa' },
    { key: 'task',        label: 'Tasks',               description: 'Task assignments, updates, and due date reminders',     Icon: CheckSquare,   dot: '#34d399' },
    { key: 'meeting',     label: 'Meetings',            description: 'Scheduled meetings and reminders',                      Icon: Calendar,      dot: '#fb923c' },
    { key: 'email',       label: 'Email Notifications', description: 'Receive email for important events (task assigned, meeting)', Icon: Mail,     dot: T.accent  },
    { key: 'push',        label: 'Desktop Push',        description: 'Browser OS notifications when app is in background',    Icon: Monitor,       dot: '#f472b6' },
];

export default function NotificationPreferences({ workspaceId }) {
    const [prefs, setPrefs] = useState({ message: true, threadReply: true, task: true, meeting: true, email: false, push: true });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [saved, setSaved]     = useState(false);
    const [error, setError]     = useState(null);

    const fetchPrefs = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const { data } = await api.get('/api/notifications/preferences', { params: { workspaceId } });
            if (data.preferences) setPrefs(p => ({ ...p, ...data.preferences }));
        } catch (err) {
            setError('Failed to load preferences');
            console.error('[NotificationPreferences] fetch error:', err);
        } finally { setLoading(false); }
    }, [workspaceId]);

    useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

    const handleToggle = (key) => { setPrefs(p => ({ ...p, [key]: !p[key] })); setSaved(false); };

    const handleSave = async () => {
        if (!workspaceId) return;
        setSaving(true); setError(null);
        try {
            const { data } = await api.patch('/api/notifications/preferences', prefs, { params: { workspaceId } });
            if (data.preferences) setPrefs(p => ({ ...p, ...data.preferences }));
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError('Failed to save preferences');
            console.error('[NotificationPreferences] save error:', err);
        } finally { setSaving(false); }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '8px', color: T.muted, fontFamily: T.font }}>
                <Loader2 size={18} className="animate-spin" style={{ color: T.accent }} />
                <span style={{ fontSize: '13px' }}>Loading preferences...</span>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '480px', margin: '0 auto', fontFamily: T.font }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
                    <Bell size={15} style={{ color: T.accent }} />
                </div>
                <div>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: T.text, margin: 0 }}>Notification Preferences</h3>
                    <p style={{ fontSize: '11px', color: T.muted, margin: 0 }}>Choose what alerts you receive</p>
                </div>
            </div>

            {/* Preference rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {PREF_ITEMS.map(({ key, label, description, Icon, dot }) => (
                    <div
                        key={key}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`, transition: '150ms ease', cursor: 'default' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = T.borderHover}
                        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                    >
                        {/* Icon */}
                        <div style={{ flexShrink: 0, width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${dot}18`, border: `1px solid ${dot}30` }}>
                            <Icon size={13} style={{ color: dot }} />
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: T.text, margin: 0 }}>{label}</p>
                            <p style={{ fontSize: '10px', color: T.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{description}</p>
                        </div>

                        {/* Toggle */}
                        <button
                            onClick={() => handleToggle(key)}
                            aria-label={`Toggle ${label}`}
                            style={{
                                flexShrink: 0, position: 'relative', width: '36px', height: '20px',
                                borderRadius: '10px', border: 'none', cursor: 'pointer',
                                background: prefs[key] ? T.accent : 'var(--border-default)',
                                transition: 'background 200ms ease',
                                padding: 0,
                            }}
                        >
                            <span style={{
                                position: 'absolute', top: '3px',
                                left: prefs[key] ? '19px' : '3px',
                                width: '14px', height: '14px', borderRadius: '50%',
                                background: prefs[key] ? '#000' : 'var(--bg-surface)',
                                transition: 'left 200ms ease',
                                display: 'block',
                            }} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <p style={{ fontSize: '11px', color: '#f87171', marginTop: '10px', textAlign: 'center' }}>{error}</p>
            )}

            {/* Save button */}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 16px', fontSize: '12px', fontWeight: 700,
                        fontFamily: T.font, cursor: saving ? 'wait' : 'pointer',
                        background: saved ? '#22c55e' : T.accentBg,
                        border: `1px solid ${saved ? '#22c55e' : T.accentBorder}`,
                        color: saved ? '#fff' : T.accent,
                        transition: 'all 150ms ease',
                        opacity: saving ? 0.7 : 1,
                    }}
                    onMouseEnter={e => { if (!saving && !saved) e.currentTarget.style.background = 'rgba(184,149,106,0.18)'; }}
                    onMouseLeave={e => { if (!saving && !saved) e.currentTarget.style.background = T.accentBg; }}
                >
                    {saving ? (<><Loader2 size={12} className="animate-spin" /> Saving...</>) :
                     saved  ? (<><Save size={12} /> Saved!</>)               :
                              (<><Save size={12} /> Save Preferences</>)}
                </button>
            </div>
        </div>
    );
}
