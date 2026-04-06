import React from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import Card from './Card';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const THEMES = [
    {
        id: 'light',
        label: 'Light',
        description: 'Clean & bright',
        icon: Sun,
        preview: (
            <div style={{
                width: '100%',
                height: 56,
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: 2,
                display: 'flex',
                overflow: 'hidden',
            }}>
                <div style={{ width: '33%', backgroundColor: '#f3f4f6', borderRight: '1px solid #e5e7eb' }} />
                <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 1, width: '75%' }} />
                    <div style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 1, width: '50%' }} />
                    <div style={{ height: 6, backgroundColor: '#f3f4f6', borderRadius: 1, width: '65%' }} />
                </div>
            </div>
        )
    },
    {
        id: 'dark',
        label: 'Dark',
        description: 'Easy at night',
        icon: Moon,
        preview: (
            <div style={{
                width: '100%',
                height: 56,
                backgroundColor: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                borderRadius: 2,
                display: 'flex',
                overflow: 'hidden',
            }}>
                <div style={{ width: '33%', backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-default)' }} />
                <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ height: 6, backgroundColor: 'var(--bg-active)', borderRadius: 1, width: '75%' }} />
                    <div style={{ height: 6, backgroundColor: 'var(--bg-hover)', borderRadius: 1, width: '50%' }} />
                    <div style={{ height: 6, backgroundColor: 'var(--bg-hover)', borderRadius: 1, width: '65%' }} />
                </div>
            </div>
        )
    },
    {
        id: 'auto',
        label: 'System',
        description: 'Follows OS setting',
        icon: Laptop,
        preview: (
            <div style={{
                width: '100%',
                height: 56,
                borderRadius: 2,
                border: '1px solid var(--border-default)',
                display: 'flex',
                overflow: 'hidden',
                background: 'linear-gradient(90deg, #fff 50%, #0c0c0c 50%)',
            }}>
                <div style={{ width: '33%', height: '100%', borderRight: '1px solid var(--border-default)', background: 'linear-gradient(90deg, #f3f4f6 50%, #111111 50%)' }} />
                <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ height: 6, borderRadius: 1, width: '75%', background: 'linear-gradient(90deg, #e5e7eb 50%, #222222 50%)' }} />
                    <div style={{ height: 6, borderRadius: 1, width: '50%', background: 'linear-gradient(90deg, #e5e7eb 50%, #222222 50%)' }} />
                </div>
            </div>
        )
    },
];

const AppearanceTab = ({ theme, toggleTheme }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Interface Theme" subtitle="Choose your preferred color scheme">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {THEMES.map((mode) => {
                        const isActive = theme === mode.id;
                        const Icon = mode.icon;
                        return (
                            <button
                                key={mode.id}
                                onClick={() => toggleTheme(mode.id)}
                                style={{
                                    position: 'relative',
                                    padding: 12,
                                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-default)'}`,
                                    borderRadius: 2,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    backgroundColor: isActive ? 'rgba(184,149,106,0.06)' : 'var(--bg-surface)',
                                    transition: 'border-color 150ms ease, background-color 150ms ease',
                                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                                }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                            >
                                {mode.preview}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Icon
                                        size={14}
                                        style={{
                                            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                                            transition: 'color 150ms ease',
                                        }}
                                    />
                                    <div>
                                        <div style={{
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                                        }}>{mode.label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mode.description}</div>
                                    </div>
                                </div>
                                {isActive && (
                                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                                        <Check size={14} style={{ color: 'var(--accent)' }} />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>System</strong> mode follows your OS light/dark preference automatically.
                </p>
            </Card>

            <Card title="Font Size" subtitle="Adjust text density across the app">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 16, textAlign: 'center', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>A</span>
                    <input
                        type="range"
                        min="12"
                        max="18"
                        defaultValue="14"
                        style={{
                            flex: 1,
                            height: 4,
                            accentColor: 'var(--accent)',
                        }}
                        onChange={(e) => { document.documentElement.style.fontSize = `${e.target.value}px`; }}
                    />
                    <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)', width: 16, textAlign: 'center', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>A</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    Changes apply immediately but reset on refresh.
                </p>
            </Card>
        </div>
    );
};

export default AppearanceTab;
