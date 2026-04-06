// client/src/components/messagesComp/events/PollEvent.jsx
// Phase 7.3: renders a poll event using the embedded msg.poll subdoc —
// no separate network fetch needed.

import React from 'react';
import PollMessage from '../chatWindowComp/messages/types/PollMessage';

/**
 * Renders a poll event from the conversation stream.
 * event.poll (or event.payload.poll) is the embedded poll subdoc.
 * event.sender has the poll creator's username.
 */
function PollEvent({ event, currentUserId }) {
    // Normalise: poll events may arrive with data at top level or inside payload or via backend
    const pollData = event.poll || event.backend?.poll || event.payload?.poll || null;

    const pollMsg = {
        _id: event._id || event.id,
        id: event._id || event.id,
        type: 'poll',
        poll: pollData,
        // Sender = poll creator (populated by backend)
        sender: event.sender || event.backend?.sender || event.payload?.sender || {},
        createdAt: event.createdAt || event.payload?.createdAt,
    };

    return (
        <div style={{ margin: '4px 0', padding: '0 16px' }}>
            <PollMessage msg={pollMsg} currentUserId={currentUserId} />
        </div>
    );
}

export default PollEvent;
