import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';
import { useRevealAll, scrollToId } from '../../pages/landing/hooks';
import BRAND from '../../shared/brand';
import '../../pages/landing/landing.css';
import './public.css';

/*
 * Building blocks for public pages in the "Monolith Gloss" style.
 * Every page renders inside <OrwRoot> (PublicPageShell / AuthShell do this),
 * which provides the .orw scope, ambient backdrop and scroll reveals.
 * Add `data-reveal` to any element to fade it in on scroll.
 */

export const spotlight = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
};

// Adds the `public-scroll` class (restores document scrolling) and sets the tab title.
export function usePublicPage(title) {
    useEffect(() => {
        const html = document.documentElement;
        html.classList.add('public-scroll');
        const prev = document.title;
        document.title = title ? `${title} · ${BRAND.name}` : BRAND.name;
        return () => { html.classList.remove('public-scroll'); document.title = prev; };
    }, [title]);
}

export const OrwRoot = ({ children, className = '' }) => {
    const ref = useRef(null);
    useRevealAll(ref);
    return (
        <div className={`orw ${className}`} ref={ref} id="top">
            <div className="orw-backdrop" aria-hidden="true">
                <div className="orw-backdrop__grid" />
                <div className="orw-backdrop__aurora orw-backdrop__aurora--a" />
                <div className="orw-backdrop__aurora orw-backdrop__aurora--b" />
            </div>
            {children}
        </div>
    );
};

export const Eyebrow = ({ children, icon: Icon }) => (
    <span className="orw-chip">{Icon ? <Icon size={12} aria-hidden="true" /> : <span className="orw-dot" aria-hidden="true" />}{children}</span>
);

/** Top-of-page header. `title` may contain a <span className="orw-gloss-text"> accent. */
export const PageHero = ({ eyebrow, icon, title, lead, meta, actions, center, crumb }) => (
    <header className={`orw-phero${center ? ' orw-phero--center' : ''}`}>
        <div className="orw-container">
            {crumb && (
                <nav className="orw-phero__crumb" aria-label="Breadcrumb" data-reveal>
                    <Link to="/">{BRAND.name}</Link><ChevronRight size={12} aria-hidden="true" /><span>{crumb}</span>
                </nav>
            )}
            {eyebrow && <div data-reveal><Eyebrow icon={icon}>{eyebrow}</Eyebrow></div>}
            <h1 className="orw-phero__title" data-reveal style={{ '--d': '60ms' }}>{title}</h1>
            {lead && <p className="orw-phero__lead" data-reveal style={{ '--d': '120ms' }}>{lead}</p>}
            {meta && <div className="orw-phero__meta" data-reveal style={{ '--d': '160ms' }}>{meta}</div>}
            {actions && <div className="orw-phero__actions" data-reveal style={{ '--d': '200ms' }}>{actions}</div>}
        </div>
    </header>
);

/** A page section with an optional eyebrow/title/lead heading. */
export const Block = ({ id, eyebrow, title, lead, slab, center, children, className = '' }) => (
    <section id={id} className={`orw-block${slab ? ' orw-block--slab' : ''} ${className}`}>
        <div className="orw-container">
            {(eyebrow || title || lead) && (
                <div className={`orw-block__head${center ? ' orw-section__head--center' : ''}`} data-reveal>
                    {eyebrow && <p className="orw-eyebrow">{eyebrow}</p>}
                    {title && <h2 className="orw-h2">{title}</h2>}
                    {lead && <p className="orw-lead">{lead}</p>}
                </div>
            )}
            {children}
        </div>
    </section>
);

export const Split = ({ eyebrow, title, children }) => (
    <div className="orw-split" data-reveal>
        <div>
            {eyebrow && <p className="orw-eyebrow">{eyebrow}</p>}
            {title && <h2 className="orw-h2" style={{ fontSize: 'clamp(24px,3vw,34px)' }}>{title}</h2>}
        </div>
        <div className="orw-split__body">{children}</div>
    </div>
);

/** Hairline grid of cards. `min` is the minimum column width (px number or CSS value), clamped to the container. */
export const Grid = ({ min = 240, children, className = '' }) => (
    <div className={`orw-grid ${className}`} style={{ '--min': typeof min === 'number' ? `min(${min}px, 100%)` : min }} data-reveal>{children}</div>
);

/**
 * Card. Pass `to` (internal route), `href` (external/mailto) or `onClick` to
 * make the whole card interactive.
 */
