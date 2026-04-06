// Contact.jsx — Monolith Flow Design System
import React, { useState } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Mail, MessageSquare, Building2, Shield, CheckCircle2, ArrowRight } from 'lucide-react';

const TOPICS = [
    { id: 'general',   label: 'General Inquiry' },
    { id: 'sales',     label: 'Sales & Pricing' },
    { id: 'support',   label: 'Technical Support' },
    { id: 'security',  label: 'Security / Bug Report' },
    { id: 'press',     label: 'Press & Media' },
    { id: 'other',     label: 'Other' },
];

const CONTACTS = [
    { icon: Mail,         color: '#6ea8fe', title: 'General',  email: 'hello@chttrix.io',    desc: 'Questions, partnerships, or just a hello.' },
    { icon: MessageSquare,color: '#b8956a', title: 'Support',  email: 'support@chttrix.io',  desc: 'Technical issues and account help.' },
    { icon: Shield,       color: '#5aba8a', title: 'Security', email: 'security@chttrix.io', desc: 'Vulnerability reports (24h SLA).' },
    { icon: Building2,    color: '#a78bfa', title: 'Sales',    email: 'sales@chttrix.io',    desc: 'Enterprise plans and custom pricing.' },
];

const inp = { width: '100%', padding: '10px 12px', background: '#141414', border: '1px solid rgba(255,255,255,0.08)', color: '#e4e4e4', fontSize: '13px', fontFamily: 'Inter, system-ui, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease' };

export default function Contact() {
    const [form, setForm] = useState({ name: '', email: '', topic: 'general', message: '' });
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => { setLoading(false); setSent(true); }, 1200);
    };

    return (
        <PublicPageShell title="Contact">
            {/* Hero */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '80px 0 64px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                        <Mail size={11} style={{ color: '#b8956a' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Contact Us</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.03em', marginBottom: '12px' }}>Let's talk.</h1>
                    <p style={{ fontSize: '15px', color: 'rgba(228,228,228,0.5)', lineHeight: '1.75', maxWidth: '500px' }}>
                        Whether it's a sales question, a bug report, or just a hello — we read every message and respond to everything.
                    </p>
                </div>
            </div>

            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '72px 24px', display: 'flex', gap: '72px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* Left — contact cards */}
                <div style={{ flex: '1 1 300px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '20px' }}>Direct Contacts</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '32px' }}>
                        {CONTACTS.map(c => {
                            const Icon = c.icon;
                            return (
                                <div key={c.title} style={{ background: '#111', padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{ width: '34px', height: '34px', background: `${c.color}12`, border: `1px solid ${c.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Icon size={15} style={{ color: c.color }} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e4', marginBottom: '2px' }}>{c.title}</p>
                                        <a href={`mailto:${c.email}`} style={{ fontSize: '12px', color: '#b8956a', textDecoration: 'none', fontFamily: 'monospace' }}>{c.email}</a>
                                        <p style={{ fontSize: '11px', color: 'rgba(228,228,228,0.35)', marginTop: '3px' }}>{c.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.25)', lineHeight: '1.7' }}>
                        We typically respond within 1 business day. For urgent security issues, response within 24 hours is guaranteed.
                    </p>
                </div>

                {/* Right — form */}
                <div style={{ flex: '2 1 400px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '20px' }}>Send a Message</p>

                    {sent ? (
                        <div style={{ padding: '32px', background: 'rgba(90,186,138,0.06)', border: '1px solid rgba(90,186,138,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                            <CheckCircle2 size={32} style={{ color: '#5aba8a' }} />
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#e4e4e4' }}>Message sent!</h3>
                            <p style={{ fontSize: '13px', color: 'rgba(228,228,228,0.5)' }}>We'll get back to you at <strong style={{ color: '#e4e4e4' }}>{form.email}</strong> within 1 business day.</p>
                            <button onClick={() => { setSent(false); setForm({ name: '', email: '', topic: 'general', message: '' }); }}
                                style={{ marginTop: '8px', fontSize: '12px', color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                Send another message →
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(228,228,228,0.35)', display: 'block', marginBottom: '6px' }}>Name</label>
                                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Your name"
                                        style={inp}
                                        onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.5)'}
                                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(228,228,228,0.35)', display: 'block', marginBottom: '6px' }}>Email</label>
                                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="you@company.com"
                                        style={inp}
                                        onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.5)'}
                                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(228,228,228,0.35)', display: 'block', marginBottom: '6px' }}>Topic</label>
                                <select value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                                    style={{ ...inp, cursor: 'pointer' }}>
                                    {TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(228,228,228,0.35)', display: 'block', marginBottom: '6px' }}>Message</label>
                                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={6} placeholder="Tell us what's on your mind..."
                                    style={{ ...inp, resize: 'vertical', minHeight: '140px' }}
                                    onFocus={e => e.target.style.borderColor = 'rgba(184,149,106,0.5)'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                            </div>
                            <button type="submit" disabled={loading}
                                style={{ padding: '11px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1, transition: 'opacity 150ms ease' }}>
                                {loading ? 'Sending...' : <><span>Send Message</span><ArrowRight size={14} /></>}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </PublicPageShell>
    );
}
