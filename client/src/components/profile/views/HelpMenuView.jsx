import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, BookOpen, Keyboard, Bug, Sparkles, LifeBuoy, Inbox, Search, ExternalLink, Compass,
} from 'lucide-react';
import { searchArticles } from '../../../content/helpArticles';
import { openHelp, useHelpEntryPoint } from '../../help/helpStore';
import { startTour } from '../../tour/tourState';
import '../profileMenu.css';

// Each item opens the shared Help panel (components/help) at the matching view.
const ITEMS = [
    { key: 'home',      label: 'Browse help topics', Icon: BookOpen,  open: { view: 'home' } },
    { key: 'shortcuts', label: 'Keyboard shortcuts', Icon: Keyboard,  open: { view: 'shortcuts' } },
    { key: 'whatsnew',  label: "What's new",         Icon: Sparkles,  open: { view: 'whatsnew' } },
    { key: 'problem',   label: 'Report a problem',   Icon: Bug,       open: { view: 'contact', category: 'problem' } },
    { key: 'contact',   label: 'Contact support',    Icon: LifeBuoy,  open: { view: 'contact', category: 'question' } },
    { key: 'requests',  label: 'Your requests',      Icon: Inbox,     open: { view: 'requests' } },
];

/**
 * Help & Support in the profile menu: a quick article search plus shortcuts
 * into the Help panel. `onNavigate` is kept for ProfileSidebar's API but is no
 * longer used — the old placeholder views were replaced by the Help panel.
 */
const HelpMenuView = ({ onBack, onClose }) => {
    const navigate = useNavigate();
    useHelpEntryPoint(navigate);
    const [query, setQuery] = useState('');
    const results = useMemo(() => (query.trim() ? searchArticles(query).slice(0, 5) : []), [query]);

    return (
        <div className="pm" role="dialog" aria-label="Help and support">
            <div className="pm-head">
                <button type="button" className="pm-back" onClick={onBack}><ChevronLeft size={14} aria-hidden="true" /> Back</button>
                <h2>Help and support</h2>
                <span />
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
                            <button key={a.id} type="button" className="pm-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                                onClick={() => openHelp({ view: 'article', articleId: a.id })}>
                                <span style={{ fontWeight: 600 }}>{a.title}</span>
                                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.summary}</span>
                            </button>
                        ))}
                        {!results.length && (
                            <p style={{ margin: 0, padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                                No articles match. Try another word or contact support.
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        {ITEMS.map(({ key, label, Icon, open }) => (
                            <button key={key} type="button" className="pm-item" onClick={() => openHelp(open)}>
                                <Icon size={15} aria-hidden="true" />
                                {label}
                            </button>
                        ))}
                        {/* The first-run tour of the workspace (components/tour). */}
                        <button type="button" className="pm-item" onClick={() => { onClose?.(); startTour(); }}>
                            <Compass size={15} aria-hidden="true" />
                            Take the tour again
                        </button>
                    </>
                )}
                <div className="pm-rule" aria-hidden="true" />
                <a href="/help" target="_blank" rel="noopener noreferrer" className="pm-item" style={{ textDecoration: 'none' }}>
                    <ExternalLink size={15} aria-hidden="true" />
                    Open the help centre
                </a>
            </div>
        </div>
    );
};

export default HelpMenuView;
