import React, { useEffect, useMemo, useRef } from 'react';
import {
    X, ChevronLeft, ChevronRight, Search, Keyboard, Sparkles, LifeBuoy, Inbox,
    ExternalLink, ArrowUpRight, BookOpen,
} from 'lucide-react';
import {
    TOPICS, SHORTCUTS, WHATS_NEW, getArticle, getTopic, articlesInTopic,
    searchArticles, resolveAppPath, relatedArticles,
} from '../../content/helpArticles';
import { useHelpState, setHelpState, closeHelp, helpNavigate } from './helpStore';
import { TOPIC_ICONS } from './topicIcons';
import ArticleBody from './ArticleBody';
import SupportForm from './SupportForm';
import MyRequests from './MyRequests';
import ShortcutKeys from './ShortcutKeys';
import './help.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function lastWorkspaceId() {
    try { return localStorage.getItem('lastWorkspaceId') || ''; } catch { return ''; }
}

function appHref(appPath) {
    return resolveAppPath(appPath, { pathname: window.location.pathname, lastWorkspaceId: lastWorkspaceId() });
}

const TITLES = {
    home: 'Help',
    shortcuts: 'Keyboard shortcuts',
    whatsnew: "What's new",
    contact: 'Contact support',
    requests: 'Your requests',
};

function ArticleRow({ article, onOpen }) {
    const Icon = TOPIC_ICONS[article.topic] || BookOpen;
    return (
        <li>
            <button type="button" className="hp-row" onClick={() => onOpen(article.id)}>
                <Icon size={15} aria-hidden="true" className="hp-row__icon" />
                <span className="hp-row__text">
                    <span className="hp-row__title">{article.title}</span>
                    <span className="hp-row__sub">{article.summary}</span>
                </span>
                <ChevronRight size={14} aria-hidden="true" className="hp-row__chev" />
            </button>
        </li>
    );
}

function ArticleView({ article, onOpen, onContact }) {
    const topic = getTopic(article.topic);
    const href = article.appPath ? appHref(article.appPath) : null;
    const related = relatedArticles(article.id, 4);
    return (
        <article className="hp-article" aria-labelledby="hp-article-title">
            {topic && <p className="gl-eyebrow">{topic.title}</p>}
            <h3 id="hp-article-title" className="hp-article__title">{article.title}</h3>
            <p className="hp-article__summary">{article.summary}</p>
            <div className="hp-prose">
                <ArticleBody body={article.body} classes={{ note: 'hp-note' }} />
            </div>
            {href && (
                <button
                    type="button"
                    className="gl-btn gl-btn--primary gl-btn--sm"
                    onClick={() => { closeHelp(); helpNavigate(href); }}
                >
                    {article.appLabel || 'Open in Oruinwan'} <ArrowUpRight size={13} aria-hidden="true" />
                </button>
            )}
            {related.length > 0 && (
                <>
                    <p className="gl-section-label hp-related-label">Related</p>
                    <ul className="hp-list">
                        {related.map((a) => <ArticleRow key={a.id} article={a} onOpen={onOpen} />)}
                    </ul>
                </>
            )}
            <p className="hp-muted hp-article__foot">
                Didn&apos;t answer your question?{' '}
                <button type="button" className="hp-link" onClick={onContact}>Contact support</button>
            </p>
        </article>
    );
}

