import { ProfileTrigger } from '../../../features/profileCard/ProfileTrigger';

const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** People matching the "@…" being typed in the AI composer. */
export function AIMentionMenu({ items, activeIndex = 0, onPick, onHover }) {
    if (!items?.length) return null;
    return (
        <div role="listbox" aria-label="Mention a person" data-testid="ai-mention-menu"
            style={{ marginBottom: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', overflow: 'hidden' }}>
            {items.map((p, i) => (
                <button key={p.id} type="button" role="option" aria-selected={i === activeIndex} data-testid="ai-mention-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => onHover?.(i)}
                    onClick={() => onPick(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 10px', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font)', background: i === activeIndex ? 'var(--bg-active)' : 'transparent', color: 'var(--text-primary)' }}>
                    {p.profilePicture ? (
                        <img src={p.profilePicture} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                        <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-accent)' }}>{initials(p.name)}</span>
                    )}
                    <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>@{p.username}</span>
                    </span>
                </button>
            ))}
        </div>
    );
}

const chipStyle = { display: 'inline-flex', alignItems: 'center', padding: '0 5px', borderRadius: '2px', fontWeight: 600, background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--border-accent)', cursor: 'pointer' };

/** A mentioned person as a chip; opens their profile card (with Message, Mention…). */
export function PersonChip({ person, children }) {
    return (
        <ProfileTrigger userId={person.id} username={person.username} label={`Show profile of ${person.name}`} style={chipStyle} className="ai-person-chip">
            <span data-testid="ai-person-chip">{children || `@${person.username}`}</span>
        </ProfileTrigger>
    );
}

/** Message text with each "@username" of a mentioned person shown as a person chip. */
export function MentionText({ text, people }) {
    const list = (people || []).filter((p) => p?.username);
    if (!list.length) return text;
    const byName = new Map(list.map((p) => [p.username.toLowerCase(), p]));
    const escaped = list.map((p) => p.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const parts = String(text || '').split(new RegExp(`(@(?:${escaped}))(?![\\w-])`, 'gi'));
    return parts.map((part, i) => {
        const person = part.startsWith('@') ? byName.get(part.slice(1).toLowerCase()) : null;
        return person ? <PersonChip key={i} person={person}>{part}</PersonChip> : part;
    });
}

export default AIMentionMenu;
