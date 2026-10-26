import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, MessageSquare } from 'lucide-react';
import { getAvatarUrl } from '../../../utils/avatarUtils';
import GroupStartBar, { GroupPickToggle } from '../groupDm/GroupStartBar';
import useWorkspaceRecipients from './useWorkspaceRecipients';
import { filterRecipients, togglePicked } from './recipients';

/**
 * "New message", the same everywhere (Home sidebar and Messages page):
 *  - the workspace's active members, searched by name, username or email as you type;
 *  - click a person (or press Enter on them) to open your 1:1 DM with them — the same DM every time;
 *  - tick two or more people to start a group (the server reopens an unnamed group with exactly
 *    those people instead of making a duplicate);
 *  - Escape, the close button or a click outside closes it; the search and picks start fresh next time.
 *
 * onStartDM(person)  — open the 1:1 DM ({ _id, username, name, ... }).
 * onStartedGroup(dm) — a group was started or reopened ({ id, created, ... }).
 */
export default function NewMessageDialog({ open, onClose, workspaceId, currentUserId, onStartDM, onStartedGroup }) {
    const [query, setQuery] = useState('');
    const [picked, setPicked] = useState([]);
    const [active, setActive] = useState(0);
    const { list, loading, error } = useWorkspaceRecipients(workspaceId, currentUserId, open);
    const results = useMemo(() => filterRecipients(list, query), [list, query]);
    const pickedIds = useMemo(() => new Set(picked.map((p) => p._id)), [picked]);

    // Every opening starts fresh.
    useEffect(() => {
        if (!open) return;
        setQuery('');
        setPicked([]);
        setActive(0);
    }, [open]);
    useEffect(() => { setActive(0); }, [query]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const choose = (person) => (picked.length ? setPicked((p) => togglePicked(p, person)) : onStartDM?.(person));
    const onInputKey = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
    };

    const roleBadge = (role) => (role && role !== 'member' ? (
        <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', color: 'var(--accent)', borderRadius: '2px', flexShrink: 0, textTransform: 'capitalize' }}>{role}</span>
    ) : null);

    return (
        <div
            data-testid="new-message-dialog"
            style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font)' }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div role="dialog" aria-modal="true" aria-label="New message" className="anim-pop-in" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', width: 'min(460px, calc(100vw - 32px))', maxHeight: 'min(580px, calc(100dvh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>New message</h3>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Click a person to message them, or tick two or more for a group</p>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose}
                        style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '2px' }}>
                        <X size={15} />
                    </button>
                </div>

                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            type="search"
                            placeholder="Search by name or email…"
                            aria-label="Search people"
                            aria-controls="new-message-results"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onInputKey}
                            autoFocus
                            autoComplete="off"
                            style={{ width: '100%', padding: '8px 10px 8px 32px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font)', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div id="new-message-results" role="listbox" aria-label="People" style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }} className="custom-scrollbar">
                    {loading && list.length === 0 ? (
                        <p style={{ padding: '40px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Loading people…</p>
                    ) : error && list.length === 0 ? (
                        <p role="alert" style={{ padding: '40px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--state-danger)', margin: 0 }}>{error}</p>
                    ) : results.length === 0 ? (
                        <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>{query.trim() ? `No one matches “${query.trim()}”` : 'No one else is in this workspace yet'}</p>
                            {query.trim() && <p style={{ fontSize: '11px', margin: '4px 0 0' }}>Search by name, username or email. Only members of this workspace can be messaged.</p>}
                        </div>
                    ) : (
                        <div style={{ padding: '0 6px' }}>
                            <div style={{ padding: '4px 8px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                {query.trim() ? `${results.length} ${results.length === 1 ? 'person' : 'people'}` : 'Workspace members'}
                            </div>
                            {results.map((person, i) => {
                                const isPicked = pickedIds.has(person._id);
                                const isOnline = person.status === 'online';
                                return (
                                    <div
                                        key={person._id}
                                        role="option"
                                        aria-selected={i === active}
                                        data-testid="recipient-row"
                                        onClick={() => choose(person)}
                                        onMouseEnter={() => setActive(i)}
                                        className="group"
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '2px', cursor: 'pointer', background: i === active ? 'var(--bg-hover)' : 'none' }}
                                    >
                                        <div style={{ position: 'relative', flexShrink: 0 }}>
                                            <img
                                                src={getAvatarUrl({ ...person, username: person.username || person.name })} alt=""
                                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)' }}
                                                onError={(e) => { e.target.src = getAvatarUrl({ username: person.name }); }}
                                            />
                                            <span style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? 'var(--state-success)' : 'var(--border-default)', border: '1.5px solid var(--bg-surface)' }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</span>
                                                {person.username && person.username !== person.name && (
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>@{person.username}</span>
                                                )}
                                                {roleBadge(person.role)}
                                            </div>
                                            {person.email && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{person.email}</div>
                                            )}
                                        </div>
                                        {!picked.length && (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onStartDM?.(person); }}
                                                aria-label={`Message ${person.name}`}
                                                className="group-hover:opacity-100"
                                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', cursor: 'pointer', fontFamily: 'var(--font)', opacity: i === active ? 1 : 0 }}
                                            >
                                                <MessageSquare size={11} /> Message
                                            </button>
                                        )}
                                        <GroupPickToggle on={isPicked} name={person.name} onToggle={() => setPicked((p) => togglePicked(p, person))} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <GroupStartBar
                    workspaceId={workspaceId}
                    selected={picked}
                    onClear={() => setPicked([])}
                    onStarted={(dm) => onStartedGroup?.(dm)}
                />
            </div>
        </div>
    );
}
