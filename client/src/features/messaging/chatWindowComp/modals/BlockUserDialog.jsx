import React from "react";
import ConfirmationModal from "../../../../shared/components/ui/ConfirmationModal";

export default function BlockUserDialog({ userName, isOpen, onConfirm, onCancel }) {
    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onCancel}
            onConfirm={onConfirm}
            title="Block this contact?"
            message={`${userName || "This user"} won't be able to send you direct messages. You can unblock them later.`}
            confirmText="Block"
            cancelText="Cancel"
            isDestructive={true}
        />
    );
}
