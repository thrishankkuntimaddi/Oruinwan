// Brand.jsx — Monolith Flow Design System
import React, { useState } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { Palette, Type, Download, Copy, CheckCircle2 } from 'lucide-react';

const COLORS = [
    { name: 'Amber (Accent)',     hex: '#b8956a', dark: true },
    { name: 'Background Base',    hex: '#0c0c0c', dark: true },
    { name: 'Surface',            hex: '#111111', dark: true },
    { name: 'Text Primary',       hex: '#e4e4e4', dark: true },
    { name: 'Text Muted',         hex: '#404040', dark: true },
    { name: 'Success Green',      hex: '#5aba8a', dark: true },
    { name: 'Border Subtle',      hex: '#191919', dark: true },
    { name: 'Border Default',     hex: '#222222', dark: true },
];

const CopyHex = ({ hex }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(hex);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#5aba8a' : 'rgba(228,228,228,0.35)', fontFamily: 'monospace', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', padding: 0, transition: 'color 150ms ease' }}>
            {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
            {hex}
        </button>
    );
};

export default function Brand() {
    return (
        <PublicPageShell title="Brand">
            {/* Hero */}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '80px 0 56px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                        <Palette size={11} style={{ color: '#b8956a' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Brand & Media</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '12px' }}>Brand Guidelines</h1>
                    <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.75', maxWidth: '520px' }}>
                        Everything you need to represent Chttrix correctly — logos, colors, typography, and usage rules.
                    </p>
                </div>
            </div>

            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '64px 24px' }}>

                {/* Logo */}
                <div style={{ marginBottom: '64px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '24px' }}>Logo</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                        {/* Dark BG */}
                        <div style={{ background: '#111', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '36px', height: '36px', objectFit: 'cover' }} />
                                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Chttrix</span>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Dark background (preferred)</p>
                        </div>
                        {/* Light BG */}
                        <div style={{ background: '#f5f5f5', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '36px', height: '36px', objectFit: 'cover' }} />
                                <span style={{ fontSize: '20px', fontWeight: 700, color: '#0c0c0c', letterSpacing: '-0.02em' }}>Chttrix</span>
                            </div>
                            <p style={{ fontSize: '11px', color: 'rgba(12,12,12,0.4)', textAlign: 'center' }}>Light backgrounds</p>
                        </div>
                        {/* Mark only */}
                        <div style={{ background: '#111', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <img src="/chttrix-logo.jpg" alt="Chttrix mark" style={{ width: '48px', height: '48px', objectFit: 'cover' }} />
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Mark only (app icons, favicons)</p>
                        </div>
                    </div>

                    {/* Logo rules */}
                    <div style={{ marginTop: '20px', padding: '18px 20px', background: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.15)' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#b8956a', marginBottom: '8px' }}>Usage Rules</p>
                        <ul style={{ paddingLeft: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {['Do not stretch, rotate, or alter the logo proportions', 'Maintain minimum clear space equal to the height of the "C" in Chttrix', 'Do not use the logo on low-contrast backgrounds', 'Do not recreate the logo using a different font', 'For press use, always download the official assets below'].map(r => (
                                <li key={r} style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                                    <span style={{ color: '#b8956a', flexShrink: 0 }}>·</span>{r}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Colors */}
                <div style={{ marginBottom: '64px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '24px' }}>Color Palette</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                        {COLORS.map(c => (
                            <div key={c.hex} style={{ background: '#111', padding: '0' }}>
                                <div style={{ height: '80px', background: c.hex }} />
                                <div style={{ padding: '12px 14px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{c.name}</p>
                                    <CopyHex hex={c.hex} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Typography */}
                <div style={{ marginBottom: '64px' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '24px' }}>Typography</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--bg-hover)' }}>
                        {[
                            { label: 'Display', style: { fontSize: '40px', fontWeight: 700, letterSpacing: '-0.03em' }, sample: 'Workspace OS' },
                            { label: 'Heading 1', style: { fontSize: '28px', fontWeight: 700, letterSpacing: '-0.025em' }, sample: 'One workspace. Every conversation.' },
                            { label: 'Heading 2', style: { fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }, sample: 'Built for teams that move fast.' },
                            { label: 'Body',    style: { fontSize: '14px', lineHeight: '1.8', color: 'var(--text-muted)' }, sample: 'Chttrix keeps conversations, tasks, and AI in one place so your team never loses context between tools.' },
                            { label: 'Caption', style: { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }, sample: 'v1.0 · Workspace OS · © 2026 Chttrix Inc.' },
                        ].map(t => (
                            <div key={t.label} style={{ background: '#111', padding: '20px 24px', display: 'flex', gap: '20px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', width: '80px', flexShrink: 0 }}>{t.label}</span>
                                <span style={{ ...t.style, color: t.style.color || '#e4e4e4', fontFamily: 'Inter, system-ui, sans-serif' }}>{t.sample}</span>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>Primary typeface: <span style={{ color: '#b8956a', fontFamily: 'monospace' }}>Inter</span> · Monospace: <span style={{ color: '#b8956a', fontFamily: 'monospace' }}>JetBrains Mono</span></p>
                </div>

                {/* Download */}
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.7)', marginBottom: '20px' }}>Media & Press Kit</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {['Logo Pack (PNG + SVG)', 'Brand Guidelines PDF', 'Press Kit ZIP'].map(item => (
                            <button key={item} onClick={() => alert('Coming soon')}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--bg-hover)', border: '1px solid rgba(255,255,255,0.09)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e4e4e4'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(228,228,228,0.6)'; }}>
                                <Download size={13} /> {item}
                            </button>
                        ))}
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>For press inquiries, email <a href="mailto:press@chttrix.io" style={{ color: '#b8956a', textDecoration: 'none' }}>press@chttrix.io</a></p>
                </div>
            </div>
        </PublicPageShell>
    );
}
