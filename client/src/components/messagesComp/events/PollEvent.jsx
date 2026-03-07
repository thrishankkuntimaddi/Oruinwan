// client/src/components/messagesComp/events/PollEvent.jsx
// Phase 7.3: renders a poll event using the embedded msg.poll subdoc —
// no separate network fetch needed.

import React from 'react';
import PollMessage from '../chatWindowComp/messages/types/PollMessage';

/**
 * Renders a poll event from the conversation stream.
 * event.poll (or event.payload.poll) is the embedded poll subdoc.
 */
function PollEvent({ event, currentUserId }) {
    // Normalise: poll events may arrive with data at top level or inside payload
    const pollMsg = {
        _id: event._id || event.id,
        id: event._id || event.id,
        type: 'poll',
        poll: event.poll || event.payload?.poll || null,
        sender: event.sender || event.payload?.sender || {},
        createdAt: event.createdAt || event.payload?.createdAt,
    };

    return (
        <div className="my-1 px-4">
            <PollMessage msg={pollMsg} currentUserId={currentUserId} />
        </div>
    );
}

export default PollEvent;
