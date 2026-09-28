import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, BookOpen, Keyboard, Bug, Sparkles, LifeBuoy, Inbox, Search, ExternalLink,
} from 'lucide-react';
import { searchArticles } from '../../../content/helpArticles';
import { openHelp, useHelpEntryPoint } from '../../help/helpStore';

// Each item opens the shared Help panel (components/help) at the matching view.
const ITEMS = [
    { key: 'home',      label: 'Browse help topics', Icon: BookOpen,  open: { view: 'home' } },
    { key: 'shortcuts', label: 'Keyboard shortcuts', Icon: Keyboard,  open: { view: 'shortcuts' } },
    { key: 'whatsnew',  label: "What's new",         Icon: Sparkles,  open: { view: 'whatsnew' } },
    { key: 'problem',   label: 'Report a problem',   Icon: Bug,       open: { view: 'contact', category: 'problem' } },
    { key: 'contact',   label: 'Contact support',    Icon: LifeBuoy,  open: { view: 'contact', category: 'question' } },
    { key: 'requests',  label: 'Your requests',      Icon: Inbox,     open: { view: 'requests' } },
];

const rowStyle = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
    padding: '9px 12px', fontSize: '13px', fontWeight: 500,
    color: 'var(--text-secondary)', background: 'transparent',
    border: 'none', cursor: 'pointer', textAlign: 'left',
    fontFamily: 'var(--font, Inter, system-ui, sans-serif)', transition: 'all 150ms ease',
};

const hoverOn = (e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; };
const hoverOff = (e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; };

/**
 * Help & Support in the profile menu: a quick article search plus shortcuts
 * into the Help panel. `onNavigate` is kept for ProfileSidebar's API but is no
 * longer used — the old placeholder views were replaced by the Help panel.
 */
const HelpMenuView = ({ onBack }) => {
    const navigate = useNavigate();
    useHelpEntryPoint(navigate);
    const [query, setQuery] = useState('');
    const results = useMemo(() => (query.trim() ? searchArticles(query).slice(0, 5) : []), [query]);

    return (
        <div
            className="gl-card"
            style={{
                width: '280px', background: 'var(--bg-surface)',
                boxShadow: 'var(--gl-spec), 0 24px 80px rgba(0,0,0,0.5)',
                overflow: 'hidden', fontFamily: 'var(--font, Inter, system-ui, sans-serif)',
            }}
        >
            <div style={{
                padding: '10px 12px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)',
            }}>
                <button type="button" className="gl-btn gl-btn--ghost gl-btn--sm" onClick={onBack} style={{ paddingLeft: 4 }}>
                    <ChevronLeft size={13} aria-hidden="true" /> Back
                </button>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Help &amp; Support</span>
                <div style={{ width: '52px' }} />
            </div>

            <form role="search" onSubmit={(e) => { e.preventDefault(); openHelp({ query }); }} style={{ padding: '10px 12px 4px' }}>
                <div className="gl-search">
                    <Search size={13} aria-hidden="true" />
                    <input
                        type="search"
                        className="gl-input"
                        placeholder="Search help"
                        aria-label="Search help articles"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoComplete="off"
                    />
                </div>
            </form>

            <div style={{ padding: '4px 6px 6px' }}>
                {query.trim() ? (
                    <>
                        {results.map((a) => (
                            <button key={a.id} type="button" style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                                onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                                onClick={() => openHelp({ view: 'article', articleId: a.id })}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.title}</span>
                                <span style={{ fontSize: 11.5, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.summary}</span>
                            </button>
                        ))}
                        {!results.length && (
                            <p style={{ margin: 0, padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                                No articles match. Try another word or contact support.
                            </p>
                        )}
                    </>
                ) : (
                    ITEMS.map(({ key, label, Icon, open }) => (
                        <button key={key} type="button" style={rowStyle}
                            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                            onClick={() => openHelp(open)}>
                            <Icon size={15} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            {label}
                        </button>
                    ))
                )}
                <a href="/help" target="_blank" rel="noopener noreferrer" style={{ ...rowStyle, textDecoration: 'none', borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}
                    onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                    <ExternalLink size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                    Open full help center
                </a>
            </div>
        </div>
    );
};

export default HelpMenuView;
