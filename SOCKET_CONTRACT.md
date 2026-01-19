# Socket Event Contract

**Status**: Active  
**Version**: 1.0  
**Last Updated**: January 19, 2026

## Overview

This document defines the contract for all Socket.io events in ChttrixCollab. Every socket event must be documented here with its purpose, payload structure, and usage examples.

**The 3 Primitives**:
- **Conversation**: A context for communication (channel, DM, thread)
- **Message**: Content sent within a conversation
- **RealtimeEvent**: Live updates (typing, presence, state changes)

---

## Event Catalog

### Messages Domain

#### `conversation:join`
**Purpose**: Join a conversation room to receive real-time updates  
**Direction**: Client → Server  
**Emitted By**: Client when opening a conversation

**Payload**:
```javascript
{
  conversationId: string,
  type: 'channel' | 'dm' | 'thread',
  workspaceId: string
}
```

**Example**:
```javascript
socket.emit('conversation:join', {
  conversationId: 'ch_123',
  type: 'channel',
  workspaceId: 'ws_456'
});
```

**Room Joined**: `channel:{conversationId}` or `dm:{conversationId}`

---

#### `conversation:leave`
**Purpose**: Leave a conversation room  
**Direction**: Client → Server

**Payload**:
```javascript
{
  conversationId: string,
  type: 'channel' | 'dm' | 'thread'
}
```

**Example**:
```javascript
socket.emit('conversation:leave', {
  conversationId: 'ch_123',
  type: 'channel'
});
```

---

#### `conversation:event` (Unified)
**Purpose**: Unified event for all conversation activity (NEW ARCHITECTURE)  
**Direction**: Bidirectional  
**Emitted By**: Client sends, Server broadcasts to room

**Payload**:
```javascript
{
  conversationId: string,
  conversationType: 'channel' | 'dm' | 'thread',
  event: {
    type: 'message' | 'poll' | 'meeting' | 'system' | 'edit' | 'delete',
    payload: object,  // Type-specific data
    userId: string,   // Who triggered it
    timestamp: Date
  }
}
```

**Example - New Message**:
```javascript
socket.emit('conversation:event', {
  conversationId: 'ch_123',
  conversationType: 'channel',
  event: {
    type: 'message',
    payload: {
      _id: 'msg_789',
      text: 'Hello!',
      sender: { _id: 'user_456', username: 'alice' }
    },
    userId: 'user_456',
    timestamp: new Date()
  }
});

// Server broadcasts to room:
io.to('channel:ch_123').emit('conversation:event', { ... });
```

**Room**: `channel:{conversationId}` or `dm:{conversationId}`

**Backward Compatibility**: Server also emits legacy events (`new-message`, `poll:new`, etc.)

---

#### `new-message` (Legacy)
**Purpose**: New message created (backward compatible)  
**Direction**: Server → Client  
**Emitted By**: Server when message is created

**Payload**:
```javascript
{
  _id: string,
  type: 'message',
  sender: {
    _id: string,
    username: string,
    profilePicture: string
  },
  workspace: string,
  channel?: string,
  dm?: string,
  payload: {
    text: string,
    attachments: array
  },
  isEncrypted: boolean,
  ciphertext?: string,
  messageIv?: string,
  createdAt: Date
}
```

**Example**:
```javascript
socket.on('new-message', (message) => {
  console.log('New message:', message);
  // Add to local state
});
```

**Room**: `channel:{channelId}` or `dm:{dmId}`

**Status**: ⚠️ Legacy - Use `conversation:event` for new code

---

#### `chat:typing`
**Purpose**: User typing indicator  
**Direction**: Client → Server  
**Emitted By**: Client when user is typing

**Payload**:
```javascript
{
  channelId?: string,
  dmId?: string,
  isTyping: boolean
}
```

**Example**:
```javascript
// Start typing
socket.emit('chat:typing', {
  channelId: 'ch_123',
  isTyping: true
});

// Stop typing
socket.emit('chat:typing', {
  channelId: 'ch_123',
  isTyping: false
});
```

**Server Broadcasts**:
```javascript
socket.on('chat:user_typing', (data) => {
  // data = { userId: 'user_456', isTyping: true }
});
```

**Room**: `channel:{channelId}` or `dm:{dmId}`  
**Note**: Server broadcasts to all room members except sender

---

#### `chat:message` (Legacy)
**Purpose**: Send a message (legacy event)  
**Direction**: Client → Server  
**Status**: ⚠️ Deprecated - Use HTTP POST `/api/v2/messages/channel` instead

**Why Deprecated**: Messages should be persisted via HTTP, not sockets. Sockets are for real-time broadcasts only.

---

### Meetings Domain

#### `meeting:created`
**Purpose**: New meeting scheduled in channel  
**Direction**: Server → Client  
**Emitted By**: Server when meeting is created

