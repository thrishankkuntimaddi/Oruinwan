import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X, Layers, Calendar, Hash, User, Paperclip } from 'lucide-react';
import {
    parseSearchQuery, queryChips, setQueryOperator, removeQueryOperator, dayKey, isValidDay,
} from '../../utils/searchQuery';
import '../../styles/gloss-x-panels.css';

const TYPE_OPTIONS = [
    { value: 'message', label: 'Messages' },
    { value: 'file', label: 'Files' },
    { value: 'task', label: 'Tasks' },
    { value: 'note', label: 'Notes' },
    { value: 'page', label: 'Knowledge pages' },
];

const HAS_OPTIONS = [
    { key: 'has', value: 'file', label: 'Has a file' },
    { key: 'has', value: 'image', label: 'Has an image' },
    { key: 'has', value: 'link', label: 'Has a link' },
    { key: 'is', value: 'pinned', label: 'Is pinned' },
    { key: 'is', value: 'thread', label: 'Is in a thread' },
];

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };

/** Small popover anchored under a chip; closes on outside click or Escape. */
function ChipMenu({ label, Icon, active, children }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);
    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                className={`gl-x-chip gl-x-chip--lg ${active ? 'is-active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <Icon size={12} /> {label} <ChevronDown size={11} />
            </button>
            {open && (
                <div className="gl-x-menu" role="menu" aria-label={label}
                    style={{ position: 'absolute', left: 0, top: '100%', marginTop: 6, minWidth: 200 }}>
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    );
}

/** Text field + suggestions for in:/from: values. */
function ValuePicker({ placeholder, sigil, suggestions, onPick }) {
    const [text, setText] = useState('');
    const q = text.replace(/^[#@]/, '').toLowerCase();
    const shown = suggestions.filter((s) => !q || s.toLowerCase().includes(q)).slice(0, 6);
    const submit = (v) => { const clean = String(v || '').trim().replace(/^[#@]/, ''); if (clean) onPick(clean); };
    return (
        <div style={{ padding: 4 }}>
            <input
                className="gl-input"
                autoFocus
                placeholder={placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(text); } }}
                aria-label={placeholder}
            />
            {shown.length > 0 && <div className="gl-x-menu-sep" />}
            {shown.map((s) => (
                <button key={s} type="button" role="menuitem" className="gl-x-menu-item" onClick={() => submit(s)}>
                    {sigil}{s}
                </button>
            ))}
        </div>
    );
}

/**
 * Filter chips for the search results page. They read and write the operators in
 * the query string (type:, after:/before:/on:, in:#, from:@, has:, is:), so the
 * chips and the typed query always agree.
 */
export default function SearchFilterChips({ query, onChange, channels = [], people = [] }) {
    const parsed = useMemo(() => parseSearchQuery(query), [query]);
    const chips = useMemo(() => queryChips(parsed), [parsed]);
    const [custom, setCustom] = useState({ key: 'on', value: '' });

    const set = (key, value, opts) => onChange(setQueryOperator(query, key, value, opts));
    const dateActive = !!(parsed.before || parsed.after || parsed.on);
    const setRange = (after) => {
        let q = removeQueryOperator(removeQueryOperator(query, 'on'), 'before');
        q = setQueryOperator(q, 'after', after);
        onChange(q);
    };

    return (
        <div className="srp-chips" aria-label="Search filters">
            <div className="gl-x-chips gl-x-chips--wrap">
                <ChipMenu label="Type" Icon={Layers} active={parsed.type.length > 0}>
                    {(close) => TYPE_OPTIONS.map((o) => (
                        <button key={o.value} type="button" role="menuitemradio"
                            aria-checked={parsed.type.includes(o.value)}
                            className={`gl-x-menu-item ${parsed.type.includes(o.value) ? 'is-active' : ''}`}
                            onClick={() => { set('type', o.value, { replace: true }); close(); }}>
                            {o.label}
                        </button>
                    ))}
                </ChipMenu>

                <ChipMenu label="Date" Icon={Calendar} active={dateActive}>
                    {(close) => (
                        <>
                            <button type="button" role="menuitem" className="gl-x-menu-item" onClick={() => { set('on', dayKey(new Date())); close(); }}>Today</button>
                            <button type="button" role="menuitem" className="gl-x-menu-item" onClick={() => { setRange(daysAgo(7)); close(); }}>Last 7 days</button>
                            <button type="button" role="menuitem" className="gl-x-menu-item" onClick={() => { setRange(daysAgo(30)); close(); }}>Last 30 days</button>
                            <div className="gl-x-menu-sep" />
                            <div className="gl-x-menu-label">Custom</div>
                            <div style={{ display: 'flex', gap: 4, padding: 4 }}>
                                <select className="gl-input" style={{ width: 84 }} aria-label="Date operator"
                                    value={custom.key} onChange={(e) => setCustom((c) => ({ ...c, key: e.target.value }))}>
                                    <option value="on">On</option>
                                    <option value="after">After</option>
                                    <option value="before">Before</option>
                                </select>
                                <input type="date" className="gl-input" aria-label="Custom date"
                                    value={custom.value} onChange={(e) => setCustom((c) => ({ ...c, value: e.target.value }))} />
                            </div>
                            <button type="button" className="gl-x-menu-item" disabled={!isValidDay(custom.value)}
                                onClick={() => { set(custom.key, custom.value); close(); }}>
                                Apply date
                            </button>
                        </>
                    )}
                </ChipMenu>

                <ChipMenu label="In" Icon={Hash} active={parsed.in.length > 0}>
                    {(close) => (
                        <ValuePicker placeholder="#channel" sigil="#" suggestions={channels}
                            onPick={(v) => { set('in', `#${v}`); close(); }} />
                    )}
                </ChipMenu>

                <ChipMenu label="From" Icon={User} active={parsed.from.length > 0}>
                    {(close) => (
                        <ValuePicker placeholder="@person" sigil="@" suggestions={people}
                            onPick={(v) => { set('from', v); close(); }} />
                    )}
                </ChipMenu>

                <ChipMenu label="More" Icon={Paperclip} active={parsed.has.length > 0 || parsed.is.length > 0}>
                    {(close) => HAS_OPTIONS.map((o) => {
                        const on = parsed[o.key].includes(o.value);
                        return (
                            <button key={`${o.key}:${o.value}`} type="button" role="menuitemcheckbox" aria-checked={on}
                                className={`gl-x-menu-item ${on ? 'is-active' : ''}`}
                                onClick={() => {
                                    onChange(on ? removeQueryOperator(query, o.key, o.value) : setQueryOperator(query, o.key, o.value));
                                    close();
                                }}>
                                {o.label}
                            </button>
                        );
                    })}
                </ChipMenu>

                {chips.map((c) => (
                    <span key={`${c.key}:${c.value}`} className="gl-x-chip gl-x-chip--lg is-active">
                        {c.label}
                        <button type="button" className="srp-chip-x" aria-label={`Remove ${c.label}`}
                            onClick={() => onChange(removeQueryOperator(query, c.key, c.value))}>
                            <X size={11} />
                        </button>
                    </span>
                ))}
                {chips.length > 1 && (
                    <button type="button" className="gl-x-chip gl-x-chip--lg"
                        onClick={() => onChange(parsed.text)}>
                        Clear filters
                    </button>
                )}
            </div>
        </div>
    );
}
