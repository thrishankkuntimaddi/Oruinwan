# Messages Module

Domain-driven module for all messaging functionality including direct messages, channel messages, and real-time communication.

## Structure

```
messages/
├── messages.service.js      - Business logic layer
├── messages.controller.js   - HTTP request handlers
├── messages.routes.js       - Route definitions
├── index.js                 - Public API exports
└── __tests__/
    └── messages.service.test.js
```

## Features

- ✅ **Direct Messages (DMs)**: Person-to-person communication
- ✅ **Channel Messages**: Group communication
- ✅ **End-to-End Encryption**: Full E2EE support
- ✅ **Real-time Updates**: Socket.io integration
- ✅ **Pagination**: Efficient message loading
- ✅ **Thread Support**: Reply functionality
- ✅ **Privacy**: Channel join-date filtering

## API Endpoints

### Send Direct Message
```
POST /api/v2/messages/direct
```

**Request**:
```json
{
  "receiverId": "user123",
  "workspaceId": "ws123",
  "text": "Hello!",
  "isEncrypted": true,
  "ciphertext": "base64-encrypted-data",
  "messageIv": "base64-iv"
}
```

### Send Channel Message
```
POST /api/v2/messages/channel
```

### Get Channel Messages
```
GET /api/v2/messages/channel/:channelId?limit=50&before=msgId
```

### Get DM Messages
```
GET /api/v2/messages/workspace/:workspaceId/dm/:dmSessionId
```

### List DM Sessions
```
GET /api/v2/messages/workspace/:workspaceId/dms
```

## Service Layer

### createMessage(messageData, io)

Creates a new message (DM or channel) with optional E2EE.

**Parameters**:
- `messageData` - Message data object
- `io` - Socket.io instance for real-time events

**E2EE Support**:
```javascript
if (isEncrypted && ciphertext && messageIv) {
  // Store encrypted message
  messageData.ciphertext = ciphertext;
  messageData.messageIv = messageIv;
  messageData.isEncrypted = true;
  messageData.payload = { text: '', attachments: [] };
}
```

### fetchMessages(query, options)

Retrieves messages with pagination and privacy filtering.

**Options**:
- `limit` - Max number of messages (default: 50)
- `before` - Message ID for pagination
- `userJoinedAt` - Filter messages after join date
- `populateReplies` - Include reply counts

### findOrCreateDMSession(userId1, userId2, workspaceId)

Finds existing DM session or creates new one.

### getUserDMSessions(userId, workspaceId)

Lists all DM sessions for user with metadata.

## Usage Example

```javascript
const messagesService = require('./messages.service');

// Create encrypted message
const message = await messagesService.createMessage({
  type: 'message',
  sender: 'user123',
  workspace: 'ws123',
  channel: 'ch123',
  ciphertext: 'encrypted-data',
  messageIv: 'iv-data',
  isEncrypted: true
}, io);

// Fetch messages with pagination
const { messages, hasMore } = await messagesService.fetchMessages(
  { channel: 'ch123' },
  { limit: 50, userJoinedAt: new Date('2026-01-01') }
);
```

## Testing

```bash
npm test src/modules/messages/__tests__/
```

**Test Coverage**:
- ✅ Unencrypted message creation
- ✅ Encrypted message creation (E2EE)
- ✅ Socket event emission
- ✅ DM session management
- ✅ Message pagination

## E2EE Implementation

Messages are encrypted **client-side** before sending:

1. Client encrypts message with workspace key (AES-256-GCM)
2. Sends `ciphertext` + `messageIv` to server
3. Server stores encrypted data only
4. Recipients decrypt with same workspace key

**Server never sees plaintext** ✅

## Owner

@messages-module

## Status

✅ **Active** - Production ready

## Legacy Files

These files are deprecated:
- `server/controllers/messagesController.js` - Use this module instead
- `server/src/features/messages/` - Partial duplicate
