import React from 'react';
import PollCreationModal from '../modals/PollCreationModal.jsx';
import MemberListModal from '../modals/MemberListModal.jsx';
import ContactInfoModal from '../modals/contactInfoModal.jsx';
import ChannelManagementModal from '../../ChannelManagementModal.jsx';
import ForwardMessageModal from '../modals/ForwardMessageModal.jsx';

/**
 * Consolidated modal renderer component
 * Renders appropriate modal based on activeModal state
 * @param {string} activeModal - Type of modal to display ('poll', 'members', 'contact', 'channel-settings', etc.)
 * @param {function} onClose - Close modal callback
 * @param {object} modalProps - Props specific to the active modal
 */
export default function ModalRenderer({ activeModal, onClose, modalProps }) {
    if (!activeModal) return null;

    const {
        // Poll creation props
        onCreate,
        channelId,

        // Member list props
        members,
        channelName,
        currentUserId,

        // Contact info props
        contact,

        // Channel management props
        channel,
        workspaceId,
        initialTab,

        // Forward message props
        currentChatId,
        currentChatType,
        onForward,
    } = modalProps || {};

    switch (activeModal) {
        case 'poll':
            return (
                <PollCreationModal
                    isOpen={true}
                    onClose={onClose}
                    onCreate={onCreate}
                    channelId={channelId}
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
