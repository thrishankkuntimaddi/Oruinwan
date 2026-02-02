// client/src/modules/chat/components/index.js
/**
 * Chat Module Components - Public API
 * 
 * Export all chat components for easy importing
 */

// Re-export as default for backward compatibility
import { ChatWindow } from './ChatWindow';

export { ChatWindow } from './ChatWindow';
export { MessageList } from './MessageList';
export default ChatWindow;
