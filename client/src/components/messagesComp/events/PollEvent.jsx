import React from 'react';
import PollMessage from '../chatWindowComp/messages/types/PollMessage';

function PollEvent({ event, currentUserId }) {
    
    const pollData = event.poll || event.backend?.poll || event.payload?.poll || null;

    const pollMsg = {
        _id: event._id || event.id,
        id: event._id || event.id,
        type: 'poll',
        poll: pollData,
        
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
