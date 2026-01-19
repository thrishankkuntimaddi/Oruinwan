// client/src/modules/chat/index.js
/**
 * Chat Module - Public API
 * 
 * Central export point for all chat module functionality
 */

// Components
export { ChatWindow, MessageList } from './components';

// Encryption
export { default as chatEncryption } from './encryption/chatEncryption';

// Hooks (re-export from shared hooks)
export {
    useChatSocket,
    useConversation,
    useMessageActions
} from '../../hooks';
