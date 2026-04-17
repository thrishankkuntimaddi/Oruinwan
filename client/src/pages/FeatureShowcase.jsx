// FeatureShowcase.jsx — Chttrix Landing Page · Monolith Flow Design System
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    MessageSquare, Zap, CheckSquare, Globe, Shield, Sparkles, ArrowRight,
    Laptop, Briefcase, Building2, CheckCircle2, MessageCircle, GitBranch,
    Monitor, Smartphone, Apple, Volume2, VolumeX, Lock, Server, Users,
    Play, ChevronRight,
} from 'lucide-react';
import LoadingScreen from '../shared/components/ui/LoadingScreen';

const VIDEO_HERO  = '/hover-animation.mp4';
const VIDEO_AI    = '/ChttrixAI-animation.mp4';

// ─── Utility: animate on scroll ───────────────────────────────────────────────
function useReveal() {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); ob.disconnect(); } }, { threshold: 0.12 });
        ob.observe(el);
        return () => ob.disconnect();
    }, []);
    return [ref, visible];
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────
const NavLink = ({ href, children }) => {
    const [hov, setHov] = useState(false);
    return (
        <a href={href}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ fontSize: '13px', fontWeight: 600, color: hov ? '#e4e4e4' : 'rgba(228,228,228,0.5)', textDecoration: 'none', transition: 'color 150ms ease', letterSpacing: '0.01em' }}>
            {children}
        </a>
    );
};

const AccentBtn = ({ onClick, children, large }) => {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: large ? '13px 28px' : '9px 20px', background: hov ? 'rgba(184,149,106,0.92)' : 'var(--accent, #b8956a)', border: 'none', color: '#0c0c0c', fontSize: large ? '14px' : '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.01em', transition: 'all 150ms ease', display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {children}
        </button>
    );
};

const GhostBtn = ({ onClick, children, large }) => {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: large ? '12px 28px' : '8px 20px', background: hov ? 'rgba(255,255,255,0.06)' : 'transparent', border: '1px solid rgba(255,255,255,0.14)', color: hov ? '#e4e4e4' : 'rgba(228,228,228,0.7)', fontSize: large ? '14px' : '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease', display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {children}
        </button>
    );
};

const FeatureCard = ({ icon: Icon, title, desc, color }) => {
    const [hov, setHov] = useState(false);
    const [ref, vis] = useReveal();
    return (
        <div ref={ref} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ background: hov ? 'rgba(255,255,255,0.04)' : '#111', border: `1px solid ${hov ? color : 'rgba(255,255,255,0.07)'}`, padding: '28px 24px', transition: 'all 220ms ease', cursor: 'default', opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(20px)', transitionDelay: '0ms' }}>
            <div style={{ width: '40px', height: '40px', background: `${color}14`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                <Icon size={19} style={{ color }} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.01em' }}>{title}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7' }}>{desc}</p>
        </div>
    );
};

const TrustPillar = ({ icon: Icon, title, desc }) => {
    const [ref, vis] = useReveal();
    return (
        <div ref={ref} style={{ textAlign: 'center', padding: '32px 24px', opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(16px)', transition: 'all 400ms ease' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(184,149,106,0.1)', border: '1px solid rgba(184,149,106,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Icon size={22} style={{ color: '#b8956a' }} />
            </div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{title}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7', maxWidth: '240px', margin: '0 auto' }}>{desc}</p>
        </div>
    );
};

const SolutionCard = ({ icon: Icon, label, title, desc, features, cta, accent, onClick }) => {
    const [hov, setHov] = useState(false);
    return (
        <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ background: '#111', border: `1px solid ${hov ? accent : 'rgba(255,255,255,0.07)'}`, padding: '36px 32px', transition: 'all 220ms ease', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: `${accent}14`, border: `1px solid ${accent}30`, marginBottom: '24px', width: 'fit-content' }}>
                <Icon size={13} style={{ color: accent }} />
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: accent }}>{label}</span>
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.02em' }}>{title}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.7', marginBottom: '24px' }}>{desc}</p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px', flex: 1 }}>
                {features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <CheckCircle2 size={13} style={{ color: accent, flexShrink: 0 }} />
                        {f}
                    </li>
                ))}
            </ul>
            <button onClick={onClick} style={{ padding: '11px 0', background: accent, border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.01em', fontFamily: 'Inter, system-ui, sans-serif', opacity: hov ? 0.92 : 1, transition: 'opacity 150ms ease' }}>
                {cta}
            </button>
        </div>
    );
};

