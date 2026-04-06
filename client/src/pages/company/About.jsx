// About.jsx — Monolith Flow Design System
import React from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Users, Sparkles, Globe, Shield, ArrowRight, Building2 } from 'lucide-react';

const VALUES = [
    { icon: Users,    color: '#6ea8fe', title: 'People First',       desc: 'Every product decision starts with one question: does this make the people using it better at what they do?' },
    { icon: Sparkles, color: '#b8956a', title: 'AI with Purpose',    desc: 'We believe AI should augment human judgment — not replace it. Chttrix AI is a tool, not a replacement.' },
    { icon: Globe,    color: '#34d399', title: 'Radical Transparency',desc: 'We publish what we do, how we do it, and why. Internally and externally. No black boxes.' },
    { icon: Shield,   color: '#a78bfa', title: 'Security as Default', desc: 'Privacy and security aren\'t premium features. They\'re the baseline. Every user deserves them.' },
];

const TEAM = [
    { name: 'Thrishank K.',   role: 'Founder & CEO',       initial: 'TK' },
    { name: 'Engineering',    role: 'Platform & Backend',   initial: 'EN' },
    { name: 'Design',         role: 'Product Design',       initial: 'DE' },
    { name: 'AI Research',    role: 'Chttrix Intelligence', initial: 'AI' },
];

export default function About() {
    return (
        <PublicPageShell title="About">
            {/* Hero */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '80px 0 64px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '24px' }}>
                        <Building2 size={11} style={{ color: '#b8956a' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>About Chttrix</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '20px', maxWidth: '700px' }}>
                        We're building the workspace<br />teams actually want to use.
                    </h1>
                    <p style={{ fontSize: '16px', color: 'rgba(228,228,228,0.5)', lineHeight: '1.8', maxWidth: '560px' }}>
                        Chttrix started with a simple frustration: great teams were losing hours every week switching between chat, tasks, docs, and meetings. We built the platform we wished existed.
                    </p>
                </div>
            </div>

            {/* Mission */}
            <div style={{ padding: '72px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px', display: 'flex', gap: '80px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 300px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '16px' }}>Our Mission</p>
                        <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: '16px' }}>
                            Make every team feel like<br />a world-class team.
                        </h2>
                    </div>
                    <div style={{ flex: '2 1 400px' }}>
                        <p style={{ fontSize: '15px', color: 'rgba(228,228,228,0.5)', lineHeight: '1.85', marginBottom: '18px' }}>
                            We believe that how a team communicates is as important as what they're working on. The right tools don't just organize work — they create the psychological safety and clarity that let people do their best work.
                        </p>
                        <p style={{ fontSize: '15px', color: 'rgba(228,228,228,0.5)', lineHeight: '1.85' }}>
                            Chttrix is built on the conviction that enterprise-grade tools don't have to be enterprise-grade painful. Simple, fast, beautiful — and powerful enough to run a company of 5,000.
                        </p>
                    </div>
                </div>
            </div>

            {/* Values */}
            <div style={{ padding: '72px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '40px' }}>Our Values</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                        {VALUES.map(v => {
                            const Icon = v.icon;
                            return (
                                <div key={v.title} style={{ background: '#111', padding: '28px 24px' }}>
                                    <div style={{ width: '38px', height: '38px', background: `${v.color}12`, border: `1px solid ${v.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                                        <Icon size={18} style={{ color: v.color }} />
                                    </div>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#e4e4e4', marginBottom: '8px' }}>{v.title}</h3>
                                    <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.45)', lineHeight: '1.75' }}>{v.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Team */}
            <div style={{ padding: '72px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '40px' }}>The Team</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>
                        {TEAM.map(t => (
                            <div key={t.name} style={{ background: '#111', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <div style={{ width: '44px', height: '44px', background: 'rgba(184,149,106,0.12)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', fontSize: '13px', fontWeight: 700, color: '#b8956a', letterSpacing: '0.05em' }}>
                                    {t.initial}
                                </div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e4e4e4', marginBottom: '4px' }}>{t.name}</h3>
                                <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.4)' }}>{t.role}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '72px 0', textAlign: 'center' }}>
                <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 24px' }}>
                    <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.025em', marginBottom: '12px' }}>Want to join us?</h2>
                    <p style={{ fontSize: '14px', color: 'rgba(228,228,228,0.45)', marginBottom: '28px', lineHeight: '1.7' }}>We're a small team building something big. If that sounds exciting, see open roles.</p>
                    <a href="/careers" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 24px', background: '#b8956a', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, textDecoration: 'none', transition: 'opacity 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                        View Open Roles <ArrowRight size={14} />
                    </a>
                </div>
            </div>
        </PublicPageShell>
    );
}
