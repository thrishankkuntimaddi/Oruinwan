import React, { useState } from 'react';
import Card from './Card';
import api from '@services/api';
import { Check } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const Toggle = ({ label, description, checked, onChange, disabled }) => {
    const [hovered, setHovered] = React.useState(false);
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
        }}>
            <div style={{ paddingRight: 24 }}>
                <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    ...S.font,
                }}>{label}</div>
                {description && (
                    <div style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        marginTop: 3,
                        lineHeight: 1.5,
                        ...S.font,
                    }}>{description}</div>
                )}
            </div>
            <button
                onClick={() => !disabled && onChange(!checked)}
                disabled={disabled}
                style={{
                    position: 'relative',
                    flexShrink: 0,
                    display: 'inline-flex',
                    height: 20,
                    width: 36,
                    borderRadius: 10,
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-default)'}`,
                    backgroundColor: checked ? 'var(--accent)' : 'var(--bg-active)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    transition: 'background-color 150ms ease, border-color 150ms ease',
                    outline: 'none',
                }}
            >
                <span style={{
                    display: 'inline-block',
                    height: 14,
                    width: 14,
                    borderRadius: '50%',
                    backgroundColor: checked ? '#0c0c0c' : 'var(--text-muted)',
                    transform: checked ? 'translateX(17px)' : 'translateX(2px)',
                    marginTop: 2,
                    transition: 'transform 150ms ease, background-color 150ms ease',
                }} />
            </button>
        </div>
    );
};

const SectionLabel = ({ children }) => (
    <p style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: 'var(--text-muted)',
        marginBottom: 4,
        marginTop: 4,
        ...S.font,
    }}>{children}</p>
);

const NotificationsTab = ({ notifications, setNotifications }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/me/preferences/notifications', notifications);
            setHasChanges(false);
            showToast('Notification preferences saved', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save preferences', 'error');
        } finally { setSaving(false); }
    };

    const update = (key, value) => {
        setNotifications({ ...notifications, [key]: value });
        setHasChanges(true);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Push Notifications" subtitle="In-app & browser alerts">
                <SectionLabel>Messages</SectionLabel>
                <Toggle label="Direct Messages" description="Alert when someone messages you directly." checked={notifications.dmPush} onChange={v => update('dmPush', v)} />
                <Toggle label="Mentions" description="Alert when you're @mentioned in a channel." checked={notifications.mentionPush} onChange={v => update('mentionPush', v)} />
                <Toggle label="Thread Replies" description="Alert when someone replies to your thread." checked={notifications.threadPush} onChange={v => update('threadPush', v)} />
            </Card>

            <Card title="Email Notifications" subtitle="Delivered to your inbox">
                <Toggle label="Security Alerts" description="Critical account security notices (recommended)." checked={notifications.securityEmails} onChange={v => update('securityEmails', v)} />
                <Toggle label="Product Updates" description="New features and improvement announcements." checked={notifications.productUpdates} onChange={v => update('productUpdates', v)} />
                <Toggle label="Marketing Emails" description="Tips, offers, and Chttrix news." checked={notifications.marketingEmails} onChange={v => update('marketingEmails', v)} />
            </Card>

            <Card title="Sounds" subtitle="Auditory feedback">
                <Toggle label="Sound Effects" description="Play notification sounds for messages." checked={notifications.soundEffects} onChange={v => update('soundEffects', v)} />
            </Card>

            {hasChanges && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 16px',
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#0c0c0c',
                            backgroundColor: 'var(--accent)',
                            border: 'none',
                            borderRadius: 2,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.5 : 1,
                            transition: 'background-color 150ms ease',
                            ...S.font,
                        }}
                        onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                        onMouseLeave={e => { if (!saving) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                    >
                        <Check size={13} />
                        {saving ? 'Saving…' : 'Save Preferences'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationsTab;
