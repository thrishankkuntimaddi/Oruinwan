import React from 'react';
import CreatePollModal from '../modals/CreatePollModal.jsx';
import MemberListModal from '../modals/MemberListModal.jsx';
import ContactInfoModal from '../modals/contactInfoModal.jsx';
import ChannelManagementModal from '../../ChannelManagementModal.jsx';
import ForwardMessageModal from '../modals/ForwardMessageModal.jsx';
import MessageInfoModal from '../modals/MessageInfoModal.jsx';

export default function ModalRenderer({ activeModal, onClose, modalProps }) {
    if (!activeModal) return null;

    const {
        
        onCreate,
        channelId,

        
        members,
        channelName,
        currentUserId,

        
        contact,

        
        channel,
        workspaceId,
        initialTab,

        
        currentChatId,
        currentChatType,
        onForward,

        
        messageInfoData,
    } = modalProps || {};

    switch (activeModal) {
        case 'poll':
            return (
                <CreatePollModal
                    isOpen={true}
                    onClose={onClose}
                    onCreatePoll={onCreate}
                    channelName={channelName || ''}
                />
            );

        case 'forward':
            return (
                <ForwardMessageModal
                    onClose={onClose}
                    onForward={onForward}
                    currentChatId={currentChatId}
                    currentChatType={currentChatType}
                />
            );

        case 'message-info':
            return (
                <MessageInfoModal
                    msg={messageInfoData?.message}
                    members={messageInfoData?.members || []}
                    readBy={messageInfoData?.readBy || []}
                    currentUserId={currentUserId}
                    onClose={onClose}
                />
            );

        case 'members':
            return (
                <MemberListModal
                    isOpen={true}
                    onClose={onClose}
                    members={members || []}
                    channelName={channelName}
                    currentUserId={currentUserId}
                />
            );

        case 'contact':
            return (
                <ContactInfoModal
                    isOpen={true}
                    onClose={onClose}
                    contact={contact}
                    currentUserId={currentUserId}
                />
            );

        case 'channel-settings':
        case 'channel-members':
        case 'channel-invite':
            return (
                <ChannelManagementModal
                    channel={{
                        ...channel,
                        id: channel?.id || channel?._id,
                        workspaceId: workspaceId || channel?.workspaceId
                    }}
                    onClose={onClose}
                    currentUserId={currentUserId}
                    initialTab={initialTab || activeModal.replace('channel-', '')}
                />
            );

        default:
            console.warn(`Unknown modal type: ${activeModal}`);
            return null;
    }
}
