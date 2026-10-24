import React from 'react';
import { AlertTriangle, CalendarCheck } from 'lucide-react';
import { conflictLines, conflictSuggestions } from '../../utils/meetingConflicts';
import { formatSlot } from '../../utils/meetingSlots';

/**
 * The schedule dialog's clash warning: who is busy at the picked time (with the other meeting's
 * priority), and free times as chips. Scheduling anyway stays possible; this only informs.
 */
export default function ConflictWarning({ result, loading = false, nameOf, onPick }) {
    const lines = conflictLines(result, { nameOf });
    const slots = conflictSuggestions(result);
    if (!lines.length) {
        if (loading) return <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }} aria-live="polite">Checking calendars…</p>;
        if (result && !result.hasConflicts) {
            return (
                <p data-testid="conflict-free" style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }} aria-live="polite">
                    <CalendarCheck size={12} aria-hidden="true" /> Everyone is free then.
                </p>
            );
        }
        return null;
    }
    return (
        <div role="alert" data-testid="conflict-warning" style={{
            display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 2,
            border: '1px solid color-mix(in srgb, var(--color-warning) 45%, transparent)', background: 'var(--bg-active)',
        }}>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                <AlertTriangle size={13} style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
                {lines.length === 1 ? 'This time clashes' : `${lines.length} clashes at this time`}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                {lines.map((l) => <li key={l.key}>{l.text}</li>)}
            </ul>
            {slots.length > 0 && (
                <>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>Everyone is free at:</p>
                    <div className="gl-x-chips gl-x-chips--wrap" role="group" aria-label="Free times">
                        {slots.map((s) => (
                            <button key={s.start.getTime()} type="button" className="gl-x-chip gl-x-chip--lg" onClick={() => onPick?.(s)}>
                                {formatSlot(s)}
                            </button>
                        ))}
                    </div>
                </>
            )}
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>You can still schedule it: invitees see the clash and both priorities.</p>
        </div>
    );
}
