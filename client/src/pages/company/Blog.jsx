import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Sparkles, Shield, Users, Clock, ArrowRight } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Block, Grid, Card, CTABand } from '../../components/public/PublicKit';
import BRAND from '../../shared/brand';

const POSTS = [
    {
        id: 1, tag: 'Product', color: '#c8a274', icon: Sparkles,
        title: `Introducing ${BRAND.ai}: your workspace-aware teammate`,
        excerpt: `We’re opening up the beta of ${BRAND.ai}, the assistant that understands the context of your workspace, not just the message you sent.`,
        author: `${BRAND.name} Team`, date: 'Apr 1, 2026', readTime: '4 min',
    },
    {
        id: 2, tag: 'Security', color: '#5cc995', icon: Shield,
        title: 'How we built end-to-end encryption into a real-time workspace',
        excerpt: 'Per-conversation keys, X25519 key agreement and AES-GCM on your device: how we encrypt channels and DMs without slowing the conversation down.',
        author: 'Security Team', date: 'Mar 22, 2026', readTime: '7 min',
    },
    {
        id: 3, tag: 'Engineering', color: '#8ea6ff', icon: BookOpen,
        title: `The real-time architecture powering ${BRAND.name} channels`,
        excerpt: 'Inside the WebSocket infrastructure behind live messaging, including how we implemented presence, typing indicators and read receipts.',
        author: 'Platform Team', date: 'Mar 10, 2026', readTime: '10 min',
    },
    {
        id: 4, tag: 'Company', color: '#b59cff', icon: Users,
        title: `Why we built ${BRAND.name} instead of integrating with existing tools`,
        excerpt: 'The honest answer to the question we hear most: “Why not just build a Slack integration?” It has everything to do with context loss.',
        author: 'Thrishank K.', date: 'Feb 28, 2026', readTime: '5 min',
    },
];

const TAGS = ['All', 'Product', 'Engineering', 'Security', 'Company'];

const PostMeta = ({ post }) => (
    <>
        <span className="orw-tag">{post.tag}</span>
        <span className="orw-tag orw-tag--accent">Coming soon</span>
    </>
);

export default function Blog() {
    const [active, setActive] = useState('All');
    const filtered = active === 'All' ? POSTS : POSTS.filter(p => p.tag === active);
    const [featured, ...rest] = filtered;
    const FeaturedIcon = featured?.icon;

    return (
        <PublicPageShell title="Blog">
            <PageHero
                crumb="Blog"
                eyebrow={`${BRAND.name} Blog`}
                icon={BookOpen}
                title={<>Ideas, updates <span className="orw-gloss-text">&amp; engineering.</span></>}
                lead="Product announcements, behind-the-scenes engineering, and thoughts on the future of work."
            />

            <Block>
                <div role="group" aria-label="Filter posts by topic" data-reveal
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                    {TAGS.map(t => (
                        <button key={t} type="button" className="orw-prompt" aria-pressed={active === t} onClick={() => setActive(t)}>
                            {t}
                        </button>
                    ))}
                </div>

                <p className="orw-sr" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'post' : 'posts'} shown</p>

                {featured && (
                    <article className="orw-glass" data-reveal
                        style={{ display: 'flex', flexWrap: 'wrap', gap: '24px 40px', padding: 'clamp(24px, 4vw, 44px)', marginBottom: 32 }}>
                        <span className="orw-card__icon" style={{ '--c': featured.color, width: 56, height: 56, margin: 0 }}>
                            <FeaturedIcon size={24} aria-hidden="true" />
                        </span>
                        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                            <div className="orw-row__meta" style={{ marginTop: 0, alignItems: 'center' }}>
                                <span className="orw-tag orw-tag--accent">Featured</span>
                                <PostMeta post={featured} />
                            </div>
                            <h2 className="orw-h2" style={{ fontSize: 'clamp(24px, 3vw, 34px)', marginTop: 18 }}>{featured.title}</h2>
                            <p className="orw-lead" style={{ maxWidth: 680 }}>{featured.excerpt}</p>
                            <p className="orw-hint" style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px' }}>
                                <span>{featured.author}</span>
                                <span>{featured.date}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={12} aria-hidden="true" />{featured.readTime} read</span>
                            </p>
                        </div>
                    </article>
                )}

                {rest.length > 0 && (
                    <Grid min={300}>
                        {rest.map(post => (
                            <Card key={post.id} icon={post.icon} color={post.color} title={post.title}
                                foot={<><span>{post.author} · {post.date}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={12} aria-hidden="true" />{post.readTime}</span></>}>
                                <div className="orw-row__meta" style={{ order: -1, marginTop: 0, marginBottom: 14 }}>
                                    <PostMeta post={post} />
                                </div>
                                <p>{post.excerpt}</p>
                            </Card>
                        ))}
                    </Grid>
                )}

                {filtered.length === 0 && (
                    <p className="orw-lead" style={{ textAlign: 'center', margin: '48px auto' }}>No posts in this category yet.</p>
                )}
            </Block>

            <CTABand
                eyebrow="Stay in the loop"
                title="Full articles are on the way."
                lead={`In the meantime, explore what ${BRAND.name} can do, or try it with your team.`}
                actions={
                    <>
                        <Link to="/login?mode=signup" className="orw-btn orw-btn--primary orw-btn--lg">
                            Get started free <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                        <Link to="/features" className="orw-btn orw-btn--ghost orw-btn--lg">Explore features</Link>
                    </>
                }
            />
        </PublicPageShell>
    );
}