**Payload**:
```javascript
{
  _id: string,
  channelId: string,
  title: string,
  scheduledFor: Date,
  createdBy: {
    _id: string,
    username: string
  },
  participants: array
}
```

**Example**:
```javascript
socket.on('meeting:created', (meeting) => {
  // Show notification
  toast.info(`Meeting scheduled: ${meeting.title}`);
});
```

**Room**: `channel:{channelId}`

---

#### `meeting:joined`
**Purpose**: User joined a live meeting  
**Direction**: Bidirectional

**Payload**:
```javascript
{
  meetingId: string,
  userId: string,
  username: string,
  timestamp: Date
}
```

**Example**:
```javascript
// Client joins
socket.emit('meeting:joined', {
  meetingId: 'meet_123',
  userId: 'user_456',
  username: 'alice'
});

// Server broadcasts to all participants
socket.on('meeting:joined', (data) => {
  console.log(`${data.username} joined the meeting`);
});
```

**Room**: `meeting:{meetingId}`

---

#### `meeting:left`
**Purpose**: User left a meeting  
**Direction**: Bidirectional

**Payload**:
```javascript
{
  meetingId: string,
  userId: string,
  username: string,
  timestamp: Date
}
```

**Room**: `meeting:{meetingId}`

---

#### `meeting:ended`
**Purpose**: Meeting has ended  
**Direction**: Server → Client  
**Emitted By**: Server (or host)

**Payload**:
```javascript
{
  meetingId: string,
  endedBy: string,
  duration: number,  // seconds
  timestamp: Date
}
```

**Room**: `meeting:{meetingId}` and `channel:{channelId}`

---

### Huddles Domain

#### `huddle:started`
**Purpose**: Huddle (voice channel) started  
**Direction**: Server → Client

**Payload**:
```javascript
{
  huddleId: string,
  channelId: string,
  startedBy: {
    _id: string,
    username: string
  },
  timestamp: Date
}
```

**Example**:
```javascript
socket.on('huddle:started', (huddle) => {
  // Show "Join Huddle" button
});
```

**Room**: `channel:{channelId}`

---

#### `huddle:joined`
**Purpose**: User joined huddle  
**Direction**: Bidirectional

**Payload**:
```javascript
{
  huddleId: string,
  userId: string,
  username: string,
  audioEnabled: boolean,
  timestamp: Date
}
```

**Room**: `huddle:{huddleId}`

---

#### `huddle:left`
**Purpose**: User left huddle  
**Direction**: Bidirectional

**Payload**:
```javascript
{
  huddleId: string,
  userId: string,
  timestamp: Date
}
```

**Room**: `huddle:{huddleId}`

---

#### `huddle:ended`
**Purpose**: Huddle ended (last person left)  
**Direction**: Server → Client

**Payload**:
```javascript
{
  huddleId: string,
  channelId: string,
  duration: number,
  timestamp: Date
}
```

**Room**: `channel:{channelId}`

---

### Threads Domain

#### `thread:reply`
**Purpose**: New reply in a thread  
**Direction**: Server → Client

**Payload**:
```javascript
{
  threadId: string,  // parentId of the message
  reply: {
    _id: string,
    sender: object,
    text: string,
    createdAt: Date
  },
  channelId: string
}
```

**Room**: `channel:{channelId}` (threads are part of channels)

---

#### `thread:resolved`
**Purpose**: Thread marked as resolved  
**Direction**: Bidirectional

**Payload**:
```javascript
{
  threadId: string,
  resolvedBy: string,
  timestamp: Date
}
```

**Room**: `channel:{channelId}`

---

### Polls Domain

#### `poll:created`
**Purpose**: New poll created in channel  
**Direction**: Client → Server

**Payload**:
```javascript
{
  channelId: string,
  poll: {
    _id: string,
    question: string,
    options: array,
    createdBy: object
  }
}
```

**Server Broadcasts**:
```javascript
socket.on('poll:new', (poll) => {
  // Display poll
});
```

**Room**: `channel:{channelId}`

---

#### `poll:voted`
**Purpose**: User voted on a poll  
**Direction**: Client → Server

**Payload**:
```javascript
{
  channelId: string,
  poll: object  // Updated poll with vote counts
}
```

**Server Broadcasts**:
```javascript
socket.on('poll:update', (poll) => {
  // Update poll display
});
```

**Room**: `channel:{channelId}`

---

#### `poll:closed`
**Purpose**: Poll was closed  
**Direction**: Client → Server

**Payload**:
```javascript
{
  channelId: string,
  poll: object  // Poll with closed: true
}
```

**Server Broadcasts**: `poll:update`

**Room**: `channel:{channelId}`

---

#### `poll:deleted`
**Purpose**: Poll was deleted  
**Direction**: Client → Server

**Payload**:
```javascript
{
  channelId: string,
  pollId: string
}
```

**Server Broadcasts**:
```javascript
socket.on('poll:removed', (data) => {
  // Remove poll from UI
});
```

