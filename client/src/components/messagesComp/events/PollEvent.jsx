// client/src/components/messagesComp/events/PollEvent.jsx
// Wrapper for poll type events - reuses existing PollCard component

import React from 'react';
import PollCard from '../chatWindowComp/messages/PollCard';

/**
 * Renders a poll event
 * @param {object} event - Poll event
 * @param {object} actions - Message actions (not used for polls currently)
 * @param {string} currentUserId - Current user's ID
 */
function PollEvent({ event, actions, currentUserId }) {
    const message = event.payload;

    // PollCard expects the message with pollId populated
    // The poll data should be in the message.pollId field

    return (
        <div className="poll-event" style={{ margin: '0.5rem 0' }}>
            <PollCard message={message} currentUserId={currentUserId} />
        </div>
    );
}

export default PollEvent;
