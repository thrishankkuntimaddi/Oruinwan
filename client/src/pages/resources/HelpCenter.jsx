import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, ArrowRight, ArrowUpRight, X, Sparkles } from 'lucide-react';
import PublicPageShell from '../../components/layout/PublicPageShell';
import { PageHero, Callout, CTABand, spotlight } from '../../components/public/PublicKit';
import { useAuth } from '../../contexts/AuthContext';
import {
    TOPICS, ARTICLES, WHATS_NEW, articlesInTopic, getArticle, searchArticles, resolveAppPath,
} from '../../content/helpArticles';
import { TOPIC_ICONS } from '../../components/help/topicIcons';
import ArticleBody from '../../components/help/ArticleBody';
import '../../components/help/helpCenter.css';

function lastWorkspaceId() {
    try { return localStorage.getItem('lastWorkspaceId') || ''; } catch { return ''; }
}

/*
 * Articles as an accessible accordion (same pattern as the landing FAQ).
 * Content here is rendered without scroll-reveal so search results and deep
 * links are visible immediately.
 */
function ArticleList({ articles, openId, setOpenId, signedIn }) {
    return (
        <div className="orw-faq hc-faq">
            {articles.map((a) => {
                const isOpen = openId === a.id;
                const appHref = signedIn && a.appPath
                    ? resolveAppPath(a.appPath, { pathname: '/help', lastWorkspaceId: lastWorkspaceId() })
                    : null;
                return (
                    <div className="orw-faq__item" key={a.id} id={a.id}>
                        <h4>
                            <button type="button" className="orw-faq__q hc-q" id={`help-q-${a.id}`}
                                aria-expanded={isOpen} aria-controls={`help-a-${a.id}`}
                                onClick={() => {
                                    setOpenId(isOpen ? null : a.id);
                                    if (!isOpen) window.history.replaceState(null, '', `#${a.id}`);
                                }}>
                                <span>
                                    <span className="hc-q__title">{a.title}</span>
                                    <span className="hc-q__sum">{a.summary}</span>
                                </span>
                                <span className="orw-faq__sign" aria-hidden="true" />
                            </button>
                        </h4>
                        <div className={`orw-faq__a${isOpen ? ' is-open' : ''}`} id={`help-a-${a.id}`}
                            role="region" aria-labelledby={`help-q-${a.id}`} inert={!isOpen}>
                            <div>
                                <div className="hc-body">
                                    <ArticleBody body={a.body} classes={{ steps: 'hc-steps', note: 'hc-note' }} />
                                    {appHref && (
                                        <Link to={appHref} className="orw-btn orw-btn--ghost hc-open">
                                            {a.appLabel || 'Open in Oruinwan'} <ArrowUpRight size={14} aria-hidden="true" />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function HelpCenter() {
    const { user } = useAuth() || {};
    const signedIn = !!user;
    const { hash } = useLocation();
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState(null);
    const query = search.trim();

    // Deep link: /help#<article-id> opens that article.
    useEffect(() => {
        const id = decodeURIComponent((hash || '').slice(1));
        if (id && getArticle(id)) setOpenId(id);
    }, [hash]);

    const results = useMemo(() => (query ? searchArticles(query) : null), [query]);

    return (
        <PublicPageShell title="Help Center">
            <PageHero
                crumb="Help Center"
                eyebrow="Help Center"
                icon={BookOpen}
                title={<>How can we <span className="orw-gloss-text">help?</span></>}
                lead="Guides for workspaces, messaging, Oruinwan AI, tasks, huddles, security and your account."
                actions={
                    <form role="search" className="orw-field" style={{ width: '100%', maxWidth: 560 }} onSubmit={(e) => e.preventDefault()}>
                        <label className="orw-label" htmlFor="help-search">Search help articles</label>
                        <div className="orw-input-wrap">
                            <input id="help-search" type="search" className="orw-input" value={search}
                                onChange={(e) => setSearch(e.target.value)} placeholder="e.g. invite, 2FA, threads, export"
                                autoComplete="off" aria-describedby="help-search-count" />
                            {search && (
                                <button type="button" className="orw-input-wrap__btn" aria-label="Clear search" onClick={() => setSearch('')}>
                                    <X size={16} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        <p className="orw-hint" id="help-search-count" aria-live="polite">
                            {results
                                ? `${results.length} ${results.length === 1 ? 'article matches' : 'articles match'} “${query}”`
                                : `${ARTICLES.length} articles across ${TOPICS.length} topics`}
                        </p>
                    </form>
                }
            />

            {results ? (
                <section className="orw-block" aria-labelledby="hc-results-title">
                    <div className="orw-container">
                        <div className="orw-block__head">
                            <p className="orw-eyebrow">Search</p>
                            <h2 className="orw-h2" id="hc-results-title">Results</h2>
                        </div>
                        {results.length > 0 ? (
                            <ArticleList articles={results} openId={openId} setOpenId={setOpenId} signedIn={signedIn} />
                        ) : (
                            <Callout type="warn">
                                <strong>No articles match “{query}”.</strong> Try a different word, or{' '}
                                <button type="button" className="orw-link" onClick={() => setSearch('')}>clear the search</button>{' '}
                                to browse every topic. You can also <Link className="orw-link" to="/contact">contact us</Link>.
                            </Callout>
                        )}
                    </div>
                </section>
            ) : (
                <>
                    <section className="orw-block" aria-labelledby="hc-topics-title">
                        <div className="orw-container">
                            <div className="orw-block__head">
                                <p className="orw-eyebrow">Browse by topic</p>
                                <h2 className="orw-h2" id="hc-topics-title">Topics</h2>
                            </div>
                            <div className="orw-grid" style={{ '--min': 'min(250px, 100%)' }}>
                                {TOPICS.map((t) => {
                                    const Icon = TOPIC_ICONS[t.id] || BookOpen;
                                    return (
                                        <a key={t.id} href={`#topic-${t.id}`} className="orw-card orw-card--link" onMouseMove={spotlight}>
                                            <span className="orw-card__icon"><Icon size={19} aria-hidden="true" /></span>
                                            <span className="orw-card__kicker">{articlesInTopic(t.id).length} articles</span>
                                            <h3>{t.title}</h3>
                                            <p>{t.blurb}</p>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {TOPICS.map((t) => (
                        <section key={t.id} id={`topic-${t.id}`} className="orw-block hc-topic" aria-labelledby={`hc-t-${t.id}`}>
                            <div className="orw-container hc-topic__grid">
                                <div className="hc-topic__head">
                                    <p className="orw-eyebrow">Topic</p>
                                    <h2 className="orw-h2" id={`hc-t-${t.id}`}>{t.title}</h2>
                                    <p className="orw-lead">{t.blurb}</p>
                                </div>
                                <ArticleList articles={articlesInTopic(t.id)} openId={openId} setOpenId={setOpenId} signedIn={signedIn} />
                            </div>
                        </section>
                    ))}

                    <section className="orw-block" aria-labelledby="hc-new-title">
                        <div className="orw-container">
                            <div className="orw-block__head">
                                <p className="orw-eyebrow"><Sparkles size={12} aria-hidden="true" /> Recently shipped</p>
                                <h2 className="orw-h2" id="hc-new-title">What&apos;s new</h2>
                            </div>
                            <div className="orw-grid" style={{ '--min': 'min(300px, 100%)' }}>
                                {WHATS_NEW.map((n) => (
                                    <div key={n.id} className="orw-card" onMouseMove={spotlight}>
                                        <span className="orw-card__kicker">{n.date}</span>
                                        <h3>{n.title}</h3>
                                        <p>{n.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                </>
            )}

            <CTABand
                eyebrow="Support"
                title="Still need help?"
                lead={signedIn
                    ? 'Inside Oruinwan, open Help (the ? button or press ?) → Contact support to send a request and follow its status. Or write to us here.'
                    : 'Send us a message and our team will get back to you.'}
                actions={
                    <Link to="/contact" className="orw-btn orw-btn--primary orw-btn--lg">
                        Contact support <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                }
            />
        </PublicPageShell>
    );
}
