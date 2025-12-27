import { useState } from "react";
import { blockUser, unblockUser, muteDM, deleteDM } from "../../../../services/contactService";

export const useContactOptions = (chat, showToast, onClose) => {
    const [showBlockDialog, setShowBlockDialog] = useState(false);
    const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    const handleMuteToggle = async (muted) => {
        try {
            await muteDM(chat.id, muted);
            setIsMuted(muted);
            showToast?.(muted ? "Notifications muted" : "Notifications unmuted", "success");
        } catch (err) {
            console.error("Mute error:", err);
            showToast?.("Failed to update notification settings", "error");
        }
    };

    const handleBlockUser = () => setShowBlockDialog(true);

    const confirmBlockUser = async () => {
        try {
            if (isBlocked) {
                await unblockUser(chat.id);
                setIsBlocked(false);
                showToast?.("User unblocked", "success");
            } else {
                await blockUser(chat.id);
                setIsBlocked(true);
                showToast?.("User blocked", "success");
            }
            setShowBlockDialog(false);
        } catch (err) {
            console.error("Block error:", err);
            showToast?.("Failed to update block status", "error");
        }
    };

    const handleDeleteChat = () => setShowDeleteChatDialog(true);

    const confirmDeleteChat = async () => {
        try {
            await deleteDM(chat.id);
            showToast?.("Chat deleted", "success");
            setShowDeleteChatDialog(false);
            onClose?.();
        } catch (err) {
            console.error("Delete chat error:", err);
            showToast?.("Failed to delete chat", "error");
        }
    };

    return {
        showBlockDialog, setShowBlockDialog, showDeleteChatDialog, setShowDeleteChatDialog,
        isMuted, isBlocked, handleMuteToggle, handleBlockUser, confirmBlockUser,
        handleDeleteChat, confirmDeleteChat
    };
};
