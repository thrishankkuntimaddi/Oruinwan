// client/src/components/messagesComp/chatWindowComp/ChatWindowUnified.jsx
// Unified wrapper that supports both old and new ChatWindow
// This enables gradual migration with feature flag

import React from 'react';
import ChatWindow from './chatWindow.jsx';
import ChatWindowV2 from './ChatWindowV2.jsx';

/**
 * Unified ChatWindow wrapper
 * @param {boolean} useV2 - Set to true to use new ChatWindowV2, false for old ChatWindow
 * @param {object} props - All other props passed through
 */
function ChatWindowUnified({ useV2 = false, ...props }) {
    // Feature flag: gradually enable new architecture
    const USE_NEW_ARCHITECTURE = useV2 || process.env.REACT_APP_USE_CHATWINDOW_V2 === 'true';

    if (USE_NEW_ARCHITECTURE) {
        // New event-based architecture
        return <ChatWindowV2 {...props} />;
    }

    // Old architecture (fallback)
    return <ChatWindow {...props} />;
}

export default ChatWindowUnified;
