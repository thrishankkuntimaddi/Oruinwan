import { useCallback } from 'react';

export default function useMessageInput({ setNewMessage, setShowEmoji }) {
    const handleMessageChange = useCallback((e) => {
        setNewMessage(e.target.value);
    }, [setNewMessage]);

    const handleEmojiPick = useCallback((emoji) => {
        setNewMessage(prev => prev + emoji);
        setShowEmoji(false);
    }, [setNewMessage, setShowEmoji]);

    const handleAttach = useCallback((file) => {
        
    }, []);

    return {
        handleMessageChange,
        handleEmojiPick,
        handleAttach
    };
}
