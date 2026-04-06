// PublicPageShell.jsx — Monolith Flow: Shared nav + footer for all public pages
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Menu, X as XIcon } from 'lucide-react';

const NAV_LINKS = [
    { label: 'Platform', href: '/#platform' },
    { label: 'Chttrix AI', href: '/#ai' },
    { label: 'Solutions', href: '/#accounts' },
    { label: 'Downloads', href: '/#downloads' },
];

const FOOTER_COLS = [
    { title: 'Product', links: [
        { l: 'Features', path: '/#platform' },
        { l: 'Chttrix AI', path: '/#ai' },
        { l: 'Enterprise', path: '/#accounts' },
        { l: 'Security', path: '/security' },
        { l: 'Downloads', path: '/#downloads' },
    ]},
    { title: 'Company', links: [
        { l: 'About Us', path: '/about' },
        { l: 'Careers', path: '/careers' },
        { l: 'Blog', path: '/blog' },
        { l: 'Brand & Media', path: '/brand' },
        { l: 'Contact', path: '/contact' },
    ]},
    { title: 'Resources', links: [
        { l: 'Documentation', path: '/chttrix-docs' },
        { l: 'Help Center', path: '/help' },
        { l: 'Community', path: '/community' },
        { l: 'Status', path: '/status' },
    ]},
    { title: 'Legal', links: [
        { l: 'Privacy Policy', path: '/privacy' },
        { l: 'Terms of Service', path: '/terms' },
        { l: 'Cookie Settings', path: '/cookies' },
    ]},
];

const NavBtn = ({ label, href }) => {
    const [hov, setHov] = useState(false);
    const navigate = useNavigate();
    const handleClick = (e) => {
        e.preventDefault();
        if (href.startsWith('/#')) {
            navigate('/');
            setTimeout(() => {
                const id = href.replace('/#', '');
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
        } else {
            navigate(href);
        }
    };
    return (
        <a href={href} onClick={handleClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                fontSize: '13px', fontWeight: 600,
                color: hov ? '#e4e4e4' : 'rgba(228,228,228,0.5)',
                textDecoration: 'none', transition: 'color 150ms ease',
                padding: '8px 0', display: 'block',
            }}>
            {label}
        </a>
    );
};

export default function PublicPageShell({ children, title }) {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        document.documentElement.classList.add('public-scroll');
        window.scrollTo(0, 0);
        return () => document.documentElement.classList.remove('public-scroll');
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const S = {
        container: { maxWidth: '1160px', margin: '0 auto', padding: '0 24px' },
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0c0c0c', color: '#e4e4e4', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                ::selection { background: rgba(184,149,106,0.3); color: #e4e4e4; }
            `}</style>

            {/* ── Nav ── */}
            <nav style={{
                position: 'fixed', top: 0, width: '100%', zIndex: 100,
                background: scrolled ? 'rgba(12,12,12,0.97)' : 'rgba(12,12,12,0.85)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                transition: 'all 250ms ease',
            }}>
                {/* Main nav row */}
                <div style={{ ...S.container, height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>

                    {/* Logo */}
                    <div
                        onClick={() => { navigate('/'); setMobileMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 }}
                    >
                        <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '2px' }} />
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Chttrix</span>
                        {title && (
                            <>
                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>/</span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(228,228,228,0.5)', whiteSpace: 'nowrap' }}>{title}</span>
                            </>
                        )}
                    </div>

                    {/* Desktop nav links */}
                    <div className="psh-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1, justifyContent: 'center' }}>
                        {NAV_LINKS.map(l => <NavBtn key={l.label} {...l} />)}
                    </div>

                    {/* Desktop CTA */}
                    <div className="psh-nav-cta" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <button
                            onClick={() => navigate('/login')}
                            style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(228,228,228,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms ease', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.5)'}
                        >
                            Log in
                        </button>
                        <button
                            onClick={() => navigate('/register-company')}
                            style={{ padding: '7px 14px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '5px', transition: 'opacity 150ms ease', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            Get Started <ChevronRight size={12} />
                        </button>
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        className="psh-hamburger"
                        onClick={() => setMobileMenuOpen(o => !o)}
                        style={{
                            display: 'none', padding: '6px', background: 'none', border: 'none',
                            cursor: 'pointer', color: '#e4e4e4', flexShrink: 0,
                            alignItems: 'center', justifyContent: 'center', transition: '150ms ease',
                        }}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <XIcon size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* Mobile drawer */}
                {mobileMenuOpen && (
                    <div style={{
                        background: 'rgba(12,12,12,0.99)',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        padding: '8px 24px 20px',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {NAV_LINKS.map(l => <NavBtn key={l.label} {...l} />)}
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                                style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600, color: 'rgba(228,228,228,0.6)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: '150ms ease' }}
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => { navigate('/register-company'); setMobileMenuOpen(false); }}
                                style={{ width: '100%', padding: '10px 14px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'opacity 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                Get Started <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* ── Page Content ── */}
            <div style={{ paddingTop: '56px' }}>
                {children}
            </div>

            {/* ── Footer ── */}
            <footer style={{ background: '#080808', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '48px', paddingBottom: '32px' }}>
                <div style={S.container}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '32px', marginBottom: '40px' }}>
                        <div>
                            <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', cursor: 'pointer' }}>
                                <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '24px', height: '24px', objectFit: 'cover' }} />
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.02em' }}>Chttrix</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'rgba(228,228,228,0.3)', lineHeight: '1.8', maxWidth: '200px' }}>
                                The operating system for forward-thinking teams. Channels, AI, tasks — one place.
                            </p>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                {[{ l: '𝕏', h: 'https://x.com/chttrix' }, { l: 'in', h: 'https://linkedin.com/company/chttrix' }, { l: '▶', h: 'https://youtube.com/@chttrix' }].map(s => (
                                    <a key={s.l} href={s.h} target="_blank" rel="noopener noreferrer"
                                        style={{ width: '28px', height: '28px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(228,228,228,0.35)', fontSize: '11px', fontWeight: 700, textDecoration: 'none', transition: 'all 150ms ease' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#b8956a'; e.currentTarget.style.color = '#b8956a'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; }}>
                                        {s.l}
                                    </a>
                                ))}
                            </div>
                        </div>
                        {FOOTER_COLS.map(col => (
                            <div key={col.title}>
                                <h4 style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(228,228,228,0.35)', marginBottom: '14px' }}>{col.title}</h4>
                                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                    {col.links.map(link => (
                                        <li key={link.l}>
                                            <button onClick={() => navigate(link.path)}
                                                style={{ background: 'none', border: 'none', color: 'rgba(228,228,228,0.35)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left', transition: 'color 150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.35)'}>
                                                {link.l}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(228,228,228,0.2)' }}>© 2026 Chttrix Inc. All rights reserved.</span>
                        <span style={{ fontSize: '11px', color: 'rgba(228,228,228,0.15)', fontFamily: 'monospace' }}>v1.0 · workspace-os</span>
                    </div>
                </div>
            </footer>

            {/* Mobile responsiveness */}
            <style>{`
                @media (max-width: 680px) {
                    .psh-nav-links { display: none !important; }
                    .psh-nav-cta { display: none !important; }
                    .psh-hamburger { display: flex !important; }
                }
                @media (min-width: 681px) {
                    .psh-hamburger { display: none !important; }
                }
            `}</style>
        </div>
    );
}
