// client/src/modules/chat/components/index.js
/**
 * Chat Module Components - Public API
 * 
 * Export all chat components for easy importing
 */

export { ChatWindow } from './ChatWindow';
export { MessageList } from './MessageList';

// Re-export as default for backward compatibility
import { ChatWindow } from './ChatWindow';
export default ChatWindow;
