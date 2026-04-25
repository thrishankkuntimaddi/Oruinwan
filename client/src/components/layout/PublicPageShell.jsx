import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Menu, X as XIcon } from 'lucide-react';

const NAV_LINKS = [
    { label: 'Platform',  href: '/#platform' },
    { label: 'Chttrix AI', href: '/#ai' },
    { label: 'Solutions', href: '/#accounts' },
    { label: 'Downloads', href: '/#downloads' },
];

const FOOTER_COLS = [
    { title: 'Product', links: [
        { l: 'Features',   path: '/#platform' },
        { l: 'Chttrix AI', path: '/#ai' },
        { l: 'Enterprise', path: '/#accounts' },
        { l: 'Security',   path: '/security' },
        { l: 'Downloads',  path: '/#downloads' },
    ]},
    { title: 'Company', links: [
        { l: 'About Us',     path: '/about' },
        { l: 'Careers',      path: '/careers' },
        { l: 'Blog',         path: '/blog' },
        { l: 'Brand & Media', path: '/brand' },
        { l: 'Contact',      path: '/contact' },
    ]},
    { title: 'Resources', links: [
        { l: 'Docs',       path: '/chttrix-docs' },
        { l: 'Help',       path: '/help' },
        { l: 'Community',  path: '/community' },
        { l: 'Status',     path: '/status' },
    ]},
    { title: 'Legal', links: [
        { l: 'Privacy',  path: '/privacy' },
        { l: 'Terms',    path: '/terms' },
        { l: 'Cookies',  path: '/cookies' },
    ]},
];

const NavBtn = ({ label, href, onClick }) => {
    const navigate = useNavigate();
    const handleClick = (e) => {
        e.preventDefault();
        if (onClick) onClick();
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
        <a
            href={href}
            onClick={handleClick}
            style={{
                fontSize: '13px', fontWeight: 600,
                color: 'var(--text-muted)',
                textDecoration: 'none', transition: 'color 150ms ease',
                padding: '8px 0', display: 'block', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.55)'}
        >
            {label}
        </a>
    );
};

function useWindowWidth() {
    const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);
    useEffect(() => {
        const handler = () => setW(window.innerWidth);
        window.addEventListener('resize', handler, { passive: true });
        return () => window.removeEventListener('resize', handler);
    }, []);
    return w;
}

export default function PublicPageShell({ children, title }) {
    const navigate    = useNavigate();
    const [scrolled, setScrolled]         = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const width = useWindowWidth();
    const isMobile = width <= 860;

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

    
    useEffect(() => {
        if (!isMobile) setMobileMenuOpen(false);
    }, [isMobile]);

    const S = { container: { maxWidth: '1160px', margin: '0 auto', padding: '0 20px' } };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
            <style>{`
                * { box-sizing: border-box; margin: 0; padding: 0; }
                ::selection { background: rgba(184,149,106,0.3); color: #e4e4e4; }
                .public-scroll { overflow-y: auto; }
            `}</style>

            {}
            <nav style={{
                position: 'fixed', top: 0, width: '100%', zIndex: 100,
                background: scrolled ? 'rgba(12,12,12,0.97)' : 'rgba(12,12,12,0.88)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                transition: 'background 250ms ease',
            }}>
                {}
                <div style={{
                    ...S.container,
                    height: '56px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: '8px',
                }}>
                    {}
                    <div
                        onClick={() => { navigate('/'); setMobileMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', flexShrink: 0 }}
                    >
                        <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} />
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Chttrix</span>
                        {title && (
                            <>
                                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '14px', margin: '0 2px' }}>/</span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{title}</span>
                            </>
                        )}
                    </div>

                    {}
                    {!isMobile && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, justifyContent: 'center' }}>
                                {NAV_LINKS.map(l => <NavBtn key={l.label} {...l} />)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <button
                                    onClick={() => navigate('/login')}
                                    style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 150ms ease', whiteSpace: 'nowrap' }}
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
                        </>
                    )}

                    {}
                    {isMobile && (
                        <button
                            onClick={() => setMobileMenuOpen(o => !o)}
                            style={{ padding: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            aria-label="Toggle menu"
                        >
                            {mobileMenuOpen ? <XIcon size={22} /> : <Menu size={22} />}
                        </button>
                    )}
                </div>

                {}
                {isMobile && mobileMenuOpen && (
                    <div style={{
                        background: 'rgba(10,10,10,0.99)',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        padding: '8px 20px 20px',
                    }}>
                        {NAV_LINKS.map(l => (
                            <NavBtn key={l.label} {...l} onClick={() => setMobileMenuOpen(false)} />
                        ))}
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                                onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}
                                style={{ width: '100%', padding: '11px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border-default)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}
                            >
                                Log in
                            </button>
                            <button
                                onClick={() => { navigate('/register-company'); setMobileMenuOpen(false); }}
                                style={{ width: '100%', padding: '11px 14px', background: '#b8956a', border: 'none', color: '#0c0c0c', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                Get Started <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {}
            <div style={{ paddingTop: '56px' }}>
                {children}
            </div>

            {}
            <footer style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)', paddingTop: '48px', paddingBottom: '32px' }}>
                <div style={S.container}>

                    {}
                    <div style={{ marginBottom: '32px' }}>
                        <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px', cursor: 'pointer', width: 'fit-content' }}>
                            <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '2px' }} />
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Chttrix</span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.7', maxWidth: '280px' }}>
                            The operating system for forward-thinking teams. Channels, AI, tasks — one place.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                            {[{ l: '𝕏', h: 'https://x.com/chttrix' }, { l: 'in', h: 'https://linkedin.com/company/chttrix' }, { l: '▶', h: 'https://youtube.com/@chttrix' }].map(s => (
                                <a key={s.l} href={s.h} target="_blank" rel="noopener noreferrer"
                                    style={{ width: '30px', height: '30px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, textDecoration: 'none', transition: 'all 150ms ease' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#b8956a'; e.currentTarget.style.color = '#b8956a'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(228,228,228,0.35)'; }}>
                                    {s.l}
                                </a>
                            ))}
                        </div>
                    </div>

                    {}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile
                            ? 'repeat(2, 1fr)'          
                            : 'repeat(4, 1fr)',          
                        gap: isMobile ? '24px 16px' : '0 24px',
                        marginBottom: '32px',
                    }}>
                        {FOOTER_COLS.map(col => (
                            <div key={col.title}>
                                <h4 style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '12px' }}>{col.title}</h4>
                                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {col.links.map(link => (
                                        <li key={link.l}>
                                            <button
                                                onClick={() => navigate(link.path)}
                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left', transition: 'color 150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.color = '#e4e4e4'}
                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(228,228,228,0.38)'}
                                            >
                                                {link.l}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>© 2026 Chttrix Inc. All rights reserved.</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>v1.0 · workspace-os</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
