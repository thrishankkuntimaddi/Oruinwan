import React from 'react';
import { useFlag } from '../../../contexts/FeatureFlagsContext';

const TABS = [
    { key: 'members', label: 'Members', alwaysShow: true },
    { key: 'settings', label: 'Manage Channel', adminOnly: true },
    { key: 'invite', label: 'Invite People', adminOnly: true },
    { key: 'integrations', label: 'Integrations', alwaysShow: true, flag: 'integrations' },
];

export default function TabNavigation({ activeTab, onTabChange, isAdmin }) {
    const integrationsEnabled = useFlag('integrations');
    const visibleTabs = TABS
        .filter(t => t.flag !== 'integrations' || integrationsEnabled)
        .filter(t => t.alwaysShow || (t.adminOnly && isAdmin));

    return (
        <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-default)',
            padding: '0 24px',
            backgroundColor: 'var(--bg-surface)',
            flexShrink: 0,
        }}>
            {visibleTabs.map(tab => {
                const isActive = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        style={{
                            padding: '10px 12px',
                            fontSize: '13px', fontWeight: 400,
                            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                            background: 'none', border: 'none',
                            borderBottom: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                            cursor: 'pointer', whiteSpace: 'nowrap',
                            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            transition: 'color 150ms ease, border-color 150ms ease',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
