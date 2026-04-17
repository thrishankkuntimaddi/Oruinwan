// Careers.jsx — Monolith Flow Design System
import React, { useState } from 'react';
import PublicPageShell from '../components/layout/PublicPageShell';
import { Briefcase, MapPin, Clock, ArrowRight, Sparkles, Users, Globe, ChevronDown, ChevronUp } from 'lucide-react';

const PERKS = [
    { icon: Globe,    title: 'Remote First',        desc: 'Work from anywhere. We have teammates across time zones and async is a first-class citizen.' },
    { icon: Sparkles, title: 'Use What You Build',  desc: 'All tools, expenses, and subscriptions are provided. You use Chttrix every day — so do we.' },
    { icon: Users,    title: 'Small, High-trust Team', desc: 'No bureaucracy. You\'ll have real ownership and direct impact from day one.' },
    { icon: Briefcase, title: 'Equity & Benefits',  desc: 'Competitive salary, meaningful equity, and health coverage for full-time roles.' },
];

const ROLES = [
    { id: 1, dept: 'Engineering', title: 'Senior Full-Stack Engineer', type: 'Full-time', location: 'Remote', desc: 'Build and scale core Chttrix platform features. You\'ll own entire product verticals. Strong expertise in React, Node.js, and real-time systems preferred.' },
    { id: 2, dept: 'AI / ML',     title: 'AI Product Engineer',        type: 'Full-time', location: 'Remote', desc: 'Develop and integrate Chttrix Intelligence — workspace-aware AI that reads context, generates tasks, and surfaces answers. LLM API experience required.' },
    { id: 3, dept: 'Design',      title: 'Product Designer',           type: 'Full-time', location: 'Remote', desc: 'Own the design system and product UX end-to-end. You care deeply about the space between pixels as much as business outcomes.' },
    { id: 4, dept: 'Growth',      title: 'Head of Growth',             type: 'Full-time', location: 'Remote', desc: 'Lead product-led growth strategy, onboarding optimization, and enterprise funnel development. Data-driven and builder mindset required.' },
];

const DEPT_COLORS = { Engineering: '#6ea8fe', 'AI / ML': '#b8956a', Design: '#a78bfa', Growth: '#34d399' };

export default function Careers() {
    const [open, setOpen] = useState(null);

    return (
        <PublicPageShell title="Careers">
            {/* Hero */}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '80px 0 64px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                        <Briefcase size={11} style={{ color: '#b8956a' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>We're Hiring</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(30px,5vw,54px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '18px', maxWidth: '680px' }}>
                        Help us build the future<br />of work.
                    </h1>
                    <p style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: '1.8', maxWidth: '520px', marginBottom: '32px' }}>
                        We're a small, high-trust team building something ambitious. Every person here has a meaningful impact on the product and the company.
                    </p>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                        {[`${ROLES.length} open roles`, 'Remote worldwide', 'Equity included'].map(b => (
                            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                <span style={{ width: '5px', height: '5px', background: '#b8956a', display: 'inline-block' }} />
                                {b}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Perks */}
            <div style={{ padding: '64px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '32px' }}>Why Chttrix</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                        {PERKS.map(p => {
                            const Icon = p.icon;
                            return (
                                <div key={p.title} style={{ background: '#111', padding: '24px 20px' }}>
                                    <Icon size={18} style={{ color: '#b8956a', marginBottom: '12px' }} />
                                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '7px' }}>{p.title}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.75' }}>{p.desc}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Open Roles */}
            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '64px 24px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '24px' }}>Open Positions</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bg-hover)' }}>
                    {ROLES.map(role => {
                        const isOpen = open === role.id;
                        const deptColor = DEPT_COLORS[role.dept] || '#b8956a';
                        return (
                            <div key={role.id} style={{ background: '#111' }}>
                                <button onClick={() => setOpen(isOpen ? null : role.id)}
                                    style={{ width: '100%', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                        <span style={{ padding: '2px 8px', background: `${deptColor}12`, border: `1px solid ${deptColor}25`, fontSize: '10px', fontWeight: 700, color: deptColor, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{role.dept}</span>
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{role.title}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <Clock size={11} />{role.type}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                            <MapPin size={11} />{role.location}
                                        </div>
                                        {isOpen ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                                    </div>
                                </button>
                                {isOpen && (
                                    <div style={{ padding: '0 24px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.8', marginTop: '16px', marginBottom: '20px' }}>{role.desc}</p>
                                        <a href={`mailto:careers@chttrix.io?subject=Application: ${role.title}`}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 20px', background: '#b8956a', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, textDecoration: 'none', transition: 'opacity 150ms ease' }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                            Apply via Email <ArrowRight size={13} />
                                        </a>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>Send your CV and a short message about why you're excited about Chttrix.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '28px' }}>
                    Don't see your role? Email <a href="mailto:careers@chttrix.io" style={{ color: '#b8956a', textDecoration: 'none' }}>careers@chttrix.io</a> — we always read speculative applications.
                </p>
            </div>
        </PublicPageShell>
    );
}
