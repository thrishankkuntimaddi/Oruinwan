import React from 'react';
import { X, BookOpen, Command, Bug, Sparkles, MessageCircle, ArrowRight } from 'lucide-react';

/**
 * HelpModalsContainer — All help modal variants.
 * Pure presentational component — no state or form submission logic.
 */

/* ── Shared style tokens ── */
const inp = {
    width: '100%', padding: '9px 11px', background: 'var(--bg-input)',
    border: '1px solid var(--border-default)', borderRadius: '2px',
    fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
    fontFamily: 'var(--font)', boxSizing: 'border-box', resize: 'vertical',
};
const lbl = {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: 'var(--text-muted)', letterSpacing: '0.12em',
    textTransform: 'uppercase', marginBottom: '6px',
};
const primaryBtn = {
    width: '100%', padding: '10px', background: 'var(--bg-active)',
    border: '1px solid var(--border-accent)', borderRadius: '2px',
    fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
    cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease',
};
const modalHeader = (icon, label, sub) => (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
            {icon}
        </div>
        <div>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{label}</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{sub}</p>
        </div>
    </div>
);

const HelpModalsContainer = ({ activeModal, onClose }) => {
    if (!activeModal) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'var(--font)' }}>
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: '2px', width: '100%', maxWidth: '480px', overflow: 'hidden', position: 'relative' }}>
                {/* Close */}
                <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '2px', transition: '150ms ease', zIndex: 10 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <X size={16} />
                </button>

                {/* ── Academy ── */}
                {activeModal === 'academy' && (
                    <>
                        {modalHeader(<BookOpen size={16} />, 'Chttrix Academy', 'Master your workflow with these guides')}
                        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <a href="/chttrix-docs" target="_blank" rel="noopener noreferrer"
                                style={{ display: 'block', padding: '12px 14px', border: '1px solid var(--border-accent)', borderRadius: '2px', background: 'var(--bg-surface)', textDecoration: 'none', transition: '150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Full Documentation</span>
                                    <ArrowRight size={13} style={{ color: 'var(--accent)' }} />
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>Explore all features, settings, and guides in detail.</p>
                            </a>
                            {['Getting Started Guide', 'Advanced Search Techniques', 'Managing Notifications', 'Integrations 101'].map((guide, i) => (
                                <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--border-default)', borderRadius: '2px', background: 'var(--bg-surface)', cursor: 'pointer', transition: '150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                                >
                                    <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 3px' }}>{guide}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>Learn the basics and become a pro user in no time.</p>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Shortcuts ── */}
                {activeModal === 'shortcuts' && (
                    <>
                        {modalHeader(<Command size={16} />, 'Keyboard Shortcuts', 'Speed up your workflow')}
                        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {[
                                { label: 'Quick Search', key: 'Cmd + K' },
                                { label: 'New Message', key: 'Cmd + N' },
                                { label: 'Toggle AI', key: 'Cmd + J' },
                            ].map(({ label, key }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                                    <kbd style={{ padding: '3px 8px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{key}</kbd>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Bug Report ── */}
                {activeModal === 'bug' && (
                    <>
                        {modalHeader(<Bug size={16} />, 'Report a Bug', "Found something broken? Let us know")}
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={lbl}>What happened?</label>
                                <textarea style={{ ...inp, height: '120px', lineHeight: 1.6 }} placeholder="Describe the issue..." />
                            </div>
                            <button style={{ ...primaryBtn, borderColor: 'var(--state-danger)', color: 'var(--state-danger)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-active)'; }}
                            >Submit Report</button>
                        </div>
                    </>
                )}

                {/* ── What's New ── */}
                {activeModal === 'whatsnew' && (
                    <>
                        {modalHeader(<Sparkles size={16} />, "What's New", 'Latest updates and improvements')}
                        <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {[
                                { date: 'Nov 2025', title: 'Chttrix AI 2.0', body: 'Smarter responses, faster generation, and context-aware suggestions.' },
                                { date: 'Oct 2025', title: 'Dark Mode Beta', body: 'Easy on the eyes. Try it out in settings.' },
                            ].map(({ date, title, body }) => (
                                <div key={date} style={{ display: 'flex', gap: '14px', paddingBottom: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', marginTop: '4px' }} />
                                        <div style={{ width: '1px', flex: 1, background: 'var(--border-subtle)' }} />
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: '4px' }}>{date}</span>
                                        <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{title}</h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{body}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* ── Contact ── */}
                {activeModal === 'contact' && (
                    <>
                        {modalHeader(<MessageCircle size={16} />, 'Contact Support', "We're here to help with any questions")}
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={lbl}>Subject</label>
                                <select style={{ ...inp, resize: 'none', cursor: 'pointer' }}>
                                    <option>General Inquiry</option>
                                    <option>Billing Issue</option>
                                    <option>Technical Support</option>
                                    <option>Enterprise Sales</option>
                                </select>
                            </div>
                            <div>
                                <label style={lbl}>Message</label>
                                <textarea style={{ ...inp, height: '120px', lineHeight: 1.6 }} placeholder="How can we help you?" />
                            </div>
                            <button style={primaryBtn}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                            >Send Message</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default HelpModalsContainer;
