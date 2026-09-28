import React, { forwardRef, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, X } from 'lucide-react';
import { searchDocs } from '../../content/docs';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');

/** Highlight the query words inside a result title. */
function Mark({ text, words }) {
    if (!words.length) return text;
    const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
    return String(text).split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

/**
 * Instant search over every docs page (combobox + listbox).
 * ↑/↓ move, Enter opens, Esc clears. The parent focuses it on ⌘K / Ctrl+K or "/".
 */
const DocsSearch = forwardRef(function DocsSearch({ onNavigate, autoFocus, large }, ref) {
    const navigate = useNavigate();
    const id = useId();
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const results = useMemo(() => searchDocs(q, 10), [q]);
    const words = useMemo(() => q.trim().split(/\s+/).filter((w) => w.length > 1), [q]);

    useEffect(() => { setActive(0); }, [q]);

    const go = (r) => {
        navigate(r.anchor ? `${r.path}#${r.anchor}` : r.path);
        setOpen(false);
        setQ('');
        onNavigate?.();
    };

    const onKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
        else if (e.key === 'Escape') {
            if (q) { e.stopPropagation(); setQ(''); } else e.currentTarget.blur();
            setOpen(false);
        }
    };

    const showList = open && q.trim().length > 0;
    return (
        <div className={`docs-search${large ? ' docs-search--large' : ''}`} role="search">
            <label htmlFor={`${id}-q`} className="orw-sr">Search the documentation</label>
            <Search size={large ? 18 : 15} className="docs-search__icon" aria-hidden="true" />
            <input
                ref={ref}
                id={`${id}-q`}
                type="search"
                className="docs-search__input"
                placeholder={large ? 'Search the docs: threads, 2FA, webhooks, @Oruinwan…' : 'Search docs'}
                value={q}
                autoFocus={autoFocus}
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={showList}
                aria-controls={`${id}-list`}
                aria-autocomplete="list"
                aria-activedescendant={showList && results[active] ? `${id}-o${active}` : undefined}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onKeyDown={onKey}
            />
            {q
                ? <button type="button" className="docs-search__clear" onClick={() => setQ('')} aria-label="Clear search"><X size={14} aria-hidden="true" /></button>
                : <span className="docs-search__hint" aria-hidden="true"><kbd className="orw-kbd">{IS_MAC ? '⌘' : 'Ctrl'}</kbd><kbd className="orw-kbd">K</kbd></span>}
            <div className={`docs-search__pop${showList ? ' is-open' : ''}`}>
                <ul id={`${id}-list`} role="listbox" aria-label="Search results">
                    {showList && results.map((r, i) => (
                        <li key={`${r.path}#${r.anchor || ''}`} id={`${id}-o${i}`} role="option" aria-selected={i === active}
                            className={`docs-search__opt${i === active ? ' is-active' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); go(r); }} onMouseEnter={() => setActive(i)}>
                            <span className="docs-search__crumb">{r.section.title} › {r.page.title}</span>
                            <span className="docs-search__title"><Mark text={r.heading || r.page.title} words={words} /></span>
                            {r.snippet && <span className="docs-search__snip">{r.snippet}</span>}
                            {i === active && <CornerDownLeft size={13} className="docs-search__enter" aria-hidden="true" />}
                        </li>
                    ))}
                </ul>
                {showList && !results.length && <p className="docs-search__empty">No pages match “{q}”. Try fewer words, or the <a href="/help">help center</a>.</p>}
                <p className="orw-sr" aria-live="polite">{showList ? `${results.length} results` : ''}</p>
            </div>
        </div>
    );
});

export default DocsSearch;
