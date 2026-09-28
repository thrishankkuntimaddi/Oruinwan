import React, { useState, useEffect, useCallback } from 'react';
import { Bell, MessageCircle, GitBranch, CheckSquare, Calendar, Mail, Monitor, Save, Loader2, Check, AlertCircle } from 'lucide-react';
import api from '@services/api';
import logger from '../../../utils/logger';
import SettingSwitch from '../../../components/ui/SettingSwitch';
import { WORKSPACE_PREFS_EVENT } from '../accountNotificationPrefs';

const T = {
    bg:          'var(--bg-surface)',
    border:      'var(--border-subtle)',
    borderHover: 'var(--border-default)',
    accent:      'var(--accent)',
    accentBg:    'var(--accent-dim)',
    accentBorder:'var(--border-default)',
    text:        'var(--text-primary)',
    secondary:   'var(--text-secondary)',
    muted:       'var(--text-muted)',
    dim:         'var(--text-muted)',
    danger:      'var(--state-danger)',
    font:        'var(--font)',
};

const PREF_ITEMS = [
    { key: 'message',     label: 'Messages & Mentions', description: 'New messages, @mentions, and DMs',                      Icon: MessageCircle },
    { key: 'threadReply', label: 'Thread Replies',      description: 'Replies in threads you follow',                         Icon: GitBranch },
    { key: 'task',        label: 'Tasks',               description: 'Task assignments, status changes, and due date reminders', Icon: CheckSquare },
    { key: 'meeting',     label: 'Meetings',            description: 'Scheduled meetings and reminders',                      Icon: Calendar },
    { key: 'email',       label: 'Email Notifications', description: 'Receive email for important events (task assigned, meeting)', Icon: Mail },
    { key: 'push',        label: 'Desktop Push',        description: 'Browser OS notifications when app is in background',    Icon: Monitor },
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
            setError(err?.response?.data?.message || 'Failed to load preferences');
            logger.error('[NotificationPreferences] fetch error:', err);
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
            try { window.dispatchEvent(new CustomEvent(WORKSPACE_PREFS_EVENT, { detail: { workspaceId, preferences: data.preferences } })); } catch { /* non-browser */ }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to save preferences');
            logger.error('[NotificationPreferences] save error:', err);
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

            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, border: `1px solid ${T.accentBorder}` }}>
                    <Bell size={15} style={{ color: T.accent }} />
                </div>
                <div>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: T.text, margin: 0 }}>Notification Preferences</h3>
                    <p style={{ fontSize: '11px', color: T.muted, margin: 0 }}>Choose what alerts you receive</p>
                </div>
            </div>

            {}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {PREF_ITEMS.map(({ key, label, description, Icon }) => (
                    <div
                        key={key}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: T.bg, border: `1px solid ${T.border}`, transition: '150ms ease', cursor: 'default' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = T.borderHover}
                        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}
                    >
                        {}
                        <div style={{ flexShrink: 0, width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)', border: `1px solid ${T.borderHover}` }}>
                            <Icon size={13} style={{ color: T.secondary }} />
                        </div>

                        {}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: T.text, margin: 0 }}>{label}</p>
                            <p style={{ fontSize: '11px', color: T.secondary, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{description}</p>
                        </div>

                        {}
                        <SettingSwitch checked={!!prefs[key]} onChange={() => handleToggle(key)} label={label} />
                    </div>
                ))}
            </div>

            {}
            {error && (
                <p role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: T.danger, marginTop: '10px' }}><AlertCircle size={13} /> {error}</p>
            )}

            {}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 16px', fontSize: '12px', fontWeight: 700,
                        fontFamily: T.font, cursor: saving ? 'wait' : 'pointer',
                        background: saved ? T.accentBg : 'var(--accent)',
                        border: `1px solid ${saved ? T.accentBorder : 'var(--accent)'}`,
                        color: saved ? T.accent : 'var(--bg-base)',
                        borderRadius: '2px',
                        transition: 'all 150ms ease',
                        opacity: saving ? 0.7 : 1,
                    }}
                    onMouseEnter={e => { if (!saving && !saved) e.currentTarget.style.background = 'var(--accent-hover)'; }}
                    onMouseLeave={e => { if (!saving && !saved) e.currentTarget.style.background = 'var(--accent)'; }}
                >
                    {saving ? (<><Loader2 size={12} className="animate-spin" /> Saving...</>) :
                     saved  ? (<><Check size={12} /> Saved</>)               :
                              (<><Save size={12} /> Save Preferences</>)}
                </button>
            </div>
        </div>
    );
}
