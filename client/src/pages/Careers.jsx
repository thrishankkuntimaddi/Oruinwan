import React, { useState } from 'react';
import { Briefcase, MapPin, Clock, ArrowRight, Sparkles, Users, Globe, ChevronDown } from 'lucide-react';
import PublicPageShell from '../components/layout/PublicPageShell';
import { PageHero, Block, Grid, Card } from '../components/public/PublicKit';
import BRAND from '../shared/brand';

const PERKS = [
    { icon: Globe, color: '#8ea6ff', title: 'Remote first', desc: 'Work from anywhere. We have teammates across time zones and async is a first-class citizen.' },
    { icon: Sparkles, color: '#c8a274', title: 'Use what you build', desc: `All tools, expenses and subscriptions are provided. You use ${BRAND.name} every day, and so do we.` },
    { icon: Users, color: '#5cc995', title: 'Small, high-trust team', desc: 'No bureaucracy. You’ll have real ownership and direct impact from day one.' },
    { icon: Briefcase, color: '#b59cff', title: 'Equity & benefits', desc: 'Competitive salary, meaningful equity, and health coverage for full-time roles.' },
];

const ROLES = [
    { id: 1, dept: 'Engineering', title: 'Senior Full-Stack Engineer', type: 'Full-time', location: 'Remote', desc: `Build and scale core ${BRAND.name} platform features. You’ll own entire product verticals. Strong expertise in React, Node.js and real-time systems preferred.` },
    { id: 2, dept: 'AI / ML', title: 'AI Product Engineer', type: 'Full-time', location: 'Remote', desc: `Develop and integrate ${BRAND.ai}: workspace-aware AI that reads context, generates tasks and surfaces answers. LLM API experience required.` },
    { id: 3, dept: 'Design', title: 'Product Designer', type: 'Full-time', location: 'Remote', desc: 'Own the design system and product UX end-to-end. You care as much about the space between pixels as about business outcomes.' },
    { id: 4, dept: 'Growth', title: 'Head of Growth', type: 'Full-time', location: 'Remote', desc: 'Lead product-led growth strategy, onboarding optimisation and enterprise funnel development. Data-driven and builder mindset required.' },
];

const DEPTS = ['All', ...new Set(ROLES.map(r => r.dept))];

export default function Careers() {
    const [open, setOpen] = useState(null);
    const [dept, setDept] = useState('All');
    const roles = dept === 'All' ? ROLES : ROLES.filter(r => r.dept === dept);

    return (
        <PublicPageShell title="Careers">
            <PageHero
                crumb="Careers"
                eyebrow="We’re hiring"
                icon={Briefcase}
                title={<>Help us build the <span className="orw-gloss-text">future of work.</span></>}
                lead="We’re a small, high-trust team building something ambitious. Every person here has a meaningful impact on the product and the company."
                meta={<>
                    <span><Briefcase size={13} aria-hidden="true" />{ROLES.length} open roles</span>
                    <span><Globe size={13} aria-hidden="true" />Remote worldwide</span>
                    <span><Sparkles size={13} aria-hidden="true" />Equity included</span>
                </>}
                actions={
                    <a href="#open-roles" className="orw-btn orw-btn--primary orw-btn--lg">
                        View open roles <ArrowRight size={16} aria-hidden="true" />
                    </a>
                }
            />

            <Block eyebrow={`Why ${BRAND.name}`} title="A place to do the best work of your career." slab>
                <Grid min={240}>
                    {PERKS.map(p => (
                        <Card key={p.title} icon={p.icon} color={p.color} title={p.title}><p>{p.desc}</p></Card>
                    ))}
                </Grid>
            </Block>

            <Block id="open-roles" eyebrow="Open positions" title="Find your role.">
                {DEPTS.length > 2 && (
                    <div role="group" aria-label="Filter roles by department" data-reveal
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                        {DEPTS.map(d => (
                            <button key={d} type="button" className="orw-prompt" aria-pressed={dept === d} onClick={() => setDept(d)}>
                                {d}
                            </button>
                        ))}
                    </div>
                )}

                <ul className="orw-rows" data-reveal aria-live="polite">
                    {roles.map(role => {
                        const isOpen = open === role.id;
                        const panelId = `role-${role.id}`;
                        return (
                            <li key={role.id} className="orw-row" style={{ gridTemplateColumns: 'minmax(0, 1fr)', padding: 0 }}>
                                <h3>
                                    <button type="button" aria-expanded={isOpen} aria-controls={panelId}
                                        onClick={() => setOpen(isOpen ? null : role.id)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '22px 4px', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                                        <span style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ display: 'block' }}>{role.title}</span>
                                            <span className="orw-row__meta">
                                                <span className="orw-tag orw-tag--accent">{role.dept}</span>
                                                <span className="orw-tag"><Clock size={11} aria-hidden="true" style={{ marginRight: 5 }} />{role.type}</span>
                                                <span className="orw-tag"><MapPin size={11} aria-hidden="true" style={{ marginRight: 5 }} />{role.location}</span>
                                            </span>
                                        </span>
                                        <ChevronDown size={18} aria-hidden="true"
                                            style={{ flexShrink: 0, color: 'var(--o-text-3)', transition: 'transform 200ms ease', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                                    </button>
                                </h3>
                                <div id={panelId} hidden={!isOpen} style={{ padding: '0 4px 24px' }}>
                                    <p style={{ marginTop: 0, maxWidth: 720 }}>{role.desc}</p>
                                    <a href={`mailto:careers@oruinwan.com?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
                                        className="orw-btn orw-btn--primary" style={{ marginTop: 18 }}>
                                        Apply via email <ArrowRight size={14} aria-hidden="true" />
                                    </a>
                                    <p className="orw-hint" style={{ marginTop: 10 }}>Send your CV and a short note about why you’re excited about {BRAND.name}.</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>

                <p className="orw-lead" style={{ fontSize: 14, maxWidth: 'none' }}>
                    Don’t see your role? Email <a href="mailto:careers@oruinwan.com" className="orw-link" style={{ fontSize: 'inherit' }}>careers@oruinwan.com</a>. We always read speculative applications.
                </p>
            </Block>
        </PublicPageShell>
    );
}
