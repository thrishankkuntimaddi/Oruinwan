# Migration Guide - ChttrixCollab v2 Modules

## Overview

This guide helps developers migrate from legacy routes to the new v2 modular architecture.

## Quick Start

### For New Features

**Use v2 routes** for all new development:

```javascript
// ✅ NEW - Use this
import axios from 'axios';

// Send message
await axios.post('/api/v2/messages/direct', {
  receiverId: 'user123',
  workspaceId: 'ws123',
  text: 'Hello',
  isEncrypted: true,
  ciphertext: '...',
  messageIv: '...'
});

// Get encryption keys
const { data } = await axios.get('/api/v2/encryption/keys');
```

### For Existing Code

**No changes required** - legacy routes still work:

```javascript
// ✅ LEGACY - Still works
await axios.post('/api/messages/direct', { ... });
await axios.get('/api/keys');
```

---

## Backend Migration

### Importing Modules

**Old Way** (controllers):
```javascript
// ❌ Don't do this anymore
const messagesController = require('./controllers/messagesController');
```

**New Way** (modules):
```javascript
// ✅ Do this instead
const { service, controller } = require('./src/modules/messages');

// Or import specific parts
const messagesService = require('./src/modules/messages/messages.service');
```

### Creating New Routes

**Use the module pattern**:

```javascript
// routes/myNewFeature.js
const express = require('express');
const router = express.Router();

// Import from modules
const { service } = require('../src/modules/messages');

router.get('/my-endpoint', async (req, res) => {
  // Use service layer for business logic
  const result = await service.fetchMessages({ ... });
  res.json(result);
});

module.exports = router;
```

### ESLint Protection

The ESLint rule prevents imports from legacy `controllers/`:

```javascript
// ❌ This will error
import messagesController from '../controllers/messagesController';
// Error: 🚫 LEGACY IMPORT: Use modules/ instead

// ✅ Do this instead
import { controller } from '../src/modules/messages';
```

---

## Frontend Migration

### Importing Chat Components

**Old Way**:
```javascript
// ❌ Legacy imports
import ChatWindowV2 from './components/messagesComp/chatWindowComp/ChatWindowV2';
```

**New Way**:
```javascript
// ✅ Module imports
import { ChatWindow, MessageList } from './modules/chat';
import chatEncryption from './modules/chat/encryption/chatEncryption';
```

### Using ChatWindow Component

```jsx
import React from 'react';
import { ChatWindow } from '../modules/chat';

function MyChannelView({ channelId, workspaceId, currentUser }) {
  return (
    <ChatWindow
      type="channel"
      chatId={channelId}
      workspaceId={workspaceId}
      currentUser={currentUser}
    />
  );
}
```

### E2EE Integration

```javascript
import chatEncryption from './modules/chat/encryption/chatEncryption';

// Set workspace key (do this once per workspace)
chatEncryption.setWorkspaceKey(workspaceId, workspaceKey);

// Encrypt message before sending
const { ciphertext, messageIv } = await chatEncryption.encryptMessageForSending(
  'Hello, world!',
  workspaceId
);

// Send encrypted message
await api.post('/api/v2/messages/channel', {
  channelId,
  ciphertext,
  messageIv,
  isEncrypted: true
});
```

---

## API Changes

### Messages API

**Endpoint**: `/api/v2/messages/*`

#### Send Direct Message
```javascript
POST /api/v2/messages/direct

Body:
{
  receiverId: string,
  workspaceId: string,
  text?: string,           // Optional if encrypted
  attachments?: array,
  replyTo?: string,
  
  // E2EE fields
  isEncrypted?: boolean,
  ciphertext?: string,     // Base64
  messageIv?: string       // Base64
}

Response:
{
  message: {
    _id: string,
    sender: object,
    ciphertext?: string,
    messageIv?: string,
    isEncrypted: boolean,
    createdAt: string
  }
}
```

#### Get Channel Messages
```javascript
GET /api/v2/messages/channel/:channelId?limit=50&before=msgId

Response:
{
  messages: array,
  hasMore: boolean,
  total: number,
  userJoinedAt: string,
  channelMembers: array
}
```

### Encryption API

**Endpoint**: `/api/v2/encryption/*`

