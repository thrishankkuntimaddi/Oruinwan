/**
 * Chat Module - Core Primitives
 * 
 * The 3 fundamental types that all chat features build upon:
 * 1. Conversation - A context for communication
 * 2. Message - Content within a conversation
 * 3. RealtimeEvent - Live updates and state changes
 * 
 * @module chat/types/primitives
 */

// ============================================================
// PRIMITIVE 1: CONVERSATION
// ============================================================

/**
 * Conversation - A context for communication
 * 
 * This primitive represents ANY place where messages can be sent:
 * - Channel (public/private workspace channel)
 * - DM (direct message between 2 users)
 * - Thread (reply chain to a message)
 * 
 * @typedef {Object} Conversation
 * @property {string} id - Unique identifier (channelId, dmId, or parentMessageId for threads)
 * @property {'channel'|'dm'|'thread'} type - Type of conversation
 * @property {string} workspaceId - Workspace this conversation belongs to
 * @property {ConversationMetadata} metadata - Type-specific metadata
 * @property {Date} lastActivity - Last message or event timestamp
 * @property {number} unreadCount - Number of unread messages
 * @property {boolean} isEncrypted - Whether E2EE is enabled
 */

/**
 * Type-specific metadata for conversations
 * 
 * @typedef {Object} ConversationMetadata
 * @property {string} [name] - Channel name (for channels)
 * @property {string} [description] - Channel description (for channels)
 * @property {User} [otherUser] - The other participant (for DMs)
 * @property {Message} [parentMessage] - Original message (for threads)
 * @property {string[]} [members] - Member IDs (for channels)
 * @property {boolean} [isPrivate] - Whether channel is private
 */

// ============================================================
// PRIMITIVE 2: MESSAGE
// ============================================================

/**
 * Message - Content sent within a conversation
 * 
 * This primitive represents ANY content in a conversation:
 * - Text messages (plain or encrypted)
 * - System messages (user joined, etc.)
 * - Rich content (polls, embeds)
 * - File attachments
 * 
 * @typedef {Object} Message
 * @property {string} id - Unique message ID
 * @property {string} conversationId - Parent conversation ID
 * @property {User} sender - Message author
 * @property {MessageContent} content - Message payload
 * @property {'text'|'encrypted'|'system'|'poll'|'file'} contentType - Type of content
 * @property {Date} timestamp - When message was sent
 * @property {MessageMetadata} metadata - Additional data (replies, reactions, etc.)
 * @property {boolean} isEncrypted - Whether message is E2EE encrypted
 * @property {string} [ciphertext] - Encrypted content (if isEncrypted)
 * @property {string} [messageIv] - Encryption IV (if isEncrypted)
 * @property {string} [encryptionVersion] - E2EE version (e.g., 'aes-256-gcm-v1')
 */

/**
 * Message content payload
 * 
 * @typedef {Object} MessageContent
 * @property {string} [text] - Plain text (empty if encrypted)
 * @property {Attachment[]} [attachments] - File attachments
 * @property {Poll} [poll] - Poll data (if contentType is 'poll')
 * @property {string} [systemMessage] - System message text
 */

/**
 * Message metadata
 * 
 * @typedef {Object} MessageMetadata
 * @property {string} [parentId] - Parent message ID (for threads/replies)
 * @property {number} replyCount - Number of replies
 * @property {Reaction[]} reactions - Message reactions
 * @property {boolean} isEdited - Whether message was edited
 * @property {Date} [editedAt] - Last edit timestamp
 * @property {string[]} readBy - User IDs who read this message
 */

/**
 * File attachment
 * 
 * @typedef {Object} Attachment
 * @property {string} id - Attachment ID
 * @property {string} filename - Original filename
 * @property {string} url - Download URL
 * @property {string} mimeType - MIME type
 * @property {number} size - Size in bytes
 * @property {AttachmentMetadata} [metadata] - Type-specific metadata
 */

/**
 * Attachment metadata (for images, videos, etc.)
 * 
 * @typedef {Object} AttachmentMetadata
 * @property {number} [width] - Image/video width
 * @property {number} [height] - Image/video height
 * @property {number} [duration] - Video/audio duration (seconds)
 * @property {string} [thumbnail] - Thumbnail URL
 */

/**
 * Message reaction
 * 
 * @typedef {Object} Reaction
 * @property {string} emoji - Emoji used
 * @property {string[]} users - User IDs who reacted
 * @property {number} count - Number of reactions
 */

// ============================================================
// PRIMITIVE 3: REALTIME EVENT
// ============================================================

/**
 * RealtimeEvent - Live updates and state changes
 * 
 * This primitive represents any real-time activity:
 * - User typing
 * - User presence (online/offline/away)
 * - Message updates (edited, deleted)
 * - Conversation state changes
 * 
 * @typedef {Object} RealtimeEvent
 * @property {string} type - Event type
 * @property {string} conversationId - Context for this event
 * @property {string} userId - User who triggered the event
 * @property {Object} payload - Event-specific data
 * @property {Date} timestamp - When event occurred
 */

/**
 * Typing indicator event
 * 
 * @typedef {Object} TypingEvent
 * @property {'typing'} type
 * @property {string} conversationId
 * @property {string} userId
 * @property {boolean} isTyping - true = started typing, false = stopped
 * @property {Date} timestamp
 */

