import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import {
    BookOpen, Rocket, Building2, MessageSquare, Sparkles, CheckSquare, NotebookPen, Headphones, Bell,
    Plug, Code2, Settings as SettingsIcon, ShieldCheck, MonitorSmartphone, ChevronRight, ChevronDown,
    ArrowLeft, ArrowRight, Menu, X, ThumbsUp, ThumbsDown, LifeBuoy, List,
} from 'lucide-react';
import PublicPageShell from '../components/layout/PublicPageShell';
import { useAuth } from '../contexts/AuthContext';
import { openHelp } from '../components/help/helpStore';
import {
    SECTIONS, GROUPS, getSection, getPage, neighbours, headingsOf, docsPath,
} from '../content/docs';
import DocsBlocks, { Inline } from './docs/DocsBlocks';
import DocsSearch from './docs/DocsSearch';
import DocsFigure from './docs/DocsFigures';
import { prefersReducedMotion } from './landing/hooks';
import './docs/docs.css';

/*
 * Oruinwan documentation site.
 *   /docs                   home: search, sections, how it fits together
 *   /docs/:section          section overview
 *   /docs/:section/:page    a page (content in content/docs/<section>.js)
 * Left: grouped nav (a drawer on phones). Right: "On this page" with scroll-spy.
 */

export const SECTION_ICONS = {
    start: Rocket, company: Building2, messaging: MessageSquare, ai: Sparkles, tasks: CheckSquare,
    notes: NotebookPen, huddles: Headphones, notifications: Bell, integrations: Plug, developers: Code2,
    settings: SettingsIcon, security: ShieldCheck, platforms: MonitorSmartphone,
};

const storage = {
    get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
    set(key, v) { try { window.localStorage.setItem(key, v); } catch { /* private mode: ignore */ } },
};

// ── Progressive-enhancement reveal & figure playback ───────────────────────
// Content is visible by default. Only elements the observer reports as below
// the fold are hidden (.is-pending) and faded in when they scroll into view,
// so if the observer never fires nothing is ever hidden.
function useDocsMotion(rootRef, key) {
    useEffect(() => {
        const root = rootRef.current;
        if (!root || !('IntersectionObserver' in window)) return undefined;
        const reduce = prefersReducedMotion();
        const seen = new WeakSet();
        const reveal = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                const el = e.target;
                if (e.isIntersecting) {
                    if (el.classList.contains('is-pending')) { el.classList.remove('is-pending'); el.classList.add('is-in'); }
                    reveal.unobserve(el);
                } else if (!seen.has(el) && e.boundingClientRect.top > 0) {
                    el.classList.add('is-pending');
                }
                seen.add(el);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
        const play = new IntersectionObserver((entries) => {
            entries.forEach((e) => e.target.classList.toggle('is-playing', e.isIntersecting));
        }, { threshold: 0.2 });
        if (!reduce) root.querySelectorAll('[data-docs-reveal]').forEach((n) => reveal.observe(n));
        root.querySelectorAll('[data-docs-play]').forEach((n) => play.observe(n));
        // Printing or saving the page must never leave anything hidden.
        const showAll = () => root.querySelectorAll('.is-pending').forEach((n) => n.classList.remove('is-pending'));
        window.addEventListener('beforeprint', showAll);
        return () => { reveal.disconnect(); play.disconnect(); window.removeEventListener('beforeprint', showAll); showAll(); };
    }, [rootRef, key]);
}