**Room**: `channel:{channelId}`

---

### Presence Domain

#### `user:online`
**Purpose**: User came online  
**Direction**: Server → Client  
**Emitted By**: Server when user connects

**Payload**:
```javascript
{
  userId: string,
  username: string,
  timestamp: Date
}
```

**Room**: `workspace:{workspaceId}` (all workspace members)

---

#### `user:offline`
**Purpose**: User went offline  
**Direction**: Server → Client

**Payload**:
```javascript
{
  userId: string,
  lastSeen: Date
}
```

**Room**: `workspace:{workspaceId}`

---

#### `user:status_change`
**Purpose**: User status changed (away, busy, etc.)  
**Direction**: Bidirectional

**Payload**:
```javascript
{
  userId: string,
  status: 'online' | 'away' | 'busy' | 'offline',
  customStatus?: string
}
```

**Room**: `workspace:{workspaceId}`

---

### Admin Domain

#### `admin:join`
**Purpose**: Admin joins admin-only room  
**Direction**: Client → Server

**Payload**: None

**Example**:
```javascript
socket.emit('admin:join');
// Server verifies admin role, then: socket.join('chttrix_admins')
```

**Room Joined**: `chttrix_admins`

---

#### `admin:dm:send`
**Purpose**: Admin sends DM to company  
**Direction**: Client → Server

**Payload**:
```javascript
{
  companyId: string,
  message: string
}
```

**Server Broadcasts**:
```javascript
socket.on('admin:dm:receive', (data) => {
  // data = { sender: userId, message, timestamp }
});
```

**Room**: `company:{companyId}`

---

#### `audit:new`
**Purpose**: New audit log created  
**Direction**: Client → Server

**Payload**: Audit log object

**Server Broadcasts**: `audit:update` to `chttrix_admins`

---

#### `ticket:created`, `ticket:updated`
**Purpose**: Support ticket events  
**Direction**: Client → Server

**Server Broadcasts**: `ticket:new`, `ticket:update` to `chttrix_admins`

---

#### `company:registered`
**Purpose**: New company registered  
**Direction**: Server → Client

**Server Broadcasts**: `company:pending` to `chttrix_admins`

---

## Room Naming Convention

All socket rooms follow this pattern:

| Pattern | Example | Purpose |
|---------|---------|---------|
| `user:{userId}` | `user:123` | Personal notifications |
| `channel:{channelId}` | `channel:456` | Channel messages/events |
| `dm:{dmId}` | `dm:789` | Direct messages |
| `meeting:{meetingId}` | `meeting:101` | Live meeting participants |
| `huddle:{huddleId}` | `huddle:202` | Voice channel participants |
| `workspace:{workspaceId}` | `workspace:303` | Workspace-wide events |
| `company:{companyId}` | `company:404` | Company-wide events |
| `chttrix_admins` | `chttrix_admins` | System admins only |

---

## Usage Guidelines

### When to Use Sockets

✅ **DO use sockets for**:
- Real-time broadcasts (new messages, typing indicators)
- Live presence updates
- Instant notifications
- Live collaboration (cursors, selections)

❌ **DON'T use sockets for**:
- Creating persistent data (use HTTP POST instead)
- Initial data loading (use HTTP GET)
- File uploads
- Authentication

### Best Practices

1. **Always use HTTP for mutations**, sockets for broadcasts
   ```javascript
   // ✅ Correct
   await axios.post('/api/v2/messages/channel', message);
   // Server will emit socket event after saving
   
   // ❌ Wrong
   socket.emit('chat:message', message);
   ```

2. **Document new events here first** before implementing

3. **Use typed payloads** in TypeScript/JSDoc

4. **Handle errors gracefully**
   ```javascript
   socket.on('error', (err) => {
     console.error('Socket error:', err);
   });
   ```

5. **Clean up listeners** when components unmount
   ```javascript
   useEffect(() => {
     socket.on('new-message', handler);
     return () => socket.off('new-message', handler);
   }, []);
   ```

---

## Migration from Legacy Events

If you're using old socket events, migrate like this:

### Before (Legacy)
```javascript
socket.emit('chat:message', { channelId, message });
socket.on('new-message', handleMessage);
```

### After (New)
```javascript
// Use HTTP for creating
await axios.post('/api/v2/messages/channel', message);

// Use unified event for listening
socket.on('conversation:event', (event) => {
  if (event.type === 'message') {
    handleMessage(event.payload);
  }
});
```

---

## Questions?

**"Where does feature X go?"**
→ Check the primitives: Is it a Conversation, Message, or RealtimeEvent?

**"Should I use sockets or HTTP?"**
→ HTTP for mutations, sockets for broadcasts

**"Can I add a new event?"**
→ Yes! Document it here first, follow the pattern

---

## Owner

@socket-contract  
**Status**: ✅ Active  
**Version**: 1.0