/**
 * Presence event
 * 
 * @typedef {Object} PresenceEvent
 * @property {'presence'} type
 * @property {string} userId
 * @property {'online'|'away'|'busy'|'offline'} status
 * @property {string} [customStatus] - Custom status message
 * @property {Date} timestamp
 */

/**
 * Message update event (edit/delete)
 * 
 * @typedef {Object} MessageUpdateEvent
 * @property {'message_edit'|'message_delete'} type
 * @property {string} conversationId
 * @property {string} messageId
 * @property {string} userId
 * @property {Object} payload
 * @property {string} [payload.newText] - Updated text (for edits)
 * @property {Date} timestamp
 */

/**
 * Conversation state event
 * 
 * @typedef {Object} ConversationStateEvent
 * @property {'member_joined'|'member_left'|'name_changed'|'archived'} type
 * @property {string} conversationId
 * @property {string} userId
 * @property {Object} payload
 * @property {Date} timestamp
 */

// ============================================================
// SUPPORTING TYPES
// ============================================================

/**
 * User object
 * 
 * @typedef {Object} User
 * @property {string} _id - User ID
 * @property {string} username - Display name
 * @property {string} [email] - Email address
 * @property {string} [profilePicture] - Avatar URL
 * @property {boolean} [isOnline] - Online status
 * @property {'online'|'away'|'busy'|'offline'} [userStatus] - Presence status
 */

/**
 * Poll data
 * 
 * @typedef {Object} Poll
 * @property {string} _id - Poll ID
 * @property {string} question - Poll question
 * @property {PollOption[]} options - Poll options
 * @property {User} createdBy - Poll creator
 * @property {boolean} closed - Whether poll is closed
 * @property {Date} expiresAt - Expiration timestamp
 */

/**
 * Poll option
 * 
 * @typedef {Object} PollOption
 * @property {string} id - Option ID
 * @property {string} text - Option text
 * @property {string[]} votes - User IDs who voted for this
 * @property {number} count - Vote count
 */

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create a Conversation primitive from backend data
 * 
 * @param {Object} data - Raw channel or DM data
 * @param {'channel'|'dm'|'thread'} type - Conversation type
 * @returns {Conversation}
 */
export function createConversation(data, type) {
  const base = {
    id: data._id || data.id,
    type,
    workspaceId: data.workspace?._id || data.workspaceId,
    lastActivity: data.lastMessageAt || data.updatedAt || new Date(),
    unreadCount: data.unreadCount || 0,
    isEncrypted: data.encryption?.enabled || false,
    metadata: {}
  };

  // Add type-specific metadata
  if (type === 'channel') {
    base.metadata = {
      name: data.name,
      description: data.description,
      members: data.members || [],
      isPrivate: data.isPrivate || false
    };
  } else if (type === 'dm') {
    base.metadata = {
      otherUser: data.otherUser,
      members: data.participants || []
    };
  } else if (type === 'thread') {
    base.metadata = {
      parentMessage: data.parentMessage
    };
  }

  return base;
}

/**
 * Create a Message primitive from backend data
 * 
 * @param {Object} data - Raw message data
 * @returns {Message}
 */
export function createMessage(data) {
  return {
    id: data._id || data.id,
    conversationId: data.channel || data.dm || data.conversationId,
    sender: data.sender,
    contentType: data.isEncrypted ? 'encrypted' : (data.type || 'text'),
    content: {
      text: data.payload?.text || data.text || '',
      attachments: data.payload?.attachments || data.attachments || []
    },
    timestamp: data.createdAt || new Date(),
    isEncrypted: data.isEncrypted || false,
    ciphertext: data.ciphertext,
    messageIv: data.messageIv,
    encryptionVersion: data.encryptionVersion,
    metadata: {
      parentId: data.parentId,
      replyCount: data.replyCount || 0,
      reactions: data.reactions || [],
      isEdited: data.isEdited || false,
      editedAt: data.updatedAt !== data.createdAt ? data.updatedAt : null,
      readBy: data.readBy?.map(r => r.user?._id || r.user) || []
    }
  };
}

/**
 * Create a RealtimeEvent primitive from socket data
 * 
 * @param {string} type - Event type
 * @param {Object} data - Raw socket event data
 * @returns {RealtimeEvent}
 */
export function createRealtimeEvent(type, data) {
  return {
    type,
    conversationId: data.conversationId || data.channelId || data.dmId,
    userId: data.userId || data.user?._id,
    payload: data.payload || data,
    timestamp: data.timestamp || new Date()
  };
}

/**
 * Check if a message needs decryption
 * 
 * @param {Message} message - Message primitive
 * @returns {boolean}
 */
export function needsDecryption(message) {
  return message.isEncrypted && message.ciphertext && message.messageIv;
}

/**
 * Get conversation room name for socket.io
 * 
 * @param {Conversation} conversation - Conversation primitive
 * @returns {string} Room name (e.g., 'channel:123' or 'dm:456')
 */
export function getConversationRoom(conversation) {
  return `${conversation.type}:${conversation.id}`;
}

// ============================================================
// EXPORTS
// ============================================================

const primitives = {
  createConversation,
  createMessage,
  createRealtimeEvent,
  needsDecryption,
  getConversationRoom
};

export default primitives;
