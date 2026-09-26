import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import BrandMark from '../../shared/components/ui/BrandMark';
import BRAND from '../../shared/brand';
import { NAV_LINKS } from './data';
import { scrollToId, useActiveSection, useScrollState } from './hooks';

const SECTION_IDS = NAV_LINKS.map(l => l.id);

const LandingNav = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const onHome = pathname === '/' || pathname === '/features';
    const { scrolled, progress } = useScrollState();
    const sectionInView = useActiveSection(SECTION_IDS);
    const active = onHome ? sectionInView : null;
    const [open, setOpen] = useState(false);

    // Close the mobile drawer on Escape or when the viewport grows past the breakpoint.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const mq = window.matchMedia('(min-width: 961px)');
        const onMq = (e) => { if (e.matches) setOpen(false); };
        window.addEventListener('keydown', onKey);
        mq.addEventListener?.('change', onMq);
        return () => {
            window.removeEventListener('keydown', onKey);
            mq.removeEventListener?.('change', onMq);
        };
    }, [open]);

    // On the landing page, scroll; elsewhere, go home and let Landing scroll to the hash.
    const go = (id) => (e) => {
        e.preventDefault();
        setOpen(false);
        if (onHome) scrollToId(id);
        else navigate(id === 'top' ? '/' : `/#${id}`);
    };

    return (
        <>
            <header className={`orw-nav${scrolled || open ? ' is-scrolled' : ''}`}>
                <div className="orw-container orw-nav__inner">
                    <a href={onHome ? '#top' : '/'} className="orw-logo" onClick={go('top')} aria-label={`${BRAND.name} home`}>
                        <BrandMark size={30} />
                        <span className="orw-logo__word">{BRAND.name}</span>
                    </a>

                    <nav className="orw-nav__links" aria-label="Primary">
                        {NAV_LINKS.map(l => (
                            <a key={l.id} href={onHome ? `#${l.id}` : `/#${l.id}`} onClick={go(l.id)}
                                className={`orw-nav__link${active === l.id ? ' is-active' : ''}`}
                                aria-current={active === l.id ? 'true' : undefined}>
                                {l.label}
                            </a>
                        ))}
                    </nav>

                    <div className="orw-nav__actions">
                        <button type="button" className="orw-btn orw-btn--text" onClick={() => navigate('/login')}>Log in</button>
                        <button type="button" className="orw-btn orw-btn--primary" onClick={() => navigate('/login?mode=signup')}>
                            Get started <ArrowRight size={14} />
                        </button>
                        <button type="button" className="orw-nav__burger" onClick={() => setOpen(o => !o)}
                            aria-expanded={open} aria-controls="orw-drawer" aria-label={open ? 'Close menu' : 'Open menu'}>
                            {open ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>
                <div className="orw-nav__progress" style={{ '--p': progress }} aria-hidden="true" />
            </header>

            <div id="orw-drawer" className={`orw-drawer${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
                {NAV_LINKS.map(l => (
                    <a key={l.id} href={onHome ? `#${l.id}` : `/#${l.id}`} onClick={go(l.id)} className="orw-drawer__link">
                        {l.label} <ArrowRight size={16} />
                    </a>
                ))}
                <div className="orw-drawer__actions">
                    <button type="button" className="orw-btn orw-btn--ghost orw-btn--lg" onClick={() => navigate('/login')}>Log in</button>
                    <button type="button" className="orw-btn orw-btn--primary orw-btn--lg" onClick={() => navigate('/login?mode=signup')}>Get started</button>
                </div>
            </div>
        </>
    );
};

export default LandingNav;
