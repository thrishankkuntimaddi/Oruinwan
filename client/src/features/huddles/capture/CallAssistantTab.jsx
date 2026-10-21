import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import useCallTranscript from './useCallTranscript';
import MeetingAssistant from './MeetingAssistant';

/** Huddle workspace tab: the AI assistant over the call's transcript. */
export default function CallAssistantTab({ call, session, live, workspaceId, title, people = [] }) {
    const { cap, target, segments, loading, error } = useCallTranscript(call, session, live);
    const names = useMemo(() => Object.fromEntries(people.map((p) => [String(p.id), p.username])), [people]);
    if (!call) return null;
    if (loading) return <p className="hw-muted"><Loader2 size={12} className="animate-spin" /> Loading transcript…</p>;
    return (
        <>
            {error && <p className="hw-error">{error}</p>}
            <MeetingAssistant
                key={target ? `${target.kind}:${target.id}` : 'none'}
                segments={segments}
                target={target}
                workspaceId={workspaceId}
                title={title}
                myId={cap?.me?.id}
                ended={!live}
                names={names}
            />
        </>
    );
}
