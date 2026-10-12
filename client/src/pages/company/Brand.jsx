import React, { useEffect, useRef, useState } from 'react';
import { Palette, Download, Copy, CheckCircle2 } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Grid, Callout } from '../../components/public/PublicKit';
import BrandMark from '../../shared/components/ui/BrandMark';
import BRAND from '../../shared/brand';

const COLORS = [
    { name: 'Obsidian', role: 'Page background', hex: '#08080a' },
    { name: 'Slab', role: 'Surfaces & panels', hex: '#101013' },
    { name: 'Amber', role: 'Accent', hex: '#c8a274' },
    { name: 'Amber Light', role: 'Accent highlight', hex: '#ecd6b0' },
    { name: 'Paper', role: 'Primary text', hex: '#efefef' },
    { name: 'Ash', role: 'Secondary text', hex: '#a6a6ad' },
];

const TYPE_SCALE = [
    { label: 'Display', style: { fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 750, letterSpacing: '-0.04em' }, sample: 'Workspace OS' },
    { label: 'Heading 1', style: { fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.03em' }, sample: 'One workspace. Every conversation.' },
    { label: 'Heading 2', style: { fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }, sample: 'Built for teams that move fast.' },
    { label: 'Body', style: { fontSize: 14, lineHeight: 1.8, color: 'var(--o-text-2)' }, sample: `${BRAND.name} keeps conversations, tasks and AI in one place so your team never loses context between tools.` },
    { label: 'Caption', style: { fontSize: 11.5, letterSpacing: '0.04em', color: 'var(--o-text-3)' }, sample: `v1.0 · Workspace OS · © 2026 ${BRAND.company}` },
];

const USAGE_RULES = [
    'Do not stretch, rotate, or alter the logo proportions',
    `Keep clear space around the logo equal to the height of the “O” in ${BRAND.name}`,
    'Do not use the logo on low-contrast backgrounds',
    'Do not recreate the logo using a different font',
    'For press use, always use the official assets below',
];

const LOGO_TILES = [
    { id: 'dark', bg: '#08080a', fg: '#efefef', note: 'Dark background (preferred)', wordmark: true },
    { id: 'light', bg: '#efefef', fg: '#08080a', note: 'Light backgrounds', wordmark: true },
    { id: 'mark', bg: '#101013', fg: '#a6a6ad', note: 'Mark only (app icons, favicons)', wordmark: false },
];

const PRESS_ASSETS = ['Full logo pack (PNG + SVG)', 'Brand guidelines PDF', 'Press kit ZIP'];

function Swatch({ color }) {
    const [state, setState] = useState('idle');
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(color.hex);
            setState('copied');
        } catch {
            setState('failed');
        }
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setState('idle'), 2000);
    };

    return (
        <div className="orw-card" style={{ padding: 0 }}>
            <div style={{ height: 96, background: color.hex, borderBottom: '1px solid var(--o-line)' }} aria-hidden="true" />
            <div style={{ padding: '16px 18px 18px' }}>
                <h3>{color.name}</h3>
                <p style={{ marginTop: 2 }}>{color.role}</p>
                <button type="button" className="orw-btn orw-btn--ghost" onClick={copy}
                    aria-label={`Copy ${color.name} hex ${color.hex}`}
                    style={{ marginTop: 14, height: 34, padding: '0 12px', fontFamily: '\'JetBrains Mono\', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
                    {state === 'copied' ? <CheckCircle2 size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    {color.hex}
                </button>
                <span className="orw-hint" aria-live="polite" style={{ marginLeft: 10, color: state === 'copied' ? '#8fe0b8' : undefined }}>
                    {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : ''}
                </span>
            </div>
        </div>
    );
}

export default function Brand() {
    return (
        <PublicPageShell title="Brand">
            <PageHero
                crumb="Brand"
                eyebrow="Brand & media"
                icon={Palette}
                title={<>Brand <span className="orw-gloss-text">guidelines.</span></>}
                lead={`Everything you need to represent ${BRAND.name} correctly: logos, colours, typography and usage rules.`}
            />

            <Block eyebrow="Logo" title="The mark, on any background.">
                <Grid min={260}>
                    {LOGO_TILES.map(t => (
                        <div key={t.id} className="orw-card" style={{ background: t.bg, alignItems: 'center', justifyContent: 'center', gap: 18, padding: '48px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <BrandMark size={t.wordmark ? 40 : 56} title={t.wordmark ? '' : `${BRAND.name} mark`} />
                                {t.wordmark && <span style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.03em', color: t.fg }}>{BRAND.name}</span>}
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: t.fg, opacity: 0.75, textAlign: 'center' }}>{t.note}</p>
                        </div>
                    ))}
                </Grid>
                <div data-reveal>
                    <Callout>
                        <strong>Usage rules</strong>
                        <ul style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {USAGE_RULES.map(r => <li key={r}>· {r}</li>)}
                        </ul>
                    </Callout>
                </div>
            </Block>

            <Block eyebrow="Colour palette" title="Monolith Gloss." lead="Near-black slabs, warm amber light. Click a value to copy it." slab>
                <Grid min={160}>
                    {COLORS.map(c => <Swatch key={c.hex} color={c} />)}
                </Grid>
            </Block>

            <Block eyebrow="Typography" title="Inter, set tight.">
                <ul className="orw-rows" data-reveal>
                    {TYPE_SCALE.map(t => (
                        <li key={t.label} className="orw-row" style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 8 }}>
                            <span className="orw-label" style={{ color: 'var(--o-text-3)' }}>{t.label}</span>
                            <span style={{ color: 'var(--o-text)', overflowWrap: 'anywhere', ...t.style }}>{t.sample}</span>
                        </li>
                    ))}
                </ul>
                <p className="orw-hint" style={{ marginTop: 16, fontSize: 13 }}>
                    Primary typeface: <span className="orw-code">Inter</span> · Monospace: <span className="orw-code">JetBrains Mono</span>
                </p>
            </Block>

            <Block eyebrow="Media & press kit" title="Assets for press and partners." slab>
                <div data-reveal style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <a href={`${import.meta.env.BASE_URL}icons/oruinwan-512.png`} download={`${BRAND.name.toLowerCase()}-logo-512.png`} className="orw-btn orw-btn--primary">
                        <Download size={14} aria-hidden="true" /> Logo mark (PNG, 512px)
                    </a>
                    {PRESS_ASSETS.map(item => (
                        <button key={item} type="button" className="orw-btn orw-btn--ghost" disabled>
                            <Download size={14} aria-hidden="true" /> {item}
                            <span className="orw-tag orw-tag--accent" style={{ marginLeft: 4 }}>Coming soon</span>
                        </button>
                    ))}
                </div>
                <p className="orw-lead" style={{ fontSize: 14 }}>
                    For press inquiries, email <a href="mailto:press@oruinwan.com" style={{ color: 'var(--o-accent-hi)' }}>press@oruinwan.com</a>.
                </p>
            </Block>
        </PublicPageShell>
    );
}
