import React, { useState } from 'react';
import { Mail, MessageSquare, Building2, Shield, ArrowRight } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Callout } from '../../components/public/PublicKit';
import BRAND from '../../shared/brand';

const TOPICS = [
    { id: 'general', label: 'General inquiry', email: 'hello@oruinwan.com' },
    { id: 'sales', label: 'Sales & pricing', email: 'sales@oruinwan.com' },
    { id: 'support', label: 'Technical support', email: 'support@oruinwan.com' },
    { id: 'security', label: 'Security / bug report', email: 'security@oruinwan.com' },
    { id: 'press', label: 'Press & media', email: 'press@oruinwan.com' },
    { id: 'other', label: 'Other', email: 'hello@oruinwan.com' },
];

const CONTACTS = [
    { icon: Mail, color: '#8ea6ff', title: 'General', email: 'hello@oruinwan.com', desc: 'Questions, partnerships, or just a hello.' },
    { icon: MessageSquare, color: '#c8a274', title: 'Support', email: 'support@oruinwan.com', desc: 'Technical issues and account help.' },
    { icon: Shield, color: '#5cc995', title: 'Security', email: 'security@oruinwan.com', desc: 'Vulnerability reports and security concerns.' },
    { icon: Building2, color: '#b59cff', title: 'Sales', email: 'sales@oruinwan.com', desc: 'Plans and custom pricing.' },
];

const EMPTY = { name: '', email: '', topic: 'general', message: '' };

export default function Contact() {
    const [form, setForm] = useState(EMPTY);
    const [status, setStatus] = useState('idle'); // idle | sending | sent | error
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
    const topic = TOPICS.find(t => t.id === form.topic) || TOPICS[0];

    // There is no contact API: the message is handed to the visitor's email
    // app, addressed to the right team, so it is actually delivered.
    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('sending');
        try {
            const subject = `[${topic.label}] Message from ${form.name}`;
            const body = `${form.message}\n\n— ${form.name} <${form.email}>`;
            window.location.href = `mailto:${topic.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            setStatus('sent');
        } catch {
            setStatus('error');
        }
    };

    const reset = () => { setForm(EMPTY); setStatus('idle'); };

    return (
        <PublicPageShell title="Contact">
            <PageHero
                crumb="Contact"
                eyebrow="Contact us"
                icon={Mail}
                title={<>Let’s <span className="orw-gloss-text">talk.</span></>}
                lead="Whether it’s a sales question, a bug report, or just a hello, we read every message."
            />

            <Block>
                <div className="orw-split" data-reveal>
                    <div>
                        <p className="orw-eyebrow">Direct contacts</p>
                        <ul className="orw-rows">
                            {CONTACTS.map(c => {
                                const Icon = c.icon;
                                return (
                                    <li key={c.title} className="orw-row" style={{ gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 16, alignItems: 'start', padding: '18px 4px' }}>
                                        <span className="orw-card__icon" style={{ '--c': c.color, width: 36, height: 36, margin: 0 }}>
                                            <Icon size={16} aria-hidden="true" />
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <h3 style={{ fontSize: 15 }}>{c.title}</h3>
                                            <a href={`mailto:${c.email}`} className="orw-link" style={{ fontFamily: '\'JetBrains Mono\', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', overflowWrap: 'anywhere' }}>{c.email}</a>
                                            <p style={{ marginTop: 4 }}>{c.desc}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="orw-hint" style={{ marginTop: 20, fontSize: 13 }}>
                            We typically respond within one business day, and we prioritise security reports.
                        </p>
                    </div>

                    <div className="orw-glass" style={{ padding: 'clamp(22px, 4vw, 36px)', minWidth: 0 }}>
                        <h2 className="orw-h2" style={{ fontSize: 24, marginBottom: 8 }}>Send a message</h2>
                        <p className="orw-hint" style={{ marginBottom: 22 }}>
                            Sending opens your email app with the message addressed to the right {BRAND.name} team.
                        </p>

                        {status === 'sent' ? (
                            <div role="status">
                                <Callout type="good">
                                    <strong>Your email is ready to send.</strong> We’ve opened a draft to <strong>{topic.email}</strong> in your email app; hit send there and we’ll reply to <strong>{form.email}</strong>. If nothing opened, email us directly at <a href={`mailto:${topic.email}`} className="orw-link">{topic.email}</a>.
                                </Callout>
                                <button type="button" className="orw-btn orw-btn--ghost" onClick={reset}>Write another message</button>
                            </div>
                        ) : (
                            <form className="orw-form" onSubmit={handleSubmit}>
                                <div className="orw-form__row">
                                    <div className="orw-field">
                                        <label className="orw-label" htmlFor="contact-name">Name</label>
                                        <input id="contact-name" className="orw-input" value={form.name} onChange={set('name')} required autoComplete="name" placeholder="Your name" />
                                    </div>
                                    <div className="orw-field">
                                        <label className="orw-label" htmlFor="contact-email">Email</label>
                                        <input id="contact-email" type="email" className="orw-input" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@company.com" />
                                    </div>
                                </div>
                                <div className="orw-field">
                                    <label className="orw-label" htmlFor="contact-topic">Topic</label>
                                    <select id="contact-topic" className="orw-select" value={form.topic} onChange={set('topic')}>
                                        {TOPICS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="orw-field">
                                    <label className="orw-label" htmlFor="contact-message">Message</label>
                                    <textarea id="contact-message" className="orw-textarea" value={form.message} onChange={set('message')} required rows={6} placeholder="Tell us what’s on your mind…" />
                                </div>
                                {status === 'error' && (
                                    <div role="alert">
                                        <Callout type="warn">
                                            We couldn’t open your email app. Please email <a href={`mailto:${topic.email}`} className="orw-link">{topic.email}</a> directly.
                                        </Callout>
                                    </div>
                                )}
                                <button type="submit" className="orw-btn orw-btn--primary orw-btn--lg orw-btn--block" disabled={status === 'sending'}>
                                    {status === 'sending' ? 'Opening email…' : <>Send message <ArrowRight size={16} aria-hidden="true" /></>}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </Block>
        </PublicPageShell>
    );
}