const DownloadCard = ({ icon: Icon, title, desc, color, actions }) => {
    const [hov, setHov] = useState(false);
    return (
        <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ background: '#111', border: `1px solid ${hov ? color : 'rgba(255,255,255,0.07)'}`, padding: '28px 24px', transition: 'all 220ms ease' }}>
            <div style={{ width: '42px', height: '42px', background: `${color}14`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                <Icon size={20} style={{ color }} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{title}</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>{desc}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {actions}
            </div>
        </div>
    );
};

const DlBtn = ({ label, onClick }) => {
    const [hov, setHov] = useState(false);
    const [flash, setFlash] = useState(false);
    const handleClick = () => { setFlash(true); setTimeout(() => setFlash(false), 1800); if (onClick) onClick(); };
    return (
        <button onClick={handleClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ padding: '9px 14px', background: hov ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: hov ? '#e4e4e4' : 'rgba(228,228,228,0.6)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}>
            {flash ? 'Coming Soon ✦' : label}
        </button>
    );
};

// ─── FEATURES DATA ─────────────────────────────────────────────────────────────
const FEATURES = [
    { icon: MessageSquare, color: '#6ea8fe', title: 'Channels', desc: 'Structured, threaded conversations for every project and topic. Keep the noise out, the focus in.' },
    { icon: MessageCircle, color: '#a78bfa', title: 'Direct Messages', desc: 'Private 1:1 and group chats. Secure, fast, context-aware.' },
    { icon: GitBranch, color: '#c084fc', title: 'Threads', desc: 'Reply to any message without cluttering the main channel. Side conversations, properly organized.' },
    { icon: Zap, color: '#fbbf24', title: 'Video Huddles', desc: 'One-click voice and video. Screen-share live, no calendar invite needed.' },
    { icon: CheckSquare, color: '#34d399', title: 'Tasks', desc: 'Native project management — Kanban boards, deadlines, assignments, and progress tracking.' },
    { icon: Globe, color: '#fb923c', title: 'Notes', desc: 'Collaborative wiki-style documents that live next to your conversations.' },
    { icon: Shield, color: '#f472b6', title: 'Updates', desc: 'Async status reports for teams. Async standup, no meeting required.' },
    { icon: Sparkles, color: '#b8956a', title: 'Chttrix AI', desc: 'The intelligence layer connecting it all — summarize threads, generate tasks, answer questions.' },
];

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const FeatureShowcase = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isFirstVisit] = useState(() => {
        const visited = localStorage.getItem('chttrix_visited');
        if (!visited) { localStorage.setItem('chttrix_visited', 'true'); return true; }
        return false;
    });
    const [scrolled, setScrolled] = useState(false);
    const heroVideoRef = useRef(null);
    const aiVideoRef = useRef(null);
    const [heroMuted, setHeroMuted] = useState(true);
    const [aiMuted, setAiMuted] = useState(true);

    // Enable page scroll (html/body have overflow:hidden globally for the app shell)
    useEffect(() => {
        document.documentElement.classList.add('public-scroll');
        window.scrollTo(0, 0);
        return () => document.documentElement.classList.remove('public-scroll');
    }, []);

    useEffect(() => {
        if (user) { navigate('/workspaces'); return; }
        if (!isFirstVisit) setTimeout(() => setIsLoading(false), 300);
        const onScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [user, navigate, isFirstVisit]);

    // Video intersection observer
    useEffect(() => {
        const ob = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.play().catch(() => {});
                } else {
                    e.target.pause();
                }
            });
        }, { threshold: 0.4 });
        if (heroVideoRef.current) ob.observe(heroVideoRef.current);
        if (aiVideoRef.current) ob.observe(aiVideoRef.current);
        return () => ob.disconnect();
    }, []);

    const scrollTo = useCallback((id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    if (user) return null;

    const S = {
        page: { minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif', overflowX: 'hidden' },
        container: { maxWidth: '1160px', margin: '0 auto', padding: '0 24px' },
        sectionLabel: { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(184,149,106,0.8)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
        sectionH2: { fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: '14px' },
        sectionSub: { fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.7', maxWidth: '560px' },
        divider: { borderTop: '1px solid var(--border-subtle)' },
    };

    return (
        <div style={S.page}>
            {/* ── Loading ────────────────── */}
            {isLoading && isFirstVisit && <LoadingScreen onComplete={() => setIsLoading(false)} />}

            {/* ── Global page styles ──────── */}
            <style>{`
                html { scroll-behavior: smooth; }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                ::selection { background: rgba(184,149,106,0.3); color: #e4e4e4; }
                @keyframes heroFloat {
                    0%, 100% { transform: translateY(0px); }
                    50%       { transform: translateY(-10px); }
                }
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%       { opacity: 0.5; transform: scale(1.5); }
                }
                @keyframes marquee {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-50%); }
                }
                .landing-btn-accent:hover { opacity: 0.88; }
            `}</style>

            {/* ══════════════════════════════
                NAV
            ══════════════════════════════ */}
            <nav style={{
                position: 'fixed', top: 0, width: '100%', zIndex: 100,
                background: scrolled ? 'rgba(12,12,12,0.92)' : 'transparent',
                borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
                backdropFilter: scrolled ? 'blur(16px)' : 'none',
                transition: 'all 300ms ease',
            }}>
                <div style={{ ...S.container, height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Logo */}
                    <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '30px', height: '30px', objectFit: 'cover' }} />
                        <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Chttrix</span>
                    </div>

                    {/* Center Nav */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        <NavLink href="#platform">Platform</NavLink>
                        <NavLink href="#ai">Chttrix AI</NavLink>
                        <NavLink href="#accounts">Solutions</NavLink>
                        <NavLink href="#downloads">Downloads</NavLink>
                    </div>

                    {/* Right actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button onClick={() => navigate('/login')}
                            style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.6)'}>
                            Log in
                        </button>
                        <AccentBtn onClick={() => scrollTo('accounts')}>
                            Get Started <ChevronRight size={14} />
                        </AccentBtn>
                    </div>
                </div>
            </nav>

            {/* ══════════════════════════════
                HERO
            ══════════════════════════════ */}
            <section style={{ paddingTop: '120px', paddingBottom: '80px', position: 'relative', overflow: 'hidden' }}>
                {/* Ambient background */}
                <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(184,149,106,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '0', left: '-10%', width: '500px', height: '400px', background: 'radial-gradient(circle, rgba(155,142,207,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />

                <div style={{ ...S.container, display: 'flex', alignItems: 'center', gap: '64px', flexWrap: 'wrap' }}>
                    {/* Left — text */}
                    <div style={{ flex: '1 1 400px' }}>
                        {/* Status badge */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '32px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'pulse-dot 2s ease-in-out infinite', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(184,149,106,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                Waitlist Open · Free to Join
                            </span>
                        </div>

                        <h1 style={{ fontSize: 'clamp(36px,5.5vw,68px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.08, marginBottom: '22px' }}>
                            One workspace.<br />
                            <span style={{ color: '#b8956a' }}>Every conversation.</span>
                        </h1>

                        <p style={{ fontSize: '16px', color: 'var(--text-muted)', lineHeight: '1.75', marginBottom: '36px', maxWidth: '500px' }}>
                            Chttrix is the operating system for modern teams — channels, DMs, video huddles, tasks, notes, and <span style={{ color: 'rgba(184,149,106,0.9)', fontWeight: 600 }}>Chttrix AI</span>, all in one place. No tab-switching. No context loss. Just work.
                        </p>

                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
                            <AccentBtn large onClick={() => scrollTo('accounts')}>
                                Start Free <ArrowRight size={15} />
                            </AccentBtn>
                            <GhostBtn large onClick={() => scrollTo('platform')}>
                                <Play size={13} /> See How It Works
                            </GhostBtn>
                        </div>

                        {/* Trust badges */}
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            {['SOC 2 Ready', 'End-to-end encrypted', '99.9% uptime SLA'].map(b => (
                                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.02em' }}>
                                    <CheckCircle2 size={11} style={{ color: '#34d399' }} />
                                    {b}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right — hero video */}
                    <div style={{ flex: '1 1 360px', maxWidth: '520px', animation: 'heroFloat 9s ease-in-out infinite' }}>
                        <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.09)', background: '#111', overflow: 'hidden', aspectRatio: '1/1' }}>
                            <video ref={heroVideoRef} src={VIDEO_HERO} autoPlay muted={heroMuted} playsInline loop
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <button onClick={() => { heroVideoRef.current.muted = !heroMuted; setHeroMuted(!heroMuted); }}
                                style={{ position: 'absolute', bottom: '16px', right: '16px', width: '36px', height: '36px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}>
                                {heroMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                SOCIAL PROOF BAR
            ══════════════════════════════ */}
            <section style={{ ...S.divider, background: 'rgba(255,255,255,0.02)', padding: '28px 0', overflow: 'hidden' }}>
                <div style={S.container}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '48px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                            Trusted by teams at
                        </p>
                        {['Startups', 'Creative Studios', 'Growth Agencies', 'Remote-first Companies', 'SaaS Teams'].map(name => (
                            <span key={name} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>{name}</span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                PLATFORM FEATURES
            ══════════════════════════════ */}
            <section id="platform" style={{ padding: '96px 0', ...S.divider }}>
                <div style={S.container}>
                    <div style={{ marginBottom: '56px' }}>
                        <p style={S.sectionLabel}>
                            <span style={{ width: '20px', height: '1px', background: '#b8956a', display: 'inline-block' }} />
                            Platform
                        </p>
                        <h2 style={S.sectionH2}>Everything your team needs.<br />Nothing it doesn't.</h2>
                        <p style={S.sectionSub}>Eight deeply integrated tools built to replace five separate apps. Fewer context switches. More deep work.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                        {FEATURES.map((f, i) => (
                            <FeatureCard key={i} {...f} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                AI SECTION
            ══════════════════════════════ */}
            <section id="ai" style={{ padding: '96px 0', background: '#0f0f0f' }}>
                <div style={S.container}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '72px', flexWrap: 'wrap' }}>
                        {/* Video */}
                        <div style={{ flex: '1 1 380px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', background: '#111' }}>
                            <video ref={aiVideoRef} src={VIDEO_AI} autoPlay muted={aiMuted} playsInline loop
                                style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                        </div>

                        {/* Text */}
                        <div style={{ flex: '1 1 360px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', border: '1px solid rgba(184,149,106,0.3)', background: 'rgba(184,149,106,0.07)', marginBottom: '24px' }}>
                                <Sparkles size={12} style={{ color: '#b8956a' }} />
                                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b8956a' }}>Chttrix Intelligence™</span>
                            </div>

                            <h2 style={{ ...S.sectionH2, marginBottom: '18px' }}>
                                Your AI teammate.<br />
                                <span style={{ color: '#b8956a' }}>Always on.</span>
                            </h2>

                            <p style={{ ...S.sectionSub, marginBottom: '32px' }}>
                                Chttrix AI doesn't just chat — it understands your entire workspace. It reads threads, generates tasks, writes drafts, and surfaces answers before you ask.
                            </p>

                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
                                {[
                                    'Summarize any channel or thread instantly',
                                    'Auto-generate tasks from conversations',
                                    'Answer questions with workspace context',
                                    'Mention @ChttrixAI in any message',
                                ].map((item, i) => (
                                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        <span style={{ width: '6px', height: '6px', background: '#b8956a', flexShrink: 0 }} />
                                        {item}
                                    </li>
                                ))}
                            </ul>

                            <GhostBtn onClick={() => navigate('/chttrix-docs')}>
                                Explore AI capabilities <ArrowRight size={13} />
                            </GhostBtn>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                TRUST / SECURITY
            ══════════════════════════════ */}
            <section style={{ padding: '80px 0', ...S.divider }}>
                <div style={S.container}>
                    <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                        <p style={{ ...S.sectionLabel, justifyContent: 'center' }}>
                            <span style={{ width: '20px', height: '1px', background: '#b8956a', display: 'inline-block' }} />
                            Security & Trust
                        </p>
                        <h2 style={{ ...S.sectionH2, textAlign: 'center' }}>Built for enterprises.<br />Trusted by everyone.</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', borderTop: '1px solid rgba(255,255,255,0.05)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                        {[
                            { icon: Lock, title: 'End-to-End Encryption', desc: 'All messages and files encrypted in transit and at rest using AES-256.' },
                            { icon: Server, title: 'SOC 2 Type II Ready', desc: 'Security controls mapped to SOC 2 criteria with audit-ready audit logging.' },
                            { icon: Users, title: 'Granular Access Control', desc: 'Role-based permissions across workspaces, channels, and admin panels.' },
                            { icon: Shield, title: 'Data Residency Options', desc: 'Choose where your data lives. EU, US, or bring your own cloud.' },
                        ].map((p, i) => (
                            <div key={i} style={{ borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <TrustPillar {...p} />
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                SOLUTIONS / GET STARTED
            ══════════════════════════════ */}
            <section id="accounts" style={{ padding: '96px 0', background: '#0f0f0f' }}>
                <div style={S.container}>
                    <div style={{ marginBottom: '56px' }}>
                        <p style={S.sectionLabel}>
                            <span style={{ width: '20px', height: '1px', background: '#b8956a', display: 'inline-block' }} />
                            Get Started
                        </p>
                        <h2 style={S.sectionH2}>Choose your HQ.</h2>
                        <p style={S.sectionSub}>Tailored for individuals and ambitious teams. Start free, upgrade when you grow.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                        <SolutionCard
                            icon={Briefcase} label="Personal" accent="#6ea8fe"
                            title="Personal Workspace"
                            desc="For freelancers, students, and solo projects. Get started instantly — no card required."
                            features={['Unlimited personal projects', 'Basic Chttrix AI access', 'Up to 3 collaboration invites', 'Free forever']}
                            cta="Create Free Account"
                            onClick={() => navigate('/login?mode=signup')}
                        />
                        <SolutionCard
                            icon={Building2} label="Company" accent="#b8956a"
                            title="Company HQ"
                            desc="For teams that need structure, oversight, and scale. Full admin controls included."
                            features={['Unlimited team members', 'Full Chttrix AI suite', 'Admin dashboard & org chart', 'Departments, roles & permissions', 'Audit logs & compliance tools']}
                            cta="Register Company HQ"
                            onClick={() => navigate('/register-company')}
                        />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                DOWNLOADS
            ══════════════════════════════ */}
            <section id="downloads" style={{ padding: '96px 0', ...S.divider }}>
                <div style={S.container}>
                    <div style={{ marginBottom: '56px' }}>
                        <p style={S.sectionLabel}>
                            <span style={{ width: '20px', height: '1px', background: '#b8956a', display: 'inline-block' }} />
                            Available Everywhere
                        </p>
                        <h2 style={S.sectionH2}>Your workspace in your pocket.</h2>
                        <p style={S.sectionSub}>Web, desktop, and mobile — synced in real time across all your devices.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: 'var(--bg-hover)' }}>
                        <DownloadCard icon={Globe} color="#6ea8fe" title="Web App" desc="Access your workspace from any browser — no installation required."
                            actions={<button onClick={() => navigate('/login')} style={{ padding: '10px 14px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Launch Chttrix Web →</button>} />
                        <DownloadCard icon={Monitor} color="#a78bfa" title="Desktop App" desc="Native performance, offline support, and system notifications."
                            actions={<><DlBtn label="⌘ Download for Mac" /><DlBtn label="⊞ Download for Windows" /></>} />
                        <DownloadCard icon={Smartphone} color="#34d399" title="Mobile App" desc="Stay connected on the go — iOS and Android apps coming soon."
                            actions={<><DlBtn label="⬇ Download on App Store" /><DlBtn label="⬇ Get it on Google Play" /></>} />
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                CTA BANNER
            ══════════════════════════════ */}
            <section style={{ padding: '80px 0', background: 'rgba(184,149,106,0.05)', borderTop: '1px solid rgba(184,149,106,0.15)', borderBottom: '1px solid rgba(184,149,106,0.15)' }}>
                <div style={{ ...S.container, textAlign: 'center' }}>
                    <h2 style={{ fontSize: 'clamp(24px,3.5vw,40px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '14px' }}>
                        Ready to build your HQ?
                    </h2>
                    <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '36px' }}>
                        Join the waitlist. Free accounts open now.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <AccentBtn large onClick={() => scrollTo('accounts')}>
                            Get Started Free <ArrowRight size={15} />
                        </AccentBtn>
                        <GhostBtn large onClick={() => navigate('/login')}>
                            Log in to existing account
                        </GhostBtn>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════
                FOOTER
            ══════════════════════════════ */}
            <footer style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)', paddingTop: '64px', paddingBottom: '40px' }}>
                <div style={S.container}>
                    {/* Top row — brand + columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '48px', marginBottom: '56px', flexWrap: 'wrap' }}>
                        {/* Brand */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '28px', height: '28px', objectFit: 'cover' }} />
                                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Chttrix</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.8', maxWidth: '220px' }}>
                                The operating system for forward-thinking teams. Channels, AI, tasks — all in one place.
                            </p>
                            {/* Social icons */}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                {[
                                    { label: '𝕏', href: 'https://x.com/chttrix' },
                                    { label: 'in', href: 'https://www.linkedin.com/company/chttrix/' },
                                    { label: '▶', href: 'https://youtube.com/@chttrix' },
                                ].map(s => (
                                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                                        style={{ width: '30px', height: '30px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, textDecoration: 'none', transition: 'all 150ms ease' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#b8956a'; e.currentTarget.style.color = '#b8956a'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(228,228,228,0.4)'; }}>
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Link columns */}
                        {[
                            { title: 'Product', links: [{ l: 'Features', f: () => scrollTo('platform') }, { l: 'Chttrix AI', f: () => scrollTo('ai') }, { l: 'Enterprise', f: () => scrollTo('accounts') }, { l: 'Security', f: () => navigate('/security') }, { l: 'Downloads', f: () => scrollTo('downloads') }] },
                            { title: 'Company', links: [{ l: 'About Us', f: () => navigate('/about') }, { l: 'Careers', f: () => navigate('/careers') }, { l: 'Blog', f: () => navigate('/blog') }, { l: 'Brand & Media', f: () => navigate('/brand') }, { l: 'Contact', f: () => navigate('/contact') }] },
                            { title: 'Resources', links: [{ l: 'Documentation', f: () => navigate('/chttrix-docs') }, { l: 'Help Center', f: () => navigate('/help') }, { l: 'Community', f: () => navigate('/community') }, { l: 'Status', f: () => navigate('/status') }] },
                            { title: 'Legal', links: [{ l: 'Privacy Policy', f: () => navigate('/privacy') }, { l: 'Terms of Service', f: () => navigate('/terms') }, { l: 'Cookie Settings', f: () => navigate('/cookies') }] },
                        ].map(col => (
                            <div key={col.title}>
                                <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '18px' }}>{col.title}</h4>
                                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {col.links.map(link => (
                                        <li key={link.l}>
                                            <button onClick={link.f} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left', transition: 'color 150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.4)'}>
                                                {link.l}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Bottom bar */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            © 2026 Chttrix Inc. All rights reserved.
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
                            v1.0 · workspace-os
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default FeatureShowcase;
