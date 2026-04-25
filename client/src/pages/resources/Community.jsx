import React, { useState } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Users, MessageSquare, Sparkles, Globe, ArrowRight, Hash, Star } from 'lucide-react';

const CHANNELS = [
    { name: '#announcements',     members: '2.4k', desc: 'Official updates from the Chttrix team',      color: '#b8956a', locked: true },
    { name: '#general',           members: '2.1k', desc: 'Open discussion about Chttrix and productivity', color: '#6ea8fe' },
    { name: '#feature-requests',  members: '890',  desc: 'Submit and vote on product ideas',            color: '#5aba8a' },
    { name: '#engineering',       members: '640',  desc: 'Technical deep-dives and API discussion',     color: '#a78bfa' },
    { name: '#show-and-tell',     members: '510',  desc: 'Share how you use Chttrix in your workflow', color: '#fbbf24' },
    { name: '#newcomers',         members: '1.2k', desc: 'New to Chttrix? Start here',                  color: '#34d399' },
];

const SPOTLIGHTS = [
    { user: 'MH', name: 'Maya H.',      role: 'CTO at Fluxio',         quote: 'We replaced four tools with Chttrix. Onboarding time dropped by 60%.', stars: 5 },
    { user: 'AR', name: 'Arjun R.',     role: 'Head of Product, Cenda', quote: 'The AI summaries alone save me about 45 minutes a day.', stars: 5 },
    { user: 'PL', name: 'Priya L.',     role: 'Engineering Lead',       quote: 'Channels + Tasks in one place solved a coordination nightmare we had.', stars: 5 },
];

const Star5 = () => (
    <div style={{ display: 'flex', gap: '2px' }}>
        {Array(5).fill(0).map((_, i) => <Star key={i} size={11} style={{ color: '#b8956a', fill: '#b8956a' }} />)}
    </div>
);

export default function Community() {
    return (
        <PublicPageShell title="Community">
            {}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '80px 0 64px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px', display: 'flex', gap: '60px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 400px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                            <Users size={11} style={{ color: '#b8956a' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Community</span>
                        </div>
                        <h1 style={{ fontSize: 'clamp(28px,4.5vw,48px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '16px' }}>
                            Join the Chttrix community.
                        </h1>
                        <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.8', marginBottom: '28px', maxWidth: '460px' }}>
                            Connect with thousands of users, share workflows, request features, and get help from people who use Chttrix every day.
                        </p>
                        <a href="https://discord.gg/chttrix" target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#b8956a', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, textDecoration: 'none', transition: 'opacity 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                            Join Discord Community <ArrowRight size={14} />
                        </a>
                    </div>
                    <div style={{ flex: '1 1 280px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--bg-hover)' }}>
                        {[
                            { value: '2,400+', label: 'Members' },
                            { value: '340+',   label: 'Discussions/mo' },
                            { value: '98%',    label: 'Questions answered' },
                            { value: '< 2h',   label: 'Avg response time' },
                        ].map(s => (
                            <div key={s.label} style={{ background: '#111', padding: '20px', textAlign: 'center' }}>
                                <p style={{ fontSize: '24px', fontWeight: 700, color: '#b8956a', letterSpacing: '-0.03em', marginBottom: '4px' }}>{s.value}</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {}
            <div style={{ padding: '64px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '24px' }}>Community Channels</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                        {CHANNELS.map(ch => (
                            <div key={ch.name} style={{ background: '#111', padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{ width: '32px', height: '32px', background: `${ch.color}12`, border: `1px solid ${ch.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Hash size={13} style={{ color: ch.color }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{ch.name}</span>
                                        {ch.locked && <span style={{ fontSize: '9px', padding: '1px 5px', background: 'rgba(184,149,106,0.12)', border: '1px solid rgba(184,149,106,0.25)', color: '#b8956a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Read-only</span>}
                                    </div>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{ch.desc}</p>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{ch.members} members</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {}
            <div style={{ padding: '64px 0' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '24px' }}>Community Spotlights</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'var(--bg-hover)', marginBottom: '40px' }}>
                        {SPOTLIGHTS.map(s => (
                            <div key={s.name} style={{ background: '#111', padding: '24px 22px' }}>
                                <Star5 />
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.8', margin: '14px 0 16px', fontStyle: 'italic' }}>"{s.quote}"</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '34px', height: '34px', background: 'rgba(184,149,106,0.15)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#b8956a' }}>{s.user}</div>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</p>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {}
                    <div style={{ padding: '32px', background: 'rgba(184,149,106,0.05)', border: '1px solid rgba(184,149,106,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>Ready to join?</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Jump in, ask questions, share your setup, and help others.</p>
                        </div>
                        <a href="https://discord.gg/chttrix" target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', background: '#b8956a', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                            Join Community <ArrowRight size={13} />
                        </a>
                    </div>
                </div>
            </div>
        </PublicPageShell>
    );
}
