import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { suggestMeetingTime } from '../../hooks/useMeeting';
import { normalizeTimeSuggestions, suggestionNote, formatSlot, slotFit } from '../../utils/meetingSlots';

/**
 * "Find a time" for the schedule dialog: asks the server for open slots for the picked
 * people and duration, shows them as chips, and hands the chosen one to onPick({ start, end }).
 */
export default function FindTimeSlots({ participantIds = [], durationMinutes = 30, onPick, suggest = suggestMeetingTime }) {
    const [state, setState] = useState({ status: 'idle', slots: [], note: '', error: '' });
    const [picked, setPicked] = useState(null);

    const find = async () => {
        setState(s => ({ ...s, status: 'loading', error: '' }));
        setPicked(null);
        try {
            const data = await suggest(participantIds, Number(durationMinutes) || 30);
            const slots = normalizeTimeSuggestions(data, { durationMinutes });
            setState({ status: 'ready', slots, note: suggestionNote(data), error: '' });
        } catch (err) {
            setState({ status: 'error', slots: [], note: '', error: err?.response?.data?.message || 'Could not find a time. Pick one yourself.' });
        }
    };

    const pick = (slot) => {
        setPicked(slot.start.getTime());
        onPick?.(slot);
    };

    return (
        <div data-testid="find-a-time" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="gl-btn gl-btn--sm gl-btn--ghost" onClick={find}
                    disabled={state.status === 'loading'} aria-busy={state.status === 'loading'}>
                    <Sparkles size={12} aria-hidden="true" />
                    {state.status === 'loading' ? 'Finding a time…' : state.status === 'ready' ? 'Find again' : 'Find a time'}
                </button>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {participantIds.length ? `For you and ${participantIds.length} ${participantIds.length === 1 ? 'person' : 'people'}` : 'For your calendar'}
                </span>
            </div>
            {state.status === 'ready' && state.slots.length > 0 && (
                <div className="gl-x-chips gl-x-chips--wrap" role="group" aria-label="Suggested times">
                    {state.slots.map(slot => {
                        const fit = slotFit(slot.score);
                        return (
                            <button key={slot.start.getTime()} type="button" className="gl-x-chip gl-x-chip--lg"
                                aria-pressed={picked === slot.start.getTime()} onClick={() => pick(slot)}
                                title={fit || undefined}>
                                {formatSlot(slot)}{fit && <span style={{ opacity: 0.7 }}>· {fit}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
            {state.status === 'ready' && state.slots.length === 0 && (
                <p role="status" style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>No open slot found soon. Pick a time yourself.</p>
            )}
            {state.status === 'ready' && state.note && state.slots.length > 0 && (
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{state.note}</p>
            )}
            {state.status === 'error' && (
                <p role="alert" style={{ margin: 0, fontSize: 11, color: 'var(--state-danger)' }}>{state.error}</p>
            )}
        </div>
    );
}
