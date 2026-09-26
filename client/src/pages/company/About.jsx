import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Sparkles, Globe, Shield, ArrowRight, Building2 } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Split, Grid, Card, CTABand } from '../../components/public/PublicKit';
import BRAND from '../../shared/brand';

const VALUES = [
    { icon: Users, color: '#8ea6ff', title: 'People first', desc: 'Every product decision starts with one question: does this make the people using it better at what they do?' },
    { icon: Sparkles, color: '#c8a274', title: 'AI with purpose', desc: `AI should augment human judgment, not replace it. ${BRAND.ai} is a tool, not a replacement.` },
    { icon: Globe, color: '#5cc995', title: 'Radical transparency', desc: 'We publish what we do, how we do it, and why. Internally and externally. No black boxes.' },
    { icon: Shield, color: '#b59cff', title: 'Security as default', desc: 'Privacy and security aren’t premium features. They’re the baseline every user deserves.' },
];

const TEAM = [
    { name: 'Thrishank K.', role: 'Founder & CEO', initial: 'TK' },
    { name: 'Engineering', role: 'Platform & backend', initial: 'EN' },
    { name: 'Design', role: 'Product design', initial: 'DE' },
    { name: 'AI Research', role: BRAND.ai, initial: 'AI' },
];

export default function About() {
    const navigate = useNavigate();
    return (
        <PublicPageShell title="About">
            <PageHero
                crumb="About"
                eyebrow={`About ${BRAND.name}`}
                icon={Building2}
                title={<>We’re building the workspace <span className="orw-gloss-text">teams actually want to use.</span></>}
                lead={`${BRAND.name} started with a simple frustration: great teams were losing hours every week switching between chat, tasks, docs and meetings. We built the platform we wished existed.`}
            />

            <Block>
                <Split eyebrow="Our mission" title="Make every team feel like a world-class team.">
                    <p>How a team communicates matters as much as what it works on. The right tools don’t just organise work; they create the clarity and psychological safety that let people do their best work.</p>
                    <p>{BRAND.name} is built on the conviction that enterprise-grade tools don’t have to be enterprise-grade painful. Simple, fast, beautiful, and powerful enough to run a whole company.</p>
                </Split>
            </Block>

            <Block eyebrow="Our values" title="What we hold ourselves to." slab>
                <Grid min={240}>
                    {VALUES.map(v => (
                        <Card key={v.title} icon={v.icon} color={v.color} title={v.title}><p>{v.desc}</p></Card>
                    ))}
                </Grid>
            </Block>

            <Block eyebrow="The team" title="Small team. Big ambitions.">
                <Grid min={220}>
                    {TEAM.map(t => (
                        <Card key={t.name} title={t.name}>
                            <span className="orw-card__icon" style={{ order: -1, fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }} aria-hidden="true">{t.initial}</span>
                            <p>{t.role}</p>
                        </Card>
                    ))}
                </Grid>
            </Block>

            <CTABand
                eyebrow="Careers"
                title="Want to build this with us?"
                lead="We’re a small team building something big. If that sounds exciting, take a look at our open roles."
                actions={
                    <button type="button" className="orw-btn orw-btn--primary orw-btn--lg" onClick={() => navigate('/careers')}>
                        View open roles <ArrowRight size={16} />
                    </button>
                }
            />
        </PublicPageShell>
    );
}
