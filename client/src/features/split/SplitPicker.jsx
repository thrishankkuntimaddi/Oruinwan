import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, FileText, FolderOpen, Hash, Headphones, Lock, MessageSquare, Search, Sparkles, SquareCheckBig, Workflow, X } from 'lucide-react';
import api from '@services/api';
import { useNotes } from '../../contexts/NotesContext';
import { split, useSplit } from './splitStore';

/**
 * "Open beside": pick what goes in the split pane. Type to filter; Enter opens the first match,
 * arrow keys move.
 */
export default function SplitPicker({ workspaceId }) {
    const { pickerOpen } = useSplit();
    const notesCtx = useNotes();
    const [query, setQuery] = useState('');
    const [channels, setChannels] = useState([]);
    const [dms, setDms] = useState([]);
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!pickerOpen || !workspaceId) return undefined;
        setQuery('');
        setActive(0);
        let live = true;
        api.get(`/api/workspaces/${workspaceId}/channels`)
            .then(({ data }) => live && setChannels((data.channels || []).filter((c) => c.isMember !== false)))
            .catch(() => {});
        api.get(`/api/v2/messages/workspace/${workspaceId}/dms`)
            .then(({ data }) => live && setDms(data.sessions || []))
            .catch(() => {});
        setTimeout(() => inputRef.current?.focus(), 0);
        return () => { live = false; };
    }, [pickerOpen, workspaceId]);

    const base = `/workspace/${workspaceId}`;
    const items = useMemo(() => {
        const all = [
            ...channels.map((c) => ({ key: `c${c._id}`, group: 'Channels', label: c.name, Icon: c.isPrivate ? Lock : Hash, path: `${base}/home/channel/${c._id}` })),
            ...dms.map((d) => ({ key: `d${d.id || d._id}`, group: 'Direct messages', label: d.otherUser?.username || 'Direct message', Icon: MessageSquare, path: `${base}/home/dm/${d.id || d._id}` })),
            ...(notesCtx?.activeNotes || []).slice(0, 30).map((n) => ({ key: `n${n.id}`, group: 'Notes', label: n.title || 'Untitled', Icon: FileText, path: `${base}/notes/${n.id}` })),
            { key: 'tasks', group: 'Pages', label: 'Tasks', Icon: SquareCheckBig, path: `${base}/tasks` },
            { key: 'notes', group: 'Pages', label: 'All notes', Icon: FileText, path: `${base}/notes` },
            { key: 'files', group: 'Pages', label: 'Files', Icon: FolderOpen, path: `${base}/files` },
            { key: 'knowledge', group: 'Pages', label: 'Knowledge', Icon: BookOpen, path: `${base}/knowledge` },
            { key: 'ai', group: 'Pages', label: 'Oruinwan AI', Icon: Sparkles, path: `${base}/ai` },
            { key: 'agents', group: 'Pages', label: 'Agents', Icon: Bot, path: `${base}/agents` },
            { key: 'automations', group: 'Pages', label: 'Workflows', Icon: Workflow, path: `${base}/automations` },
            { key: 'huddles', group: 'Pages', label: 'Huddles', Icon: Headphones, path: `${base}/huddles` },
        ];
        const q = query.trim().toLowerCase();
        return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
    }, [channels, dms, notesCtx?.activeNotes, base, query]);

    if (!pickerOpen) return null;

    const pick = (item) => item && split.open(item.path, workspaceId);
    const onKey = (e) => {
        if (e.key === 'Escape') split.closePicker();
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); pick(items[active]); }
    };

    let lastGroup = null;
    return (
        <div role="dialog" aria-modal="true" aria-label="Open beside" onKeyDown={onKey}
            onMouseDown={(e) => { if (e.target === e.currentTarget) split.closePicker(); }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}>
            <div className="gl-card" style={{ width: 'min(520px, calc(100vw - 32px))', maxHeight: '64vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Search size={15} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
                    <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                        placeholder="Open beside: a channel, DM, note or page…" aria-label="Find something to open beside"
                        data-testid="split-picker-input"
                        style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font)' }} />
                    <button type="button" className="gl-icon-btn" aria-label="Close" onClick={split.closePicker}><X size={14} /></button>
                </div>
                <ul role="listbox" aria-label="Results" style={{ listStyle: 'none', margin: 0, padding: 6, overflowY: 'auto' }}>
                    {items.length === 0 && <li style={{ padding: 16, fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>Nothing matches “{query}”.</li>}
                    {items.map((item, i) => {
                        const header = item.group !== lastGroup ? item.group : null;
                        lastGroup = item.group;
                        return (
                            <React.Fragment key={item.key}>
                                {header && <li aria-hidden="true" style={{ padding: '8px 8px 4px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{header}</li>}
                                <li role="option" aria-selected={i === active}>
                                    <button type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(item)}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: 0, cursor: 'pointer', textAlign: 'left', fontSize: 13.5, fontFamily: 'var(--font)', color: 'var(--text-primary)', background: i === active ? 'var(--bg-active)' : 'transparent' }}>
                                        <item.Icon size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} aria-hidden="true" />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                                    </button>
                                </li>
                            </React.Fragment>
                        );
                    })}
                </ul>
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open beside · <kbd>Ctrl</kbd>/<kbd>⌘</kbd> <kbd>\</kbd> to toggle split view
                </div>
            </div>
        </div>
    );
}
