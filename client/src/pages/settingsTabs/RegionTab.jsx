import React, { useState, useEffect } from 'react';
import Card from './Card';
import api from '@services/api';
import { Check, Globe2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const selectStyle = {
    padding: '6px 10px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-default)',
    borderRadius: 2,
    fontSize: 13,
    color: 'var(--text-primary)',
    outline: 'none',
    maxWidth: 280,
    width: '100%',
    transition: 'border-color 150ms ease',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const labelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: 'var(--text-muted)',
    marginBottom: 8,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

const RegionTab = ({ region, setRegion }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [detectedTimezone, setDetectedTimezone] = useState('');

    useEffect(() => {
        try { setDetectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { }
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/api/auth/me/preferences/region', region);
            setHasChanges(false);
            showToast('Region settings saved', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save settings', 'error');
        } finally { setSaving(false); }
    };

    const update = (key, value) => {
        setRegion({ ...region, [key]: value });
        setHasChanges(true);
    };

    const previewDate = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        switch (region.dateFormat) {
            case 'MM/DD/YYYY': return `${m}/${d}/${y}`;
            case 'DD/MM/YYYY': return `${d}/${m}/${y}`;
            case 'YYYY-MM-DD': return `${y}-${m}-${d}`;
            case 'DD MMM YYYY': return `${d} ${months[now.getMonth()]} ${y}`;
            default: return `${m}/${d}/${y}`;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Language" subtitle="Display language for the interface">
                <label style={labelStyle}>Display Language</label>
                <select
                    value={region.language}
                    onChange={e => update('language', e.target.value)}
                    style={selectStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                >
                    <option value="en">English (US)</option>
                    <option value="en-gb">English (UK)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="it">Italiano</option>
                    <option value="pt">Português</option>
                    <option value="ru">Русский</option>
                    <option value="zh">中文 (简体)</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                    <option value="hi">हिन्दी</option>
                </select>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, ...S.font }}>
                    Only English is fully supported. Others coming soon.
                </p>
            </Card>

            <Card title="Timezone" subtitle="Set your local timezone for accurate timestamps">
                {detectedTimezone && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12,
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-active)',
                        border: '1px solid var(--border-default)',
                        borderLeft: '2px solid var(--accent)',
                        borderRadius: 2,
                    }}>
                        <Globe2 size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', ...S.font }}>
                            Detected: <strong style={{ color: 'var(--text-primary)' }}>{detectedTimezone}</strong>
                        </span>
                    </div>
                )}
                <label style={labelStyle}>Timezone</label>
                <select
                    value={region.timezone}
                    onChange={e => update('timezone', e.target.value)}
                    style={selectStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                >
                    <option value="auto">Auto-detect ({detectedTimezone || 'Unknown'})</option>
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Europe/Berlin">Berlin (CET)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Asia/Kolkata">India (IST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Australia/Sydney">Sydney (AEDT)</option>
                </select>
            </Card>

            <Card title="Date Format" subtitle="Customize timestamps across the app">
                <label style={labelStyle}>Format</label>
                <select
                    value={region.dateFormat}
                    onChange={e => update('dateFormat', e.target.value)}
                    style={selectStyle}
                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                </select>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 12,
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-active)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 2,
                }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', ...S.font }}>Preview:</span>
                    <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                    }}>{previewDate()}</span>
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

export default RegionTab;
