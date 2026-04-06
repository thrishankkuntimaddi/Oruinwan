import React, { useState } from 'react';
import Card from './Card';
import api from '@services/api';
import { Check, Info } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const Toggle = ({ label, description, checked, onChange, disabled }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid var(--border-subtle)',
    }}>
        <div style={{ paddingRight: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', ...S.font }}>{label}</div>
            {description && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5, ...S.font }}>{description}</div>
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

const PrivacyTab = ({ privacy, setPrivacy }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/me/preferences/privacy', privacy);
            setHasChanges(false);
            showToast('Privacy settings saved', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save settings', 'error');
        } finally { setSaving(false); }
    };

    const update = (key, value) => {
        setPrivacy({ ...privacy, [key]: value });
        setHasChanges(true);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Messaging Visibility" subtitle="What others can see when chatting with you">
                <Toggle label="Read Receipts" description="Let others see when you've read their messages." checked={privacy.readReceipts} onChange={v => update('readReceipts', v)} />
                <Toggle label="Typing Indicators" description="Show '…' while composing a message." checked={privacy.typingIndicators} onChange={v => update('typingIndicators', v)} />
            </Card>

            <Card title="Discovery & Data" subtitle="How others find you and how data is used">
                <Toggle label="Allow Discovery by Email" description="Others can find you via your email address." checked={privacy.allowDiscovery} onChange={v => update('allowDiscovery', v)} />
                <Toggle label="Share Anonymous Usage Data" description="Help improve Chttrix with aggregated, anonymized stats." checked={privacy.dataSharing} onChange={v => update('dataSharing', v)} />
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginTop: 16,
                    padding: 12,
                    backgroundColor: 'var(--bg-active)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 2,
                }}>
                    <Info size={13} style={{ color: 'var(--text-muted)', marginTop: 1, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, ...S.font }}>
                        We never sell personal data. Read our{' '}
                        <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >Privacy Policy</a>.
                    </p>
                </div>
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
                        {saving ? 'Saving…' : 'Save Settings'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default PrivacyTab;
