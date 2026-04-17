// Blog.jsx — Monolith Flow Design System
import React, { useState } from 'react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { BookOpen, Tag, Clock, ArrowRight, Sparkles, Shield, Users } from 'lucide-react';

const POSTS = [
    {
        id: 1, tag: 'Product', tagColor: '#b8956a',
        title: 'Introducing Chttrix AI: Your workspace-aware teammate',
        excerpt: 'Today we\'re announcing the public beta of Chttrix Intelligence — the AI layer that understands your entire workspace context, not just the message you sent.',
        author: 'Chttrix Team', date: 'Apr 1, 2026', readTime: '4 min', featured: true,
        icon: Sparkles,
    },
    {
        id: 2, tag: 'Security', tagColor: '#5aba8a',
        title: 'How we built end-to-end encryption without sacrificing search',
        excerpt: 'Building E2E encryption for a searchable, AI-powered workspace is a hard problem. Here\'s how we solved it without compromising on either.',
        author: 'Security Team', date: 'Mar 22, 2026', readTime: '7 min', featured: false,
        icon: Shield,
    },
    {
        id: 3, tag: 'Engineering', tagColor: '#6ea8fe',
        title: 'The real-time architecture powering Chttrix channels',
        excerpt: 'Inside the WebSocket infrastructure that handles sub-50ms message delivery at scale — including how we implemented presence, typing indicators, and read receipts.',
        author: 'Platform Team', date: 'Mar 10, 2026', readTime: '10 min', featured: false,
        icon: BookOpen,
    },
    {
        id: 4, tag: 'Company', tagColor: '#a78bfa',
        title: 'Why we built Chttrix instead of integrating with existing tools',
        excerpt: 'The honest answer to the most common question we get: "Why not just build a Slack integration?" The answer has everything to do with context loss.',
        author: 'Thrishank K.', date: 'Feb 28, 2026', readTime: '5 min', featured: false,
        icon: Users,
    },
];

const TAGS = ['All', 'Product', 'Engineering', 'Security', 'Company'];

export default function Blog() {
    const [active, setActive] = useState('All');
    const filtered = active === 'All' ? POSTS : POSTS.filter(p => p.tag === active);
    const [featured, ...rest] = filtered;

    return (
        <PublicPageShell title="Blog">
            {/* Hero */}
            <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: '72px 0 56px' }}>
                <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 24px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '20px' }}>
                        <BookOpen size={11} style={{ color: '#b8956a' }} />
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Chttrix Blog</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '12px' }}>Ideas, updates, & engineering.</h1>
                    <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.75', maxWidth: '520px', marginBottom: '28px' }}>
                        Product announcements, behind-the-scenes engineering, and thoughts on the future of work.
                    </p>
                    {/* Tag filters */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {TAGS.map(t => (
                            <button key={t} onClick={() => setActive(t)}
                                style={{ padding: '5px 14px', background: active === t ? '#b8956a' : 'rgba(255,255,255,0.04)', border: `1px solid ${active === t ? '#b8956a' : 'rgba(255,255,255,0.09)'}`, color: active === t ? '#0c0c0c' : 'rgba(228,228,228,0.5)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms ease' }}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '56px 24px' }}>
                {/* Featured post */}
                {featured && (
                    <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.07)', padding: '36px', marginBottom: '1px', display: 'flex', gap: '40px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div style={{ width: '56px', height: '56px', background: `${featured.tagColor}12`, border: `1px solid ${featured.tagColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <featured.icon size={26} style={{ color: featured.tagColor }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ padding: '2px 8px', background: `${featured.tagColor}14`, border: `1px solid ${featured.tagColor}30`, fontSize: '10px', fontWeight: 700, color: featured.tagColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{featured.tag}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{featured.date} · {featured.readTime} read</span>
                            </div>
                            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '12px', lineHeight: 1.3 }}>{featured.title}</h2>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.75', marginBottom: '20px' }}>{featured.excerpt}</p>
                            <button style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                                Read article <ArrowRight size={13} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Rest of posts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                    {rest.map(post => (
                        <div key={post.id} style={{ background: '#111', padding: '24px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ padding: '2px 8px', background: `${post.tagColor}12`, border: `1px solid ${post.tagColor}25`, fontSize: '10px', fontWeight: 700, color: post.tagColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{post.tag}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{post.readTime}</span>
                            </div>
                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: '8px', lineHeight: 1.35 }}>{post.title}</h3>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.75', marginBottom: '18px' }}>{post.excerpt}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{post.date}</span>
                                <button style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: '#b8956a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                                    Read <ArrowRight size={11} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
                        <p style={{ fontSize: '14px' }}>No posts in this category yet.</p>
                    </div>
                )}
            </div>
        </PublicPageShell>
    );
}
