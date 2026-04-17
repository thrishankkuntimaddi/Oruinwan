// Terms.jsx — Monolith Flow Design System
import React, { useState, useEffect } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { ScrollText, Scale, AlertOctagon, FileText, AlertTriangle, Mail } from 'lucide-react';

const SECTIONS = [
    { id: 'general',    icon: Scale,        label: 'General Terms' },
    { id: 'usage',      icon: AlertOctagon, label: 'Acceptable Use' },
    { id: 'content',    icon: FileText,     label: 'Content & IP' },
    { id: 'liability',  icon: AlertTriangle,label: 'Liability' },
    { id: 'changes',    icon: ScrollText,   label: 'Changes' },
    { id: 'contact',    icon: Mail,         label: 'Contact' },
];

const S = {
    h2: { fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '14px', paddingTop: '8px' },
    p:  { fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.85', marginBottom: '16px' },
    ul: { paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '18px' },
    li: { display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.7' },
    dot: { width: '5px', height: '5px', background: '#b8956a', flexShrink: 0, marginTop: '9px' },
};

function DocSection({ id, title, children }) {
    return (
        <section id={id} style={{ paddingBottom: '48px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '48px' }}>
            <h2 style={S.h2}>{title}</h2>
            {children}
        </section>
    );
}

export default function Terms() {
    const [active, setActive] = useState('general');

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
        <PublicPageShell title="Terms of Service">
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
                    <div style={{ marginTop: '32px', padding: '14px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.2)' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.7' }}>Last updated:<br /><strong style={{ color: '#b8956a' }}>January 1, 2026</strong></p>
                    </div>
                </aside>

                {/* Content */}
                <main style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ marginBottom: '48px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                            <Scale size={11} style={{ color: '#b8956a' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Terms of Service</span>
                        </div>
                        <h1 style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '12px' }}>Clear, fair terms.</h1>
                        <p style={{ ...S.p, fontSize: '16px' }}>These Terms govern your use of Chttrix. We've written them to be readable, not a legal maze. If you have questions, email us at legal@chttrix.io.</p>
                    </div>

                    <DocSection id="general" title="General Terms">
                        <p style={S.p}>By creating an account or using Chttrix, you agree to these Terms of Service and our Privacy Policy. These Terms form a binding agreement between you and Chttrix Inc.</p>
                        <p style={S.p}>You must be at least 16 years old to use Chttrix. If you're using Chttrix on behalf of a company, you represent that you have authority to bind that company to these Terms.</p>
                        <ul style={S.ul}>
                            {['One account per person — do not share credentials', 'Keep your account password secure and confidential', 'You are responsible for all activity under your account', 'Notify us immediately at security@chttrix.io of any unauthorized access'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="usage" title="Acceptable Use">
                        <p style={S.p}>Chttrix is a professional collaboration platform. You agree not to use it in any way that violates laws, harms others, or disrupts the platform's integrity.</p>
                        <p style={{ ...S.p, fontWeight: 600, color: 'var(--text-muted)' }}>You may not use Chttrix to:</p>
                        <ul style={S.ul}>
                            {['Transmit spam, malware, or phishing content', 'Harass, threaten, or impersonate other users', 'Scrape, reverse-engineer, or attempt to access non-public APIs', 'Use the platform for illegal activities or to facilitate fraud', 'Upload content that violates third-party intellectual property rights', 'Circumvent access controls, rate limits, or security measures'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                        <p style={S.p}>We reserve the right to suspend or terminate accounts that violate these standards without prior notice.</p>
                    </DocSection>

                    <DocSection id="content" title="Content & Intellectual Property">
                        <p style={S.p}>You retain all ownership rights to content you create on Chttrix — messages, files, notes, and tasks. You grant us a limited license to store, process, and display your content solely to provide the service.</p>
                        <p style={S.p}>Chttrix does not claim ownership of your content. We will never sell, license, or use it for advertising purposes.</p>
                        <ul style={S.ul}>
                            {['Chttrix owns the platform, UI, codebase, and brand assets', 'You own all content uploaded or created in your workspace', 'By posting, you grant us a license to serve that content to authorized members', 'Content in deleted workspaces is purged within 30 days of deletion'].map(t => <li key={t} style={S.li}><span style={S.dot} />{t}</li>)}
                        </ul>
                    </DocSection>

                    <DocSection id="liability" title="Liability & Disclaimer">
                        <p style={S.p}>Chttrix is provided "as is" and "as available." While we strive for 99.9% uptime, we cannot guarantee uninterrupted service. We are not liable for data loss caused by user error, third-party services, or force majeure events.</p>
                        <p style={S.p}>To the maximum extent permitted by law, Chttrix's total liability for any claim arising from use of the platform is limited to the greater of: (1) amounts paid by you to Chttrix in the past 12 months, or (2) USD $100.</p>
                        <p style={S.p}>We are not responsible for the content, actions, or policies of third-party integrations or external services linked from Chttrix.</p>
                    </DocSection>

                    <DocSection id="changes" title="Changes to These Terms">
                        <p style={S.p}>We may revise these Terms from time to time. When we make material changes, we will notify you by email and/or an in-app notice at least 14 days before the changes take effect.</p>
                        <p style={S.p}>Your continued use of Chttrix after the effective date constitutes acceptance of the revised Terms. If you disagree, you may terminate your account before the changes take effect.</p>
                    </DocSection>

                    <DocSection id="contact" title="Contact">
                        <p style={S.p}>For legal inquiries, disputes, or Terms-related questions:</p>
                        <div style={{ padding: '20px 24px', background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '2' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Email:</strong> legal@chttrix.io<br />
                                <strong style={{ color: 'var(--text-primary)' }}>Response time:</strong> Within 5 business days<br />
                                <strong style={{ color: 'var(--text-primary)' }}>Governing law:</strong> Laws of Delaware, USA
                            </p>
                        </div>
                    </DocSection>
                </main>
            </div>
        </PublicPageShell>
    );
}
