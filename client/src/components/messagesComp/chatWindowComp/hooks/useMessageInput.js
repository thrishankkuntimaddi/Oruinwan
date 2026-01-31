import { useCallback } from 'react';

/**
 * Custom hook for message input UI handlers
 * @param {function} setNewMessage - Set message state
 * @param {function} setShowEmoji - Set emoji picker visibility
 * @returns {object} Message input handlers
 */
export default function useMessageInput({ setNewMessage, setShowEmoji }) {
    const handleMessageChange = useCallback((e) => {
        setNewMessage(e.target.value);
    }, [setNewMessage]);

    const handleEmojiPick = useCallback((emoji) => {
        setNewMessage(prev => prev + emoji);
        setShowEmoji(false);
    }, [setNewMessage, setShowEmoji]);

    const handleAttach = useCallback((file) => {
        // TODO: Implement file upload
    }, []);

    return {
        handleMessageChange,
        handleEmojiPick,
        handleAttach
    };
}