#### Get User Keys
```javascript
GET /api/v2/encryption/keys

Response:
{
  keys: [
    {
      _id: string,
      workspaceId: object,
      encryptedKey: string,  // Base64
      keyIv: string,         // Base64
      pbkdf2Salt: string,    // Base64
      pbkdf2Iterations: number
    }
  ]
}
```

---

## E2EE Flow

### Complete Message Sending Flow

```javascript
// 1. Get workspace key from server
const { data } = await axios.get('/api/v2/encryption/keys');
const userKey = data.keys.find(k => k.workspaceId._id === workspaceId);

// 2. Derive KEK from user password (done once on login)
const kek = await deriveKeyFromPassword(
  userPassword,
  base64ToArrayBuffer(userKey.pbkdf2Salt),
  userKey.pbkdf2Iterations
);

// 3. Decrypt workspace key
const workspaceKey = await decryptWorkspaceKey(
  userKey.encryptedKey,
  userKey.keyIv,
  kek
);

// 4. Set in encryption manager
chatEncryption.setWorkspaceKey(workspaceId, workspaceKey);

// 5. Encrypt and send message
const { ciphertext, messageIv } = await chatEncryption.encryptMessageForSending(
  messageText,
  workspaceId
);

await axios.post('/api/v2/messages/channel', {
  channelId,
  ciphertext,
  messageIv,
  isEncrypted: true
});
```

### Complete Message Receiving Flow

```javascript
// Messages come from server with ciphertext and messageIv
const message = {
  ciphertext: 'base64-encrypted-data',
  messageIv: 'base64-iv',
  isEncrypted: true
};

// Decrypt using workspace key
const plaintext = await chatEncryption.decryptReceivedMessage(
  message.ciphertext,
  message.messageIv,
  workspaceId
);

// Display plaintext to user
console.log(plaintext); // "Hello, world!"
```

---

## Testing

### Running Module Tests

```bash
# Backend tests
cd server
npm test src/modules/messages/__tests__/
npm test src/modules/encryption/__tests__/

# Run all module tests
npm test src/modules/
```

### Writing New Tests

```javascript
// server/src/modules/mymodule/__tests__/mymodule.service.test.js
const myService = require('../mymodule.service');

describe('MyModule Service', () => {
  it('should do something', async () => {
    const result = await myService.doSomething();
    expect(result).toBeDefined();
  });
});
```

---

## Common Patterns

### Service Layer Pattern

```javascript
// messages.service.js
async function createMessage(messageData, io) {
  // 1. Validate data
  // 2. Create in database
  // 3. Emit socket event
  // 4. Return result
}
```

### Controller Layer Pattern

```javascript
// messages.controller.js
exports.sendMessage = async (req, res) => {
  try {
    const result = await messagesService.createMessage(req.body, req.io);
    return res.status(201).json({ message: result });
  } catch (err) {
    return handleError(res, err, 'SEND MESSAGE ERROR');
  }
};
```

---

## Troubleshooting

### ESLint Errors

**Error**: "🚫 LEGACY IMPORT: Use modules/ instead"

**Fix**: Change import from `controllers/` to `src/modules/`:
```javascript
// Before
const controller = require('./controllers/messagesController');

// After
const { controller } = require('./src/modules/messages');
```

### Route Not Found

**Error**: 404 on `/api/v2/messages/...`

**Fix**: Ensure server.js has module routes registered:
```javascript
app.use("/api/v2/messages", require("./src/modules/messages/messages.routes"));
```

### Encryption Errors

**Error**: "No workspace key found"

**Fix**: Set workspace key before encrypting:
```javascript
chatEncryption.setWorkspaceKey(workspaceId, workspaceKey);
```

---

## Gradual Migration Strategy

1. **Phase 1** (Now): Use v2 routes for new features
2. **Phase 2** (Next 2 months): Migrate existing features one by one
3. **Phase 3** (After 2 months): Deprecate v1 routes
4. **Phase 4** (After 4 months): Remove legacy code

**No rush** - both v1 and v2 routes work simultaneously.

---

## Support

**Documentation**: See `ARCHITECTURE.md`  
**Questions**: Check `walkthrough.md` for detailed examples  
**Issues**: Legacy code is marked with `@status legacy` comments
