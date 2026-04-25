import React from 'react';
import FooterInput from './footerInput';

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
