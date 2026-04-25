import React, { useState, useEffect } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Shield, Database, UserCheck, Lock, Mail, Eye, ChevronRight } from 'lucide-react';

const SECTIONS = [
    { id: 'overview',   icon: Eye,       label: 'Overview' },
    { id: 'collection', icon: Database,  label: 'Data We Collect' },
    { id: 'usage',      icon: Shield,    label: 'How We Use It' },
    { id: 'rights',     icon: UserCheck, label: 'Your Rights' },
    { id: 'security',   icon: Lock,      label: 'Security' },
    { id: 'contact',    icon: Mail,      label: 'Contact' },
];

const S = {
    h2: { fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '14px', paddingTop: '8px' },
    p:  { fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.85', marginBottom: '16px' },
    ul: { paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '18px' },
    li: { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.7' },
    dot: { width: '5px', height: '5px', background: '#b8956a', flexShrink: 0, marginTop: '9px' },
    small: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', display: 'block' },
};

function DocSection({ id, title, children }) {
    return (
        <section id={id} style={{ paddingBottom: '48px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '48px' }}>
            <h2 style={S.h2}>{title}</h2>
            {children}
        </section>
    );
}

export default function Privacy() {
    const [active, setActive] = useState('overview');

    useEffect(() => {
        const onScroll = () => {
            const pos = window.scrollY + 120;
            for (const s of SECTIONS) {
                const el = document.getElementById(s.id);
                if (el && pos >= el.offsetTop && pos < el.offsetTop + el.offsetHeight) {
                    setActive(s.id);
                }
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

    return (
        <PublicPageShell title="Privacy Policy">
            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 24px', display: 'flex', gap: '64px', alignItems: 'flex-start' }}>

                {}
                <aside style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '88px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '16px' }}>Contents</p>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {SECTIONS.map(s => {
                            const Icon = s.icon;
                            const isAct = active === s.id;
                            return (
                                <button key={s.id} onClick={() => scrollTo(s.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', background: isAct ? 'rgba(184,149,106,0.1)' : 'transparent', border: isAct ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: isAct ? '#b8956a' : 'rgba(228,228,228,0.4)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 150ms ease', width: '100%' }}>
                                    <Icon size={12} />
                                    {s.label}
                                </button>
                            );
                        })}
                    </nav>
                    <div style={{ marginTop: '32px', padding: '14px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.2)' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.7' }}>Effective date:<br /><strong style={{ color: '#b8956a' }}>January 1, 2026</strong></p>
                    </div>
                </aside>

                {}
                <main style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                            <Shield size={11} style={{ color: '#b8956a' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Privacy Policy</span>
                        </div>
                        <h1 style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '12px' }}>Your privacy matters.</h1>
                        <p style={{ ...S.p, fontSize: '16px' }}>We built Chttrix with privacy as a foundation — not an afterthought. This policy explains exactly what we collect, how we use it, and how you stay in control.</p>
                    </div>

                    <DocSection id="overview" title="Privacy Overview">
                        <p style={S.p}>Chttrix ("we," "our," or "us") is committed to protecting the personal information of our users. This Privacy Policy governs how we collect, use, share, and protect your information when you use our platform, available at chttrix.io and related subdomains.</p>
                        <p style={S.p}>By accessing or using Chttrix, you agree to the terms of this Privacy Policy. If you do not agree, please do not use the service.</p>
                        <ul style={S.ul}>
                            {['We do not sell your personal data to third parties.', 'You own your workspace content — always.', 'We collect only what is necessary to provide the service.', 'You can export or delete your data at any time.'].map(t => (
                                <li key={t} style={S.li}><span style={S.dot} />{t}</li>
                            ))}
                        </ul>
                    </DocSection>

                    <DocSection id="collection" title="Data We Collect">
                        <p style={S.p}>We collect information in three ways: information you provide directly, information generated automatically as you use the platform, and information from third-party integrations you authorize.</p>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', marginTop: '20px' }}>Information You Provide</h3>
                        <ul style={S.ul}>
                            {['Account details (name, email, password hash)', 'Profile information (job title, avatar, bio)', 'Workspace and channel content (messages, files, notes, tasks)', 'Company registration details (name, domain, billing info)'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', marginTop: '20px' }}>Automatically Collected</h3>
                        <ul style={S.ul}>
                            {['IP address and device type', 'Browser type and OS', 'Feature usage and interaction metadata', 'Error reports and performance diagnostics'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="usage" title="How We Use Your Data">
                        <p style={S.p}>We use your data exclusively to operate, improve, and support the Chttrix platform. We never use your message content to train AI models without explicit consent.</p>
                        <ul style={S.ul}>
                            {['Provide and maintain the Chttrix service', 'Authenticate your identity and manage sessions', 'Send transactional emails (invites, notifications, receipts)', 'Improve product features based on anonymized usage analytics', 'Comply with legal obligations and enforce our Terms'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <p style={S.p}>We do not send marketing emails without explicit opt-in. You can manage notification preferences from your account settings at any time.</p>
                    </DocSection>

                    <DocSection id="rights" title="Your Rights & Data Sharing">
                        <p style={S.p}>Depending on your jurisdiction, you have specific rights over your personal data. We honor all of them by default regardless of location.</p>
                        <ul style={S.ul}>
                            {['Access — request a copy of all data we hold about you', 'Correction — update inaccurate or incomplete data', 'Deletion — request erasure of your account and associated data', 'Portability — export your workspace data in machine-readable format', 'Objection — object to processing based on legitimate interests'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', marginTop: '20px' }}>When We Share Data</h3>
                        <p style={S.p}>We only share data with: (1) infrastructure providers operating under strict DPA agreements, (2) legal authorities when required by court order, and (3) parties you explicitly authorize through integrations.</p>
                    </DocSection>

                    <DocSection id="security" title="Security">
                        <p style={S.p}>Chttrix uses industry-standard security practices to protect your data at rest and in transit.</p>
                        <ul style={S.ul}>
                            {['AES-256 encryption for all data at rest', 'TLS 1.3 for all data in transit', 'Regular penetration testing and security audits', 'Role-based access controls on all internal systems', 'Automatic session expiry and anomaly detection'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <p style={S.p}>Chttrix AI processes workspace data only within your tenant's isolated compute environment. No cross-tenant data access is possible by design.</p>
                    </DocSection>

                    <DocSection id="contact" title="Contact Us">
                        <p style={S.p}>For privacy-related requests, questions, or concerns, please contact our Data Protection team:</p>
                        <div style={{ padding: '20px 24px', background: '#111', border: '1px solid rgba(255,255,255,0.07)', marginTop: '8px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '2' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Email:</strong> privacy@chttrix.io<br />
                                <strong style={{ color: 'var(--text-primary)' }}>Response time:</strong> Within 5 business days<br />
                                <strong style={{ color: 'var(--text-primary)' }}>Address:</strong> Chttrix Inc., Data Protection Office
                            </p>
                        </div>
                    </DocSection>
                </main>
            </div>
        </PublicPageShell>
    );
}
