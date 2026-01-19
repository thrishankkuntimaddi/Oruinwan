// client/src/components/messagesComp/chatWindowComp/footer/Footer.jsx
// Simple wrapper for footerInput component

import React from 'react';
import FooterInput from './footerInput';

/**
 * Footer component for ChatWindowV2
 * Wraps the existing footerInput component with new ChatWindowV2 API
 */
function Footer({
    onSendMessage,
    onTyping,
    replyingTo,
    onCancelReply,
    conversationType,
    contacts
}) {
    return (
        <FooterInput
            onSendMessage={onSendMessage}
            onTyping={onTyping}
            replyingTo={replyingTo}
            onCancelReply={onCancelReply}
            conversationType={conversationType}
            contacts={contacts}
        />
    );
}

export default Footer;