function ShortcutsView() {
    const groups = useMemo(() => {
        const map = new Map();
        SHORTCUTS.forEach((s) => {
            if (!map.has(s.group)) map.set(s.group, []);
            map.get(s.group).push(s);
        });
        return [...map.entries()];
    }, []);
    return (
        <div className="hp-shortcuts">
            {groups.map(([group, items]) => (
                <section key={group} aria-label={group}>
                    <p className="gl-section-label">{group}</p>
                    <dl className="hp-keys">
                        {items.map((s) => (
                            <div className="hp-keys__row" key={s.label}>
                                <dt>{s.label}{s.where && <span className="hp-muted"> · {s.where}</span>}</dt>
                                <dd><ShortcutKeys keys={s.keys} /></dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
        </div>
    );
}

function WhatsNewView({ onOpen }) {
    return (
        <ol className="hp-news">
            {WHATS_NEW.map((n) => (
                <li key={n.id} className="gl-card hp-news__item">
                    <p className="hp-news__date">{n.date}</p>
                    <h3 className="hp-news__title">{n.title}</h3>
                    <p className="hp-news__text">{n.text}</p>
                    {n.articleId && getArticle(n.articleId) && (
                        <button type="button" className="hp-link" onClick={() => onOpen(n.articleId)}>
                            How it works <ChevronRight size={12} aria-hidden="true" />
                        </button>
                    )}
                </li>
            ))}
        </ol>
    );
}

export default function HelpPanel() {
    const { open, view, topicId, articleId, query } = useHelpState();
    const panelRef = useRef(null);
    const searchRef = useRef(null);
    const bodyRef = useRef(null);

    const results = useMemo(() => (query.trim() ? searchArticles(query) : null), [query]);

    // Focus the search box when the panel opens.
    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 0);
    }, [open]);

    // Esc closes even when focus has fallen out of the panel (e.g. the clicked row unmounted).
    useEffect(() => {
        if (!open) return undefined;
        const onDocKey = (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            if (panelRef.current && panelRef.current.contains(e.target)) return; // handled by onKeyDown
            closeHelp();
        };
        document.addEventListener('keydown', onDocKey);
        return () => document.removeEventListener('keydown', onDocKey);
    }, [open]);

    // New view: back to the top, and keep keyboard focus inside the panel.
    const firstView = useRef(true);
    useEffect(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = 0;
        if (!open) { firstView.current = true; return; }
        if (firstView.current) { firstView.current = false; return; }
        const active = document.activeElement;
        if (!panelRef.current?.contains(active) || active === document.body) {
            panelRef.current?.querySelector('#hp-title')?.focus();
        }
    }, [open, view, topicId, articleId]);

    if (!open) return null;

    const go = (patch) => setHelpState({ query: '', ...patch });
    const openArticle = (id) => go({ view: 'article', articleId: id });
    const openContact = () => go({ view: 'contact' });

    const topic = view === 'topic' ? getTopic(topicId) : null;
    const article = view === 'article' ? getArticle(articleId) : null;

    const back = () => {
        if (view === 'article' && article) go({ view: 'topic', topicId: article.topic, articleId: null });
        else go({ view: 'home', topicId: null, articleId: null });
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closeHelp();
            return;
        }
        if (e.key !== 'Tab' || !panelRef.current) return;
        const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    let title = TITLES[view] || 'Help';
    if (topic) title = topic.title;
    if (article) title = getTopic(article.topic)?.title || 'Help';
    if (results) title = 'Search';

    let content;
    if (results) {
        content = results.length ? (
            <>
                <p className="hp-muted hp-count" aria-live="polite">
                    {results.length} {results.length === 1 ? 'article' : 'articles'} for “{query.trim()}”
                </p>
                <ul className="hp-list">{results.map((a) => <ArticleRow key={a.id} article={a} onOpen={openArticle} />)}</ul>
            </>
        ) : (
            <div className="gl-empty" aria-live="polite">
                <span className="gl-empty-mark"><Search size={18} aria-hidden="true" /></span>
                <p className="gl-empty-title">No articles match “{query.trim()}”</p>
                <p className="gl-empty-text">Try another word, or ask us directly.</p>
                <button type="button" className="gl-btn gl-btn--sm" onClick={openContact}>Contact support</button>
            </div>
        );
    } else if (article) {
        content = <ArticleView article={article} onOpen={openArticle} onContact={openContact} />;
    } else if (topic) {
        content = (
            <>
                <p className="hp-muted hp-topic-blurb">{topic.blurb}</p>
                <ul className="hp-list">{articlesInTopic(topic.id).map((a) => <ArticleRow key={a.id} article={a} onOpen={openArticle} />)}</ul>
            </>
        );
    } else if (view === 'shortcuts') {
        content = <ShortcutsView />;
    } else if (view === 'whatsnew') {
        content = <WhatsNewView onOpen={openArticle} />;
    } else if (view === 'contact') {
        content = <SupportForm onDone={() => go({ view: 'requests' })} />;
    } else if (view === 'requests') {
        content = <MyRequests onNew={openContact} />;
    } else {
        content = (
            <>
                <p className="gl-section-label">Browse topics</p>
                <ul className="hp-topics">
                    {TOPICS.map((t) => {
                        const Icon = TOPIC_ICONS[t.id] || BookOpen;
                        return (
                            <li key={t.id}>
                                <button type="button" className="gl-card gl-card--interactive hp-topic" onClick={() => go({ view: 'topic', topicId: t.id })}>
                                    <Icon size={16} aria-hidden="true" className="hp-topic__icon" />
                                    <span className="hp-topic__title">{t.title}</span>
                                    <span className="hp-topic__count">{articlesInTopic(t.id).length}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                <p className="gl-section-label">More</p>
                <ul className="hp-list">
                    {[
                        { v: 'shortcuts', label: 'Keyboard shortcuts', sub: 'Search, the AI panel, the composer', Icon: Keyboard },
                        { v: 'whatsnew', label: "What's new", sub: WHATS_NEW[0]?.title, Icon: Sparkles },
                        { v: 'contact', label: 'Contact support', sub: 'Ask a question or report a problem', Icon: LifeBuoy },
                        { v: 'requests', label: 'Your requests', sub: 'Status and replies from support', Icon: Inbox },
                    ].map(({ v, label, sub, Icon }) => (
                        <li key={v}>
                            <button type="button" className="hp-row" onClick={() => go({ view: v })}>
                                <Icon size={15} aria-hidden="true" className="hp-row__icon" />
                                <span className="hp-row__text">
                                    <span className="hp-row__title">{label}</span>
                                    {sub && <span className="hp-row__sub">{sub}</span>}
                                </span>
                                <ChevronRight size={14} aria-hidden="true" className="hp-row__chev" />
                            </button>
                        </li>
                    ))}
                </ul>
            </>
        );
    }

    const showBack = !results && view !== 'home';

    return (
        <div className="hp-layer">
            <div className="hp-scrim" onClick={closeHelp} aria-hidden="true" />
            <div
                ref={panelRef}
                className="hp-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hp-title"
                onKeyDown={onKeyDown}
            >
                <header className="hp-head">
                    {showBack ? (
                        <button type="button" className="gl-icon-btn" onClick={back} aria-label="Back">
                            <ChevronLeft size={16} aria-hidden="true" />
                        </button>
                    ) : (
                        <span className="hp-mark" aria-hidden="true"><LifeBuoy size={15} /></span>
                    )}
                    <div className="hp-head__titles">
                        <p className="hp-head__eyebrow">Oruinwan Help</p>
                        <h2 id="hp-title" className="hp-head__title" tabIndex={-1}>{title}</h2>
                    </div>
                    <button type="button" className="gl-icon-btn" onClick={closeHelp} aria-label="Close help">
                        <X size={16} aria-hidden="true" />
                    </button>
                </header>

                <div className="hp-searchbar">
                    <form role="search" className="gl-search" onSubmit={(e) => e.preventDefault()}>
                        <Search size={14} aria-hidden="true" />
                        <input
                            ref={searchRef}
                            type="search"
                            className="gl-input"
                            placeholder="Search help (e.g. 2FA, threads, remind)"
                            aria-label="Search help articles"
                            value={query}
                            onChange={(e) => setHelpState({ query: e.target.value })}
                            autoComplete="off"
                        />
                    </form>
                </div>

                <div ref={bodyRef} className="hp-body">{content}</div>

                <footer className="hp-foot">
                    <span className="hp-foot__links">
                        <a className="hp-link" href="/help" target="_blank" rel="noopener noreferrer">
                            Open full help center <ExternalLink size={12} aria-hidden="true" />
                        </a>
                        <a className="hp-link" href="/docs" target="_blank" rel="noopener noreferrer">
                            Open documentation <ExternalLink size={12} aria-hidden="true" />
                        </a>
                    </span>
                    <span className="hp-muted hp-foot__hint"><ShortcutKeys keys={[['?']]} /> toggles help</span>
                </footer>
            </div>
        </div>
    );
}
