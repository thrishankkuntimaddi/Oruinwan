import { HISTORY_OPTIONS } from './groupDmApi';

/** Picks how much history people added to a group get ("From now on" or "Include earlier messages"). */
export default function HistoryChoice({ value, onChange, compact = false }) {
    return (
        <div role="radiogroup" aria-label="What they can see" data-testid="history-choice"
            style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: compact ? '12px' : '6px', flexWrap: 'wrap' }}>
            {HISTORY_OPTIONS.map((o) => {
                const on = o.value === value;
                return (
                    <label key={o.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', padding: compact ? 0 : '6px 8px', border: compact ? 'none' : `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`, borderRadius: '2px' }}>
                        <input type="radio" name="group-history" value={o.value} checked={on} onChange={() => onChange(o.value)} style={{ marginTop: '2px' }} />
                        <span>
                            <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{o.title}</span>
                            {!compact && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>{o.body}</span>}
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
