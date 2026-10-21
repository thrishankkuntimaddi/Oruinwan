import React from 'react';
import { Repeat } from 'lucide-react';
import {
    REPEAT_FREQUENCIES, WEEKDAYS, normalizeRule, describeRule, describeRecurring, isRecurring, dayValue,
} from '../../utils/taskRecurrence';
import { tint, FONT } from './taskUi';
import './tasks.css';

/**
 * Repeat picker for a task: frequency, interval, weekdays (weekly), unit
 * (custom) and an optional end date. Controlled: `value` is a picker rule
 * (utils/taskRecurrence), `onChange(rule)` gets the next one.
 */
export default function RepeatPicker({ value, onChange, dueDate = null, disabled = false, idPrefix = 'tk-repeat' }) {
    const r = normalizeRule(value);
    const set = (patch) => onChange(normalizeRule({ ...r, ...patch }));
    const off = r.frequency === 'none';

    const pickFrequency = (frequency) => {
        const patch = { frequency };
        // Weekly starts on the due date's weekday, so "Weekly" means what it says.
        if (frequency === 'weekly' && r.daysOfWeek.length === 0) {
            const anchor = dayValue(dueDate) ?? dayValue(new Date());
            patch.daysOfWeek = [new Date(anchor).getUTCDay()];
        }
        if (frequency !== r.frequency) patch.interval = 1;
        set(patch);
    };
    const toggleDay = (d) => {
        const next = r.daysOfWeek.includes(d) ? r.daysOfWeek.filter((x) => x !== d) : [...r.daysOfWeek, d];
        set({ daysOfWeek: next });
    };

    return (
        <div className="tasks-ui" style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: FONT }}>
            <select id={`${idPrefix}-freq`} className="tk-field" aria-label="Repeat" value={r.frequency} disabled={disabled}
                onChange={(e) => pickFrequency(e.target.value)}>
                {REPEAT_FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>

            {(r.frequency === 'weekly' || r.frequency === 'monthly' || r.frequency === 'custom') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>Every</span>
                    <input type="number" min={1} max={365} className="tk-field" aria-label="Repeat interval" disabled={disabled}
                        value={r.interval} onChange={(e) => set({ interval: e.target.value })} style={{ width: '64px' }} />
                    {r.frequency === 'custom' ? (
                        <select className="tk-field" aria-label="Repeat unit" value={r.unit} disabled={disabled}
                            onChange={(e) => set({ unit: e.target.value })} style={{ width: 'auto', flex: 1 }}>
                            <option value="day">{r.interval === 1 ? 'day' : 'days'}</option>
                            <option value="week">{r.interval === 1 ? 'week' : 'weeks'}</option>
                            <option value="month">{r.interval === 1 ? 'month' : 'months'}</option>
                        </select>
                    ) : <span>{r.frequency === 'weekly' ? (r.interval === 1 ? 'week' : 'weeks') : (r.interval === 1 ? 'month' : 'months')}</span>}
                </div>
            )}

            {r.frequency === 'weekly' && (
                <div role="group" aria-label="Repeat on" style={{ display: 'flex', gap: '3px' }}>
                    {WEEKDAYS.map((d) => {
                        const on = r.daysOfWeek.includes(d.id);
                        return (
                            <button key={d.id} type="button" aria-pressed={on} aria-label={d.label} title={d.label} disabled={disabled}
                                onClick={() => toggleDay(d.id)}
                                style={{
                                    flex: 1, minWidth: 0, height: '26px', padding: 0, borderRadius: '2px', fontSize: '11px', fontWeight: 700, fontFamily: FONT,
                                    cursor: disabled ? 'default' : 'pointer',
                                    background: on ? 'var(--accent-dim)' : 'transparent',
                                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border-default)'}`,
                                    color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                                }}>
                                {d.short}
                            </button>
                        );
                    })}
                </div>
            )}

            {!off && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Ends (optional)
                    <input id={`${idPrefix}-end`} type="date" className="tk-field" aria-label="Repeat end date" disabled={disabled}
                        value={r.endDate} max="2100-12-31" onChange={(e) => set({ endDate: e.target.value })} />
                </label>
            )}

            {!off && (
                <p data-testid="repeat-summary" style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Repeat size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} /> {describeRule(r)}
                </p>
            )}
        </div>
    );
}

/** Small "repeats" chip for list rows, cards and panel headers. Renders nothing for one-off tasks. */
export function RepeatBadge({ task, recurring, compact = false }) {
    const rec = recurring || task?.recurring;
    if (!isRecurring({ recurring: rec })) return null;
    const text = describeRecurring(rec);
    return (
        <span data-testid="repeat-badge" title={text} aria-label={`Repeats: ${text}`}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px', padding: compact ? '0 4px' : '1px 6px', borderRadius: '2px',
                fontSize: '10px', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                color: 'var(--text-primary)', background: 'var(--accent-dim)', border: `1px solid ${tint('var(--accent)', 30)}`,
            }}>
            <Repeat size={9} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            {compact ? 'Repeats' : text}
        </span>
    );
}
