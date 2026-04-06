// Security.jsx (company page) — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Shield, Lock, Key, Server, Cpu, FileText, Eye, CheckCircle2, Mail } from 'lucide-react';

const SECTIONS = [
    { id: 'overview',       icon: Shield,    label: 'Security Overview' },
    { id: 'encryption',     icon: Lock,      label: 'Encryption' },
    { id: 'infrastructure', icon: Server,    label: 'Infrastructure' },
    { id: 'access',         icon: Key,       label: 'Access Control' },
    { id: 'ai',             icon: Cpu,       label: 'AI Safety' },
    { id: 'compliance',     icon: FileText,  label: 'Compliance' },
    { id: 'contact',        icon: Mail,      label: 'Report a Vulnerability' },
];

const S = {
    h2: { fontSize: '22px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.02em', marginBottom: '14px', paddingTop: '8px' },
    p:  { fontSize: '14px', color: 'rgba(228,228,228,0.55)', lineHeight: '1.85', marginBottom: '16px' },
    ul: { paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '18px' },
    li: { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'rgba(228,228,228,0.55)', lineHeight: '1.7' },
    dot: { width: '5px', height: '5px', background: '#b8956a', flexShrink: 0, marginTop: '9px' },
};

const StatBox = ({ value, label }) => (
    <div style={{ padding: '20px 24px', background: '#111', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: 700, color: '#b8956a', letterSpacing: '-0.03em', marginBottom: '4px' }}>{value}</div>
        <div style={{ fontSize: '11px', color: 'rgba(228,228,228,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
);

function DocSection({ id, title, children }) {
    return (
        <section id={id} style={{ paddingBottom: '48px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '48px' }}>
            <h2 style={S.h2}>{title}</h2>
            {children}
        </section>
    );
}

export default function Security() {
    const [active, setActive] = useState('overview');

    useEffect(() => {
        const onScroll = () => {
            const pos = window.scrollY + 120;
            for (const s of SECTIONS) {
                const el = document.getElementById(s.id);
                if (el && pos >= el.offsetTop && pos < el.offsetTop + el.offsetHeight) setActive(s.id);
            }
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

    return (
        <PublicPageShell title="Security">
            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 24px', display: 'flex', gap: '64px', alignItems: 'flex-start' }}>
                {/* Sidebar */}
                <aside style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '88px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '16px' }}>Contents</p>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {SECTIONS.map(s => {
                            const Icon = s.icon; const isAct = active === s.id;
                            return (
                                <button key={s.id} onClick={() => scrollTo(s.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', background: isAct ? 'rgba(184,149,106,0.1)' : 'transparent', border: isAct ? '1px solid rgba(184,149,106,0.2)' : '1px solid transparent', color: isAct ? '#b8956a' : 'rgba(228,228,228,0.4)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 150ms ease', width: '100%' }}>
                                    <Icon size={12} />{s.label}
                                </button>
                            );
                        })}
                    </nav>
                    <div style={{ marginTop: '32px', padding: '14px', background: 'rgba(90,186,138,0.06)', border: '1px solid rgba(90,186,138,0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5aba8a' }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#5aba8a' }}>All Systems Operational</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.3)' }}>Updated in real time</p>
                    </div>
                </aside>

                {/* Content */}
                <main style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                            <Shield size={11} style={{ color: '#b8956a' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Security</span>
                        </div>
                        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.03em', marginBottom: '12px' }}>Security by design.</h1>
                        <p style={{ ...S.p, fontSize: '16px' }}>Chttrix was architected from the ground up with zero-trust principles. Every layer of the stack — from client to database — is built to protect your data.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: 'rgba(255,255,255,0.05)', marginTop: '32px', marginBottom: '8px' }}>
                            <StatBox value="AES-256" label="Encryption Standard" />
                            <StatBox value="99.9%" label="Uptime SLA" />
                            <StatBox value="< 24h" label="Security Response" />
                        </div>
                    </div>

                    <DocSection id="overview" title="Security Overview">
                        <p style={S.p}>Security isn't a feature at Chttrix — it's a foundational commitment. Every product decision, architecture choice, and third-party vendor evaluation begins with "how does this affect user security?"</p>
                        <ul style={S.ul}>
                            {['Zero-trust network architecture across all services', 'Annual third-party penetration testing', 'Continuous vulnerability scanning and dependency monitoring', 'Dedicated security incident response team', 'Bug bounty program for responsible disclosure'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="encryption" title="Encryption">
                        <p style={S.p}>All data — from user messages to uploaded files — is encrypted both at rest and in transit using modern cryptographic standards.</p>
                        <ul style={S.ul}>
                            {['AES-256-GCM encryption for all stored data', 'TLS 1.3 for all client-server communication', 'Per-workspace key isolation — data never crosses tenant boundaries', 'Encryption keys stored in a separate, hardened key management service', 'Forward secrecy enabled on all TLS connections'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="infrastructure" title="Infrastructure Security">
                        <p style={S.p}>Chttrix runs on enterprise-grade cloud infrastructure with multiple redundancy layers and geographic distribution.</p>
                        <ul style={S.ul}>
                            {['SOC 2 Type II compliant infrastructure providers', 'Automated daily backups with 30-day retention', 'Multi-region redundancy with automatic failover', 'Network-level firewall with strict ingress/egress rules', 'Immutable audit logs stored in isolated, write-once storage'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="access" title="Access Control">
                        <p style={S.p}>Access to Chttrix systems and customer data is strictly controlled on a need-to-know basis, enforced at every layer.</p>
                        <ul style={S.ul}>
                            {['Role-based access controls (RBAC) at workspace, channel, and resource level', 'Mandatory MFA for all internal engineering access', 'Zero standing access — all internal access requests are time-limited', 'Complete audit trail of all administrative actions', 'SAML/SSO support for enterprise customers'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="ai" title="AI Safety">
                        <p style={S.p}>Chttrix AI (powered by Chttrix Intelligence™) processes your workspace data with strict data isolation and privacy guarantees.</p>
                        <ul style={S.ul}>
                            {['AI processing occurs within your tenant\'s isolated compute environment', 'No cross-tenant data leakage is possible by architecture', 'Your data is never used to train shared AI models without explicit consent', 'All AI queries are logged and available for your review', 'AI features can be disabled by workspace admins at any time'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="compliance" title="Compliance & Transparency">
                        <p style={S.p}>We are committed to meeting and exceeding regulatory requirements across all jurisdictions we operate in.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            {['GDPR (EU)', 'CCPA (California)', 'SOC 2 Type II', 'ISO 27001 (In Progress)', 'DPDP Act (India)', 'HIPAA Ready'].map(badge => (
                                <div key={badge} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#111', border: '1px solid rgba(255,255,255,0.07)', fontSize: '12px', color: 'rgba(228,228,228,0.6)', fontWeight: 600 }}>
                                    <CheckCircle2 size={13} style={{ color: '#5aba8a', flexShrink: 0 }} />
                                    {badge}
                                </div>
                            ))}
                        </div>
                        <p style={S.p}>We publish a transparency report annually detailing legal requests received, data sharing, and any security incidents.</p>
                    </DocSection>

                    <DocSection id="contact" title="Report a Vulnerability">
                        <p style={S.p}>We take every security report seriously. If you discover a vulnerability in Chttrix, please disclose it responsibly.</p>
                        <div style={{ padding: '20px 24px', background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.6)', lineHeight: '2' }}>
                                <strong style={{ color: '#e4e4e4' }}>Security email:</strong> security@chttrix.io<br />
                                <strong style={{ color: '#e4e4e4' }}>PGP key:</strong> Available on request<br />
                                <strong style={{ color: '#e4e4e4' }}>Response SLA:</strong> Critical issues acknowledged within 24 hours<br />
                                <strong style={{ color: '#e4e4e4' }}>Rewards:</strong> We offer recognition and rewards for qualifying reports
                            </p>
                        </div>
                    </DocSection>
                </main>
            </div>
        </PublicPageShell>
    );
}