function useScrollSpy(ids) {
    const [active, setActive] = useState(ids[0] || null);
    const key = ids.join('|');
    useEffect(() => {
        setActive(ids[0] || null);
        if (!ids.length || !('IntersectionObserver' in window)) return undefined;
        const visible = new Map();
        const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
        const ob = new IntersectionObserver((entries) => {
            entries.forEach((e) => visible.set(e.target.id, e.isIntersecting));
            const firstVisible = ids.find((id) => visible.get(id));
            if (firstVisible) { setActive(firstVisible); return; }
            // Between headings: the last heading above the viewport top wins.
            let last = null;
            for (const el of els) if (el.getBoundingClientRect().top < 140) last = el.id;
            if (last) setActive(last);
        }, { rootMargin: '-120px 0px -55% 0px' });
        els.forEach((el) => ob.observe(el));
        return () => ob.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return active;
}

// ── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ sectionId, onNavigate }) {
    const [openIds, setOpenIds] = useState(() => new Set(sectionId ? [sectionId] : []));
    useEffect(() => { if (sectionId) setOpenIds((s) => (s.has(sectionId) ? s : new Set([...s, sectionId]))); }, [sectionId]);
    const toggle = (id) => setOpenIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    return (
        <nav className="docs-nav" aria-label="Documentation">
            <NavLink end to="/docs" className="docs-nav__home" onClick={onNavigate}><BookOpen size={15} aria-hidden="true" /> Docs home</NavLink>
            {GROUPS.map((g) => (
                <div key={g.title} className="docs-nav__group">
                    <p className="docs-nav__label">{g.title}</p>
                    <ul>
                        {g.sections.map((sid) => {
                            const s = getSection(sid);
                            const Icon = SECTION_ICONS[sid] || BookOpen;
                            const open = openIds.has(sid);
                            return (
                                <li key={sid} className={`docs-nav__sec${sid === sectionId ? ' is-current' : ''}`}>
                                    <button type="button" className="docs-nav__toggle" aria-expanded={open} aria-controls={`docs-nav-${sid}`} onClick={() => toggle(sid)}>
                                        <Icon size={15} aria-hidden="true" /><span>{s.title}</span>
                                        <ChevronDown size={14} className="docs-nav__chev" aria-hidden="true" />
                                    </button>
                                    <ul id={`docs-nav-${sid}`} className="docs-nav__pages" hidden={!open}>
                                        {s.pages.map((p) => (
                                            <li key={p.id}>
                                                <NavLink to={docsPath(sid, p.id)} onClick={onNavigate}
                                                    className={({ isActive }) => `docs-nav__link${isActive ? ' is-active' : ''}`}>
                                                    {p.title}
                                                </NavLink>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );
}

// ── "On this page" ──────────────────────────────────────────────────────────
function Toc({ heads, active, compact }) {
    if (!heads.length) return null;
    const list = (
        <ol className="docs-toc__list">
            {heads.map((h) => (
                <li key={h.id} className={h.level === 3 ? 'is-sub' : ''}>
                    <a href={`#${h.id}`} className={active === h.id ? 'is-active' : ''} aria-current={active === h.id ? 'location' : undefined}
                        onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(h.id);
                            if (!el) return;
                            el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
                            el.focus({ preventScroll: true });
                            window.history.replaceState(null, '', `#${h.id}`);
                        }}>
                        <Inline text={h.text} />
                    </a>
                </li>
            ))}
        </ol>
    );
    if (compact) {
        return (
            <details className="docs-toc-inline">
                <summary><List size={14} aria-hidden="true" /> On this page</summary>
                {list}
            </details>
        );
    }
    return (
        <nav className="docs-toc" aria-label="On this page">
            <p className="docs-toc__label">On this page</p>
            {list}
        </nav>
    );
}

// ── Page furniture ──────────────────────────────────────────────────────────
function Breadcrumbs({ section, page }) {
    return (
        <nav className="docs-crumbs" aria-label="Breadcrumb">
            <ol>
                <li><Link to="/docs">Docs</Link></li>
                {section && <li><ChevronRight size={12} aria-hidden="true" />{page ? <Link to={docsPath(section.id)}>{section.title}</Link> : <span aria-current="page">{section.title}</span>}</li>}
                {page && <li><ChevronRight size={12} aria-hidden="true" /><span aria-current="page">{page.title}</span></li>}
            </ol>
        </nav>
    );
}

function Feedback({ path }) {
    const { user } = useAuth() || {};
    const key = `orw-docs-helpful:${path}`;
    const [vote, setVote] = useState(() => storage.get(key));
    useEffect(() => { setVote(storage.get(key)); }, [key]);
    const cast = (v) => { storage.set(key, v); setVote(v); };
    return (
        <section className="docs-feedback" aria-label="Page feedback">
            <div>
                {vote
                    ? <p className="docs-feedback__q" role="status">{vote === 'yes' ? 'Thanks! Glad it helped.' : 'Thanks for telling us. Report what was missing so we can fix it.'}</p>
                    : <p className="docs-feedback__q">Was this page helpful?</p>}
                {!vote && (
                    <div className="docs-feedback__btns">
                        <button type="button" className="orw-btn orw-btn--ghost" onClick={() => cast('yes')}><ThumbsUp size={14} aria-hidden="true" /> Yes</button>
                        <button type="button" className="orw-btn orw-btn--ghost" onClick={() => cast('no')}><ThumbsDown size={14} aria-hidden="true" /> No</button>
                    </div>
                )}
            </div>
            {user
                ? <button type="button" className="docs-feedback__report" onClick={() => openHelp({ view: 'contact', category: 'problem' })}><LifeBuoy size={14} aria-hidden="true" /> Report a problem with this page</button>
                : <Link to="/contact" className="docs-feedback__report"><LifeBuoy size={14} aria-hidden="true" /> Report a problem with this page</Link>}
        </section>
    );
}

function PrevNext({ sectionId, pageId }) {
    const { prev, next } = neighbours(sectionId, pageId);
    return (
        <nav className="docs-pn" aria-label="Previous and next page">
            {prev ? (
                <Link to={prev.path} className="docs-pn__link" rel="prev">
                    <span className="docs-pn__dir"><ArrowLeft size={13} aria-hidden="true" /> Previous</span>
                    <span className="docs-pn__title">{prev.page.title}</span>
                    <span className="docs-pn__sec">{prev.section.title}</span>
                </Link>
            ) : <span />}
            {next ? (
                <Link to={next.path} className="docs-pn__link docs-pn__link--next" rel="next">
                    <span className="docs-pn__dir">Next <ArrowRight size={13} aria-hidden="true" /></span>
                    <span className="docs-pn__title">{next.page.title}</span>
                    <span className="docs-pn__sec">{next.section.title}</span>
                </Link>
            ) : <span />}
        </nav>
    );
}

// ── Views ───────────────────────────────────────────────────────────────────
const POPULAR = [
    ['start', 'create-account'], ['start', 'workspaces'], ['messaging', 'threads'], ['ai', 'in-conversations'],
    ['notifications', 'how-it-works'], ['integrations', 'github'], ['developers', 'public-api'], ['security', 'encryption'],
];

function DocsHome({ searchRef }) {
    return (
        <div className="docs-home">
            <header className="docs-home__hero">
                <p className="docs-eyebrow">Oruinwan documentation</p>
                <h1 className="docs-home__title">Learn Oruinwan, <span className="orw-gloss-text">end to end.</span></h1>
                <p className="docs-home__lead">
                    Step-by-step guides for new members, admins and developers: workspaces and company HQ, messaging,
                    Oruinwan AI, tasks, huddles, notifications, integrations, the public API and how your data is protected.
                </p>
                <div className="docs-home__search"><DocsSearch ref={searchRef} large /></div>
                <p className="docs-home__popular">
                    <span>Popular:</span>
                    {POPULAR.map(([s, p]) => {
                        const page = getPage(s, p);
                        return page ? <Link key={`${s}/${p}`} to={docsPath(s, p)}>{page.title}</Link> : null;
                    })}
                </p>
            </header>

            <section aria-labelledby="docs-start-h" className="docs-home__block">
                <h2 id="docs-start-h" className="docs-home__h2">New here? Start in three steps</h2>
                <ol className="docs-home__path">
                    <li data-docs-reveal><Link to={docsPath('start', 'create-account')}><b>1. Create your account</b><span>Sign up and verify your email.</span></Link></li>
                    <li data-docs-reveal style={{ '--d': '80ms' }}><Link to={docsPath('start', 'create-or-join')}><b>2. Create or join a workspace</b><span>Start your own, or open an invite link.</span></Link></li>
                    <li data-docs-reveal style={{ '--d': '160ms' }}><Link to={docsPath('messaging', 'channels')}><b>3. Say hello in a channel</b><span>Then try threads, huddles and @Oruinwan.</span></Link></li>
                </ol>
            </section>

            <section aria-labelledby="docs-sec-h" className="docs-home__block">
                <h2 id="docs-sec-h" className="docs-home__h2">Browse by topic</h2>
                {GROUPS.map((g) => (
                    <div key={g.title} className="docs-home__group">
                        <h3 className="docs-home__glabel">{g.title}</h3>
                        <ul className="docs-home__grid">
                            {g.sections.map((sid, i) => {
                                const s = getSection(sid);
                                const Icon = SECTION_ICONS[sid] || BookOpen;
                                return (
                                    <li key={sid} data-docs-reveal style={{ '--d': `${i * 60}ms` }}>
                                        <Link to={docsPath(sid)} className="docs-home__card">
                                            <span className="docs-home__icon"><Icon size={18} aria-hidden="true" /></span>
                                            <b>{s.title}</b>
                                            <span className="docs-home__blurb">{s.blurb}</span>
                                            <span className="docs-home__count">{s.pages.length} pages <ArrowRight size={13} aria-hidden="true" /></span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </section>

            <section aria-labelledby="docs-shape-h" className="docs-home__block">
                <h2 id="docs-shape-h" className="docs-home__h2">How Oruinwan fits together</h2>
                <p className="docs-home__p">
                    Everyone has one account. An account belongs to one or more <Link to={docsPath('start', 'workspaces')}>workspaces</Link>, each
                    with its own channels, DMs, tasks, notes and huddles. A <Link to={docsPath('company', 'overview')}>company</Link> adds a
                    headquarters above them: a verified domain, departments, admins and audit logs.
                </p>
                <div className="docs-home__figs">
                    <DocsFigure id="workspace-tree" caption="A personal account in two workspaces." />
                    <DocsFigure id="company-tree" caption="A company HQ: departments, their workspaces and channels." />
                </div>
            </section>
        </div>
    );
}

function SectionIndex({ section }) {
    const Icon = SECTION_ICONS[section.id] || BookOpen;
    return (
        <article className="docs-article" aria-labelledby="docs-title">
            <Breadcrumbs section={section} />
            <header className="docs-article__head">
                <span className="docs-article__icon"><Icon size={20} aria-hidden="true" /></span>
                <h1 id="docs-title" className="docs-article__title" tabIndex={-1}>{section.title}</h1>
                <p className="docs-article__summary">{section.blurb}</p>
            </header>
            <ol className="docs-secindex">
                {section.pages.map((p, i) => (
                    <li key={p.id} data-docs-reveal style={{ '--d': `${Math.min(i, 8) * 40}ms` }}>
                        <Link to={docsPath(section.id, p.id)} className="docs-secindex__link">
                            <span className="docs-secindex__n">{String(i + 1).padStart(2, '0')}</span>
                            <span><b>{p.title}</b><span>{p.summary}</span></span>
                            <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                    </li>
                ))}
            </ol>
        </article>
    );
}

function DocsPage({ section, page, heads, active }) {
    const path = docsPath(section.id, page.id);
    return (
        <article className="docs-article" aria-labelledby="docs-title">
            <Breadcrumbs section={section} page={page} />
            <header className="docs-article__head">
                <p className="docs-eyebrow">{section.title}</p>
                <h1 id="docs-title" className="docs-article__title" tabIndex={-1}>{page.title}</h1>
                {page.summary && <p className="docs-article__summary"><Inline text={page.summary} /></p>}
            </header>
            <div className="docs-toc-mobile"><Toc heads={heads} active={active} compact /></div>
            <div className="docs-prose">
                <DocsBlocks page={page} />
            </div>
            <Feedback path={path} />
            <PrevNext sectionId={section.id} pageId={page.id} />
        </article>
    );
}

function NotFound({ searchRef }) {
    return (
        <article className="docs-article" aria-labelledby="docs-title">
            <Breadcrumbs />
            <header className="docs-article__head">
                <h1 id="docs-title" className="docs-article__title" tabIndex={-1}>We couldn’t find that page</h1>
                <p className="docs-article__summary">The page may have moved. Search the docs, or start from the <Link to="/docs">docs home</Link>.</p>
            </header>
            <DocsSearch ref={searchRef} large />
        </article>
    );
}

// ── Shell ───────────────────────────────────────────────────────────────────
export default function ChttrixDocs() {
    // Mounted at /docs/*: the rest of the path is "section/page".
    const [sectionId, pageId, extra] = (useParams()['*'] || '').split('/').filter(Boolean);
    const { pathname } = useLocation();
    const section = sectionId ? getSection(sectionId) : null;
    const page = section && pageId ? getPage(section.id, pageId) : null;
    const notFound = (sectionId && !section) || (pageId && !page) || !!extra;
    const view = notFound ? 'missing' : page ? 'page' : section ? 'section' : 'home';

    const heads = useMemo(() => (page ? headingsOf(page) : []), [page]);
    const active = useScrollSpy(heads.map((h) => h.id));
    const rootRef = useRef(null);
    const searchRef = useRef(null);
    const barSearchRef = useRef(null);
    const drawerRef = useRef(null);
    const menuBtnRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);
    useDocsMotion(rootRef, pathname);

    const title = page ? page.title : section ? section.title : notFound ? 'Page not found' : 'Documentation';

    // New page: close the drawer and move focus to the heading for screen readers
    // (but not on first load, so the page doesn't jump).
    const lastPath = useRef(pathname);
    useEffect(() => {
        setMenuOpen(false);
        if (lastPath.current === pathname) return;
        lastPath.current = pathname;
        if (!window.location.hash) document.getElementById('docs-title')?.focus({ preventScroll: true });
    }, [pathname]);

    // ⌘K / Ctrl+K or "/" focuses search (the big one on the home page).
    useEffect(() => {
        const onKey = (e) => {
            const t = e.target;
            const typing = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
            const mod = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
            if (mod || (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
                e.preventDefault();
                const el = (searchRef.current && searchRef.current.offsetParent !== null) ? searchRef.current : barSearchRef.current;
                el?.focus();
                el?.select?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Mobile drawer: Esc closes, focus moves in and back out.
    const closeMenu = useCallback(() => { setMenuOpen(false); menuBtnRef.current?.focus(); }, []);
    useEffect(() => {
        if (!menuOpen) return undefined;
        drawerRef.current?.querySelector('a, button')?.focus();
        const onKey = (e) => { if (e.key === 'Escape') closeMenu(); };
        const mq = window.matchMedia('(min-width: 1025px)');
        const onMq = (e) => { if (e.matches) setMenuOpen(false); };
        window.addEventListener('keydown', onKey);
        mq.addEventListener?.('change', onMq);
        return () => { window.removeEventListener('keydown', onKey); mq.removeEventListener?.('change', onMq); };
    }, [menuOpen, closeMenu]);

    return (
        <PublicPageShell title={title}>
            <div className={`docs docs--${view}`} ref={rootRef}>
                <div className="docs-bar">
                    <div className="docs-bar__inner">
                        <button ref={menuBtnRef} type="button" className="docs-bar__menu" aria-expanded={menuOpen} aria-controls="docs-drawer"
                            onClick={() => setMenuOpen((o) => !o)}>
                            {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
                            <span>{menuOpen ? 'Close' : 'Menu'}</span>
                        </button>
                        <Link to="/docs" className="docs-bar__brand"><BookOpen size={15} aria-hidden="true" /> Docs</Link>
                        <div className="docs-bar__search"><DocsSearch ref={barSearchRef} /></div>
                        <a href="/help" className="docs-bar__link">Help center</a>
                    </div>
                </div>

                <div className={`docs-grid${heads.length ? '' : ' docs-grid--wide'}`}>
                    <div id="docs-drawer" ref={drawerRef} className={`docs-side${menuOpen ? ' is-open' : ''}`}>
                        <Sidebar sectionId={section?.id} onNavigate={() => setMenuOpen(false)} />
                    </div>
                    {menuOpen && <button type="button" className="docs-scrim" aria-label="Close menu" onClick={closeMenu} />}

                    <div className="docs-main">
                        {view === 'home' && <DocsHome searchRef={searchRef} />}
                        {view === 'section' && <SectionIndex section={section} />}
                        {view === 'page' && <DocsPage section={section} page={page} heads={heads} active={active} />}
                        {view === 'missing' && <NotFound searchRef={searchRef} />}
                    </div>

                    {view === 'page' && heads.length > 0 && (
                        <aside className="docs-aside"><Toc heads={heads} active={active} /></aside>
                    )}
                </div>
            </div>
        </PublicPageShell>
    );
}

export { SECTIONS };
