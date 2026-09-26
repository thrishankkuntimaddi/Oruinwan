import React from 'react';
import { Users, MessageSquare, Lightbulb, LifeBuoy, ArrowRight, Hash } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Grid, Card, CTABand } from '../../components/public/PublicKit';
import BRAND from '../../shared/brand';

const DISCORD_URL = 'https://discord.gg/oruinwan';

const CHANNELS = [
    { name: '#announcements', desc: `Official updates from the ${BRAND.name} team`, color: '#c8a274', locked: true },
    { name: '#general', desc: `Open discussion about ${BRAND.name} and productivity`, color: '#8ea6ff' },
    { name: '#feature-requests', desc: 'Submit and vote on product ideas', color: '#5cc995' },
    { name: '#engineering', desc: 'Technical deep-dives and API discussion', color: '#b59cff' },
    { name: '#show-and-tell', desc: `Share how you use ${BRAND.name} in your workflow`, color: '#f5c46b' },
    { name: '#newcomers', desc: `New to ${BRAND.name}? Start here`, color: '#34d399' },
];

const WAYS = [
    { icon: MessageSquare, color: '#8ea6ff', title: 'Share workflows', desc: 'Show how your team runs channels, tasks and notes, and pick up ideas from others.' },
    { icon: Lightbulb, color: '#c8a274', title: 'Request features', desc: 'Post ideas in #feature-requests and vote on the ones you want to see next.' },
    { icon: LifeBuoy, color: '#5cc995', title: 'Get help', desc: `Ask questions and get answers from people who use ${BRAND.name} every day.` },
];

const JoinButton = ({ children }) => (
    <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="orw-btn orw-btn--primary orw-btn--lg">
        {children} <ArrowRight size={16} aria-hidden="true" />
    </a>
);

export default function Community() {
    return (
        <PublicPageShell title="Community">
            <PageHero
                crumb="Community"
                eyebrow="Community"
                icon={Users}
                title={<>Join the {BRAND.name} <span className="orw-gloss-text">community.</span></>}
                lead={`Connect with other ${BRAND.name} users, share workflows, request features, and get help from people who use ${BRAND.name} every day.`}
                actions={<JoinButton>Join the Discord community</JoinButton>}
            />

            <Block eyebrow="What happens there" title="Built around the people using it.">
                <Grid min={260}>
                    {WAYS.map(w => (
                        <Card key={w.title} icon={w.icon} color={w.color} title={w.title}><p>{w.desc}</p></Card>
                    ))}
                </Grid>
            </Block>

            <Block eyebrow="Community channels" title="Find your corner." slab>
                <Grid min={300}>
                    {CHANNELS.map(ch => (
                        <Card key={ch.name} icon={Hash} color={ch.color} title={ch.name}
                            foot={ch.locked ? <span className="orw-tag orw-tag--accent">Read-only</span> : null}>
                            <p>{ch.desc}</p>
                        </Card>
                    ))}
                </Grid>
            </Block>

            <CTABand
                eyebrow="Ready to join?"
                title="Jump in and say hello."
                lead="Ask questions, share your setup, and help others."
                actions={<JoinButton>Join the community</JoinButton>}
            />
        </PublicPageShell>
    );
}
