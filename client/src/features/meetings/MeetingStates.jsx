import React from 'react';
import { Lock, CalendarX, ArrowLeft } from 'lucide-react';
import { Btn, EmptyState, ErrorState, LoadingState } from '../../components/ui/page';

/**
 * Loading / no access / not found / error for a meeting, in the spot where the
 * meeting would be. Meetings in a channel or DM are limited to its members (403).
 */
export default function MeetingState({ loading, error, onBack, onRetry, backLabel = 'Back to Huddles' }) {
    if (loading) return <LoadingState label="Loading meeting…" />;
    if (!error) return null;
    const back = onBack ? <Btn icon={ArrowLeft} onClick={onBack}>{backLabel}</Btn> : null;
    if (error.kind === 'forbidden') {
        return (
            <div data-testid="meeting-no-access">
                <EmptyState icon={Lock} title="You don't have access to this meeting"
                    text="It belongs to a channel or conversation you are not a member of. Ask the organiser or a member to add you." action={back} />
            </div>
        );
    }
    if (error.kind === 'not_found') {
        return (
            <div data-testid="meeting-not-found">
                <EmptyState icon={CalendarX} title="Meeting not found" text="It may have been deleted, or the link is wrong." action={back} />
            </div>
        );
    }
    return <ErrorState title="Could not load the meeting" message={error.message} onRetry={onRetry} />;
}
