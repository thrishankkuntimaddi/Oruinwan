import React from "react";
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";

export default function DeleteChatDialog({ isOpen, onConfirm, onCancel }) {
    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onCancel}
            onConfirm={onConfirm}
            title="Delete this chat?"
            message="This will remove the chat from your list. The other person will still have access to the conversation. You can start a new chat anytime."
            confirmText="Delete"
            cancelText="Cancel"
            isDestructive={true}
        />
    );
}
