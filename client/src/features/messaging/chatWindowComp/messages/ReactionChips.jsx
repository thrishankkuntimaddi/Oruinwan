import React, { useMemo, useRef, useState } from 'react';

const idOf = (u) => (u?._id || u?.id || u)?.toString();

/** "you", "Asha and you", "Asha, Ravi and 3 others" — who reacted, in plain words. */
export function reactorsText(names) {
    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

/**
 * Group reactions by emoji, with each person's name. `nameOf(id)` fills in names the
 * message doesn't carry (older servers send only ids); I am always "you", listed last.
 */
export function groupReactions(reactions, currentUserId, nameOf) {
    const me = idOf(currentUserId);
    const groups = new Map();
    for (const r of reactions || []) {
        if (!r?.emoji) continue;
        const uid = idOf(r.userId || r.user);
        if (!groups.has(r.emoji)) groups.set(r.emoji, { emoji: r.emoji, ids: [], names: [], mine: false });
        const g = groups.get(r.emoji);
        if (!uid || g.ids.includes(uid)) continue;
        g.ids.push(uid);
        if (uid === me) g.mine = true;
        else g.names.push(r.userId?.username || nameOf?.(uid) || 'Someone');
    }
    return [...groups.values()].map((g) => ({ ...g, names: g.mine ? [...g.names, 'you'] : g.names }));
}

/**
 * The reactions under a message: one chip per emoji with its count. Hovering (or a long press
 * on touch screens, or keyboard focus) shows who reacted; a click adds or removes mine.
 */
export default function ReactionChips({ reactions, currentUserId, onToggle, nameOf }) {
    const groups = useMemo(() => groupReactions(reactions, currentUserId, nameOf), [reactions, currentUserId, nameOf]);
    const [open, setOpen] = useState(null);
    const pressTimer = useRef(null);
    const longPressed = useRef(false);
    if (!groups.length) return null;

    const startPress = (emoji) => {
        longPressed.current = false;
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => { longPressed.current = true; setOpen(emoji); }, 450);
    };
    const endPress = () => clearTimeout(pressTimer.current);

    return (
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }} data-testid="reaction-chips">
            {groups.map((g) => {
                const who = `${reactorsText(g.names)} reacted with ${g.emoji}`;
                return (
                    <span key={g.emoji} style={{ position: 'relative', display: 'inline-flex' }}
                        onMouseEnter={() => setOpen(g.emoji)} onMouseLeave={() => setOpen((o) => (o === g.emoji ? null : o))}>
                        <button
                            type="button"
                            data-testid="reaction-chip"
                            aria-label={`${g.emoji} ${g.ids.length}. ${who}`}
                            aria-pressed={g.mine}
                            onClick={() => { if (longPressed.current) { longPressed.current = false; return; } onToggle?.(g.emoji, g.mine); }}
                            onFocus={() => setOpen(g.emoji)}
                            onBlur={() => setOpen((o) => (o === g.emoji ? null : o))}
                            onTouchStart={() => startPress(g.emoji)}
                            onTouchEnd={endPress}
                            onTouchMove={endPress}
                            style={{
                                padding: '1px 7px', borderRadius: '99px', fontSize: '13px', fontFamily: 'var(--font)',
                                backgroundColor: g.mine ? 'rgba(184,149,106,0.15)' : 'var(--bg-active)',
                                border: `1px solid ${g.mine ? 'var(--accent)' : 'var(--border-default)'}`,
                                color: g.mine ? 'var(--accent)' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: '120ms ease', outline: 'none',
                            }}
                        >
                            {g.emoji} {g.ids.length}
                        </button>
                        {open === g.emoji && (
                            <span role="tooltip" data-testid="reaction-who" style={{
                                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 30,
                                minWidth: 140, maxWidth: 260, padding: '6px 9px', borderRadius: 'var(--gl-radius-md, 7px)',
                                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                boxShadow: 'var(--card-shadow, 0 4px 14px rgba(0,0,0,0.12))',
                                color: 'var(--text-primary)', fontSize: '12px', lineHeight: 1.4, whiteSpace: 'normal', pointerEvents: 'none',
                            }}>
                                <span style={{ fontSize: '16px', marginRight: 6 }} aria-hidden="true">{g.emoji}</span>
                                {who}
                            </span>
                        )}
                    </span>
                );
            })}
        </div>
    );
}
