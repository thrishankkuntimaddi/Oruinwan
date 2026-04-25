import React from 'react';
import { ChevronLeft, BookOpen, Command, Bug, Sparkles, MessageCircle } from 'lucide-react';

const ITEMS = [
    { key: 'help_academy',   label: 'Academy',            Icon: BookOpen       },
    { key: 'help_shortcuts', label: 'Keyboard Shortcuts', Icon: Command        },
    { key: 'help_bug',       label: 'Report a Bug',       Icon: Bug            },
    { key: 'help_whatsnew',  label: "What's New",         Icon: Sparkles       },
    { key: 'help_contact',   label: 'Contact Support',    Icon: MessageCircle  },
];

const HelpMenuView = ({ onBack, onNavigate }) => {
    return (
        <div style={{
            width: '256px', background: 'var(--bg-surface)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.75)',
            overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {}
            <div style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.02)',
            }}>
                <button
                    onClick={onBack}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: '150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.45)'}
                >
                    <ChevronLeft size={13} /> Back
                </button>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Help &amp; Support</span>
                <div style={{ width: '40px' }} />
            </div>

            {}
            <div style={{ padding: '6px' }}>
                {ITEMS.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => onNavigate(key)}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 12px', fontSize: '13px', fontWeight: 500,
                            color: 'var(--text-muted)', background: 'transparent',
                            border: 'none', cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms ease',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.color = '#e4e4e4';
                            e.currentTarget.querySelector('svg').style.color = '#b8956a';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(228,228,228,0.7)';
                            e.currentTarget.querySelector('svg').style.color = 'rgba(228,228,228,0.3)';
                        }}
                    >
                        <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, transition: '150ms ease' }} />
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default HelpMenuView;
