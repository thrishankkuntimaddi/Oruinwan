import React from 'react';
import { Handshake, Cpu, Puzzle, Building2, ShieldCheck, XCircle, Mail, CheckCircle2 } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Split, Grid, Card, Callout, CTABand } from '../../components/public/PublicKit';
import BRAND from '../../shared/brand';

const PARTNER_EMAIL = 'chttrixchat@gmail.com';

const TYPES = [
    {
        icon: Cpu,
        color: '#8ea6ff',
        title: 'Technology Partners',
        desc: 'Extended functionality through integrations, infrastructure, or shared technical capabilities.',
        listLabel: 'Includes',
        list: ['Cloud & infrastructure', 'Security & privacy tooling', 'AI & developer platforms', 'Productivity tools'],
        means: ['Early API access', 'Secure architecture collab'],
    },
    {
        icon: Puzzle,
        color: '#b59cff',
        title: 'Integration Partners',
        desc: `Build tools that connect directly with ${BRAND.name} to improve team workflows.`,
        listLabel: 'Examples',
        list: ['Calendar tools', 'Project management', 'Developer alerts', 'Knowledge systems'],
        means: ['Webhooks & API support', 'Integration design support'],
    },
    {
        icon: Building2,
        color: '#f29bb8',
        title: 'Enterprise (Limited)',
        desc: 'For organizations supporting larger teams or complex deployments.',
        listLabel: 'Includes',
        list: ['Consulting firms', 'Deployment specialists', 'Security advisors'],
        note: 'Handled on a case-by-case basis to ensure privacy & security standards.',
    },
];

const LOOK_FOR = [
    'Respect user privacy and data ownership',
    'Align with end-to-end encryption principles',
    'Follow strong security practices',
    'Build responsibly and transparently',
    'Value long-term collaboration over short-term growth',
];

const NOT_OFFERED = [
    'Open affiliate or referral programs',
    'Marketplace listings',
    'Revenue-sharing guarantees',
    'Mass partner onboarding',
];

export default function Partners() {
    return (
        <PublicPageShell title="Partners">
            <PageHero
                crumb="Partners"
                eyebrow="Partner Program"
                icon={Handshake}
                title={<>Partner with <span className="orw-gloss-text">{BRAND.name}.</span></>}
                lead={`${BRAND.name} partners with teams and organizations that share our focus on secure, private, and modern collaboration.`}
                actions={
                    <a href={`mailto:${PARTNER_EMAIL}`} className="orw-btn orw-btn--primary orw-btn--lg">
                        <Mail size={16} aria-hidden="true" /> Get in touch
                    </a>
                }
            />

            <Block>
                <Split eyebrow="Our approach" title="Growing gradually and intentionally.">
                    <p>Our partner program is designed to grow gradually and intentionally — prioritizing quality, security, and long-term trust over scale.</p>
                    <p>{BRAND.name} is built with privacy and trust at its core. We partner carefully to ensure that integrations never compromise user security.</p>
                </Split>
            </Block>

            <Block eyebrow="Who can partner" title={`Who can partner with ${BRAND.name}`} lead="Three distinct ways to build together." slab>
                <Grid min={280}>
                    {TYPES.map(t => (
                        <Card key={t.title} icon={t.icon} color={t.color} title={t.title}
                            foot={t.means ? (
                                <div>
                                    <h4 className="orw-card__kicker" style={{ color: 'var(--o-text-3)' }}>What this means</h4>
                                    <div className="orw-row__meta" style={{ marginTop: 0 }}>
                                        {t.means.map(m => (
                                            <span key={m} className="orw-tag orw-tag--good" style={{ gap: 6 }}>
                                                <CheckCircle2 size={12} aria-hidden="true" />{m}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}>
                            <p>{t.desc}</p>
                            <h4 className="orw-card__kicker" style={{ marginTop: 22 }}>{t.listLabel}</h4>
                            <div className="orw-prose"><ul style={{ margin: 0, gap: 6 }}>{t.list.map(i => <li key={i}>{i}</li>)}</ul></div>
                            {t.note && <Callout>{t.note}</Callout>}
                        </Card>
                    ))}
                </Grid>
            </Block>

            <Block eyebrow="Fit" title="Is it a match?">
                <Grid min={320}>
                    <Card icon={ShieldCheck} color="#5cc995" title="What we look for">
                        <div className="orw-prose"><ul>{LOOK_FOR.map(i => <li key={i}>{i}</li>)}</ul></div>
                        <Callout type="warn">
                            <strong>Note:</strong> If your product relies on accessing private user data without consent, {BRAND.name} is likely not a good fit.
                        </Callout>
                    </Card>
                    <Card icon={XCircle} color="#ff8f8f" title="What we don’t offer (yet)">
                        <p>To stay transparent, {BRAND.name} currently does not offer:</p>
                        <div className="orw-prose"><ul>{NOT_OFFERED.map(i => <li key={i}>{i}</li>)}</ul></div>
                        <p className="orw-hint">* These may evolve as the platform grows.</p>
                    </Card>
                </Grid>
            </Block>

            <CTABand
                eyebrow="Becoming a partner"
                title="Tell us what you want to build."
                lead={`If you’re interested in partnering with ${BRAND.name}, reach out with your company name, partnership type, and a brief description of what you want to build. All partnership requests are reviewed manually.`}
                actions={
                    <a href={`mailto:${PARTNER_EMAIL}`} className="orw-btn orw-btn--primary orw-btn--lg">
                        <Mail size={16} aria-hidden="true" /> {PARTNER_EMAIL}
                    </a>
                }
            />
        </PublicPageShell>
    );
}
