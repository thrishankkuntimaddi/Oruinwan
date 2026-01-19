# Chat Module

Unified frontend module for all chat-related components, hooks, and encryption.

## Structure

```
chat/
├── components/
│   ├── ChatWindow.jsx       - Unified chat component
│   ├── MessageList.jsx      - Message rendering
│   └── index.js             - Component exports
├── encryption/
│   └── chatEncryption.js    - E2EE key management
└── index.js                 - Public API
```

## Features

- ✅ **Unified Chat Window**: Single component for channels + DMs
- ✅ **E2EE Integration**: Built-in encryption toggle
- ✅ **Real-time Updates**: Socket.io integration
- ✅ **Smart Message Rendering**: Auto-decrypt encrypted messages
- ✅ **Infinite Scroll**: Pagination support
- ✅ **Reply Threading**: Thread support
- ✅ **Workspace Key Management**: Singleton encryption manager

## Components

### ChatWindow

Unified component supporting both channels and direct messages.

**Props**:
```typescript
{
  type: 'channel' | 'dm',
  chatId: string,
  workspaceId: string,
  currentUser: object
}
```

**Usage**:
```jsx
import { ChatWindow } from './modules/chat';

<ChatWindow
  type="channel"
  chatId={channelId}
  workspaceId={workspaceId}
  currentUser={currentUser}
/>
```

**Features**:
- E2EE toggle
- Real-time message updates
- Reply functionality
- Uses existing hooks for compatibility

### MessageList

Smart message rendering with auto-decryption.

**Props**:
```typescript
{
  messages: array,
  loading: boolean,
  hasMore: boolean,
  onLoadMore: function,
  onReply: function,
  currentUser: object,
  chatContext: object
}
```

**Features**:
- Auto-decrypt encrypted messages
- Infinite scroll pagination
- Auto-scroll to bottom
- Empty state handling
- Decryption error handling

## Encryption Manager

### chatEncryption

Singleton encryption manager for workspace keys.

**API**:

```javascript
import chatEncryption from './modules/chat/encryption/chatEncryption';

// Set workspace key
chatEncryption.setWorkspaceKey(workspaceId, cryptoKey);

// Encrypt message
const { ciphertext, messageIv } = await chatEncryption.encryptMessageForSending(
  'Hello, world!',
  workspaceId
);

// Decrypt message
const plaintext = await chatEncryption.decryptReceivedMessage(
  ciphertext,
  messageIv,
  workspaceId
);

// Clear keys
chatEncryption.clearWorkspaceKey(workspaceId);
chatEncryption.clearAllKeys();
```

## E2EE Flow

### Setup (On Login)

```javascript
// 1. Derive KEK from password
const kek = await deriveKeyFromPassword(password, salt, 100000);

// 2. Fetch encrypted workspace keys
const { data } = await axios.get('/api/v2/encryption/keys');

// 3. Decrypt and store workspace keys
for (const key of data.keys) {
  const workspaceKey = await decryptWorkspaceKey(
    key.encryptedKey,
    key.keyIv,
    kek
  );
  
  chatEncryption.setWorkspaceKey(key.workspaceId, workspaceKey);
}
```

### Send Encrypted Message

```javascript
// 1. Encrypt message
const { ciphertext, messageIv } = await chatEncryption.encryptMessageForSending(
  messageText,
  workspaceId
);

// 2. Send to server
await axios.post('/api/v2/messages/channel', {
  channelId,
  ciphertext,
  messageIv,
  isEncrypted: true
});
```

### Receive Encrypted Message

```javascript
// Messages auto-decrypt in MessageList component
// But you can also manually decrypt:

const message = {
  ciphertext: 'base64-data',
  messageIv: 'base64-iv',
  isEncrypted: true
};

const plaintext = await chatEncryption.decryptReceivedMessage(
  message.ciphertext,
  message.messageIv,
  workspaceId
);
```

## Hooks

Re-exported from shared hooks for convenience:

```javascript
import {
  useChatSocket,
  useConversation,
  useMessageActions
} from './modules/chat';
```

## Migration from Legacy

### Old Way
```javascript
// ❌ Legacy
import ChatWindowV2 from './components/messagesComp/chatWindowComp/ChatWindowV2';
import DMChatWindow from './components/messagesComp/DMChatWindow';
```

### New Way
```javascript
// ✅ Module imports
import { ChatWindow } from './modules/chat';

// Same component for both channels and DMs
<ChatWindow type="channel" ... />
<ChatWindow type="dm" ... />
```

## Testing

Components are designed to work with existing hooks, making them easy to test:

```javascript
import { render } from '@testing-library/react';
import { ChatWindow } from './modules/chat';

test('renders chat window', () => {
  const { getByText } = render(
    <ChatWindow
      type="channel"
      chatId="ch123"
      workspaceId="ws123"
      currentUser={mockUser}
    />
  );
  
  expect(getByText(/channel/i)).toBeInTheDocument();
});
```

## Owner

@chat-module

## Status

✅ **Active** - Production ready

## Legacy Files

These files are deprecated:
- `client/src/components/messagesComp/chatWindowComp/ChatWindowV2.jsx`
- `client/src/components/messagesComp/chatWindowComp/ChatWindowUnified.jsx`
- `client/src/components/messagesComp/DMChatWindow.jsx`
- `client/src/components/messagesComp/BroadcastChatWindow.jsx`

Use `modules/chat/components/ChatWindow.jsx` instead.
