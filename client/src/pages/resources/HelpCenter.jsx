// HelpCenter.jsx — Monolith Flow Design System
import React, { useState } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Search, MessageSquare, Zap, Shield, Settings, Users, BookOpen, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

const CATEGORIES = [
    { icon: Zap,           color: '#b8956a', title: 'Getting Started',  count: 8,  faqs: [
        { q: 'How do I create a workspace?', a: 'From the home page, click "Get Started" → "Register Company HQ" for a team workspace, or "Personal Account" for individual use. Follow the setup wizard to configure your organization.' },
        { q: 'How do I invite team members?', a: 'From your Admin Dashboard → Members → Invite Members. Enter email addresses or share an invite link. Members will receive an onboarding email with setup instructions.' },
        { q: 'Can I migrate from Slack or Microsoft Teams?', a: 'Chttrix currently does not have an automated migration tool, but we support bulk member import via CSV. Export your member list from your existing tool and upload it to Admin Dashboard → Members → Import.' },
    ]},
    { icon: MessageSquare, color: '#6ea8fe', title: 'Messaging',        count: 12, faqs: [
        { q: 'How do I create a private channel?', a: 'Click the + icon next to Channels in the sidebar, select "Private", and invite specific members. Private channel content is hidden from non-members, including admins by default.' },
        { q: 'Can I edit or delete sent messages?', a: 'Yes — hover any message you sent and click the ··· menu. You can edit the message (an "edited" label will appear) or delete it entirely. Deleted messages cannot be recovered.' },
        { q: 'How do threads work?', a: 'Hover any message and click "Reply in thread." The thread opens in the right panel. Thread participants receive notifications, and the thread is tracked in your Threads inbox.' },
    ]},
    { icon: Shield,        color: '#5aba8a', title: 'Security & Privacy',count: 6,  faqs: [
        { q: 'Is my data encrypted?', a: 'Yes. All data is encrypted at rest using AES-256 and in transit using TLS 1.3. We use per-workspace key isolation — your data never crosses tenant boundaries.' },
        { q: 'Can admins read my DMs?', a: 'No. Direct messages are private by design and not accessible to workspace admins unless a legal hold has been placed on the account by authorized legal process.' },
        { q: 'How do I enable two-factor authentication?', a: 'Go to Settings → Security → Two-Factor Authentication. We support authenticator apps (TOTP) and SMS-based 2FA. Enterprise plans can enforce 2FA for all workspace members.' },
    ]},
    { icon: Settings,      color: '#a78bfa', title: 'Account & Settings', count: 9, faqs: [
        { q: 'How do I change my username or email?', a: 'Settings → Profile → Edit Profile. You can update your display name, job title, bio, and avatar. Email changes require verification of your new address.' },
        { q: 'How do I reset my password?', a: 'From the login page, click "Forgot password?" and enter your email address. You\'ll receive a reset link valid for 1 hour.' },
        { q: 'How do I delete my account?', a: 'Settings → Account → Delete Account. Note: deleting your account removes all personal data from Chttrix within 30 days. Workspace content you created may remain visible to other members.' },
    ]},
];

const CategoryCard = ({ cat }) => {
    const [open, setOpen] = useState(null);
    const Icon = cat.icon;
    return (
        <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '34px', height: '34px', background: `${cat.color}12`, border: `1px solid ${cat.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: cat.color }} />
                </div>
                <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#e4e4e4' }}>{cat.title}</h3>
                    <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.3)' }}>{cat.count} articles</p>
                </div>
            </div>
            <div>
                {cat.faqs.map((faq, i) => (
                    <div key={i} style={{ borderBottom: i < cat.faqs.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <button onClick={() => setOpen(open === i ? null : i)}
                            style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: open === i ? 'rgba(255,255,255,0.03)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: open === i ? '#e4e4e4' : 'rgba(228,228,228,0.65)' }}>{faq.q}</span>
                            {open === i ? <ChevronUp size={13} style={{ color: 'rgba(228,228,228,0.4)', flexShrink: 0 }} /> : <ChevronDown size={13} style={{ color: 'rgba(228,228,228,0.3)', flexShrink: 0 }} />}
                        </button>
                        {open === i && (
                            <div style={{ padding: '0 20px 16px', fontSize: '13px', color: 'rgba(228,228,228,0.5)', lineHeight: '1.8' }}>
                                {faq.a}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function HelpCenter() {
    const [search, setSearch] = useState('');

    return (
        <PublicPageShell title="Help Center">
            {/* Hero */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '80px 0 64px', textAlign: 'center' }}>
                <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                        <BookOpen size={11} style={{ color: '#b8956a' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Help Center</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.03em', marginBottom: '12px' }}>How can we help?</h1>
                    <p style={{ fontSize: '14px', color: 'rgba(228,228,228,0.45)', marginBottom: '28px', lineHeight: '1.7' }}>Search our knowledge base or browse by topic below.</p>
                    {/* Search bar */}
                    <div style={{ position: 'relative', maxWidth: '480px', margin: '0 auto' }}>
                        <Search size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(228,228,228,0.3)', pointerEvents: 'none' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search help articles..."
                            style={{ width: '100%', padding: '12px 14px 12px 40px', background: '#141414', border: '1px solid rgba(255,255,255,0.1)', color: '#e4e4e4', fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.5)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 24px' }}>
                {/* Categories grid */}
                <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '24px' }}>Browse by Topic</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px', marginBottom: '64px' }}>
                    {CATEGORIES.map(cat => <CategoryCard key={cat.title} cat={cat} />)}
                </div>

                {/* Still need help */}
                <div style={{ padding: '36px', background: '#111', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e4e4e4', marginBottom: '6px' }}>Still need help?</h3>
                        <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.45)', lineHeight: '1.7' }}>Our support team responds to all requests within 1 business day.</p>
                    </div>
                    <a href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', background: '#b8956a', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                        Contact Support <ArrowRight size={13} />
                    </a>
                </div>
            </div>
        </PublicPageShell>
    );
}