export const Card = ({ icon: Icon, color, kicker, title, children, foot, to, href, onClick, featured, className = '' }) => {
    const cls = `orw-card${to || href || onClick ? ' orw-card--link' : ''}${featured ? ' orw-card--featured' : ''} ${className}`;
    const body = (
        <>
            {Icon && <span className="orw-card__icon" style={color ? { '--c': color } : undefined}><Icon size={19} aria-hidden="true" /></span>}
            {kicker && <span className="orw-card__kicker">{kicker}</span>}
            {title && <h3>{title}</h3>}
            {children}
            {foot && <div className="orw-card__foot">{foot}</div>}
        </>
    );
    if (to) return <Link to={to} className={cls} onMouseMove={spotlight}>{body}</Link>;
    if (href) return <a href={href} className={cls} onMouseMove={spotlight} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a>;
    if (onClick) return <button type="button" onClick={onClick} className={cls} onMouseMove={spotlight} style={{ textAlign: 'left', border: 0, font: 'inherit' }}>{body}</button>;
    return <div className={cls} onMouseMove={spotlight}>{body}</div>;
};

const CALLOUT_ICONS = { info: Info, good: CheckCircle2, warn: AlertTriangle };
export const Callout = ({ type = 'info', children }) => {
    const Icon = CALLOUT_ICONS[type] || Info;
    return <div className={`orw-callout${type !== 'info' ? ` orw-callout--${type}` : ''}`}><Icon size={16} aria-hidden="true" /><div>{children}</div></div>;
};

/** Closing call-to-action panel. */
export const CTABand = ({ eyebrow, title, lead, actions }) => (
    <section className="orw-block" style={{ borderBottom: 0 }}>
        <div className="orw-container">
            <div className="orw-final orw-glass" data-reveal>
                {eyebrow && <p className="orw-eyebrow" style={{ justifyContent: 'center' }}>{eyebrow}</p>}
                <h2 className="orw-h2">{title}</h2>
                {lead && <p className="orw-lead">{lead}</p>}
                {actions && <div className="orw-final__ctas">{actions}</div>}
            </div>
        </div>
    </section>
);

/**
 * Long-form document with a sticky, scroll-synced table of contents.
 * sections: [{ id, title, icon?, content }]. Set `numbered` for legal docs.
 * `filter` (optional string) hides sections whose title+text don't match.
 */
export const DocLayout = ({ sections, numbered, tocLabel = 'On this page', tocTop, footer }) => {
    const [active, setActive] = useState(sections[0]?.id);
    const ids = sections.map(s => s.id).join('|');

    useEffect(() => {
        if (!('IntersectionObserver' in window)) return undefined;
        const els = ids.split('|').map(id => document.getElementById(id)).filter(Boolean);
        const ob = new IntersectionObserver((entries) => {
            const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (vis[0]) setActive(vis[0].target.id);
        }, { rootMargin: '-90px 0px -65% 0px' });
        els.forEach(el => ob.observe(el));
        return () => ob.disconnect();
    }, [ids]);

    const jump = (id) => (e) => {
        e.preventDefault();
        setActive(id);
        scrollToId(id);
        window.history.replaceState(null, '', `#${id}`);
    };

    return (
        <div className="orw-container orw-doc">
            <aside className="orw-toc" aria-label={tocLabel}>
                {tocTop}
                <p className="orw-toc__label">{tocLabel}</p>
                <ol>
                    {sections.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <li key={s.id}>
                                <a href={`#${s.id}`} onClick={jump(s.id)} className={active === s.id ? 'is-active' : ''}
                                    aria-current={active === s.id ? 'true' : undefined}>
                                    {Icon && <Icon size={14} aria-hidden="true" />}
                                    {numbered ? `${i + 1}. ` : ''}{s.title}
                                </a>
                            </li>
                        );
                    })}
                </ol>
            </aside>
            <article className="orw-prose">
                {sections.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                            <h2 id={`${s.id}-h`}>
                                {numbered && <span className="orw-prose__num">{String(i + 1).padStart(2, '0')}</span>}
                                {Icon && !numbered && <span className="orw-prose__icon"><Icon size={16} aria-hidden="true" /></span>}
                                {s.title}
                            </h2>
                            {s.content}
                        </section>
                    );
                })}
                {footer}
            </article>
        </div>
    );
};
