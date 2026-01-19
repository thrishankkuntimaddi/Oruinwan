// client/src/modules/chat/index.js
/**
 * Chat Module - Public API
 * 
 * Unified chat module with components, hooks, encryption, and primitives
 * 
 * @module chat
 */

// Components
export { ChatWindow, MessageList } from './components';

// Encryption
export { default as chatEncryption } from './encryption/chatEncryption';

// Primitives & Types
export * from './types/primitives';

// New Hooks (primitive-based)
export { useConversation } from './hooks/useConversation';
export { useRealtimeEvents } from './hooks/useRealtimeEvents';
export { useMessages } from './hooks/useMessages';

// Legacy hooks (re-export from shared hooks for backward compatibility)
export {
    useChatSocket,
    useMessageActions
} from '../../hooks';
