# ChttrixCollab Architecture

**Status**: Week 1 - Foundation Complete ✅  
**Date**: January 19, 2026  
**Migration Phase**: 1 of 3

## Overview

ChttrixCollab is transitioning from a dual-architecture codebase to a clean, domain-driven modular structure. This document outlines the current architecture, migration strategy, and module ownership.

## Architecture Pattern

### Module Structure

We follow a **domain-driven, feature-based architecture** with strict separation of concerns:

```
server/src/modules/{domain}/
├── {domain}.controller.js   # HTTP request handlers
├── {domain}.service.js       # Business logic
├── {domain}.model.js         # Database schema (symlink to models/)
├── {domain}.routes.js        # Route definitions
└── __tests__/                # Unit tests
```

### Current Modules

#### ✅ Messages Module
**Path**: `server/src/modules/messages/`  
**Owner**: @messages-module  
**Status**: Active

Handles all messaging functionality including:
- Direct messages (DMs)
- Channel messages
- E2EE message encryption
- Message retrieval with pagination
- Real-time socket events

**Files**:
- `messages.service.js` - Business logic
- `messages.controller.js` - HTTP handlers
- `messages.routes.js` - API routes

---

#### ✅ Encryption Module
**Path**: `server/src/modules/encryption/`  
**Owner**: @encryption-module  
**Status**: Active

First-class E2EE implementation:
- Workspace key generation
- User enrollment/revocation
- Key encryption with KEK
- PBKDF2 key derivation

**Files**:
- `encryption.service.js` - Core E2EE logic
- `encryption.controller.js` - HTTP endpoints
- `encryption.routes.js` - API routes

**Key Features**:
- AES-256-GCM encryption
- Server-side key wrapping
- Zero-knowledge architecture

---

## Socket Layer

### The 3 Primitives Model

All real-time features are built on **3 core primitives**:

```
1. CONVERSATION - A context for communication (channel, DM, thread)
2. MESSAGE - Content sent within a conversation
3. REALTIME EVENT - Live updates and state changes
```

This simplification eliminates confusion about "where does X go?"—everything maps to one of these primitives.

### Architecture

```
Client                    Server
  |                         |
  | conversation:event      |
  |------------------------>|
  |                         | Process
  |                         | Validate
  |                         | Broadcast
  | <-----------------------|
  | new-message (legacy)    |
  | conversation:event      |
```

### Modular Socket Structure

**Path**: `server/src/socket/`

Socket handlers are organized by domain:

```
server/src/socket/
├── index.js                       # Main entry point
├── handlers/
│   ├── messages.socket.js         # Message events
│   ├── meetings.socket.js         # Meeting events
│   ├── huddles.socket.js          # Huddle/voice events
│   ├── presence.socket.js         # Online/offline status
│   ├── polls.socket.js            # Poll events
│   └── admin.socket.js            # Admin notifications
└── services/
    └── socketEmitter.js           # Centralized event emitter
```

### Socket Domains

#### Messages Domain
**Handler**: `handlers/messages.socket.js`  
**Responsibility**: Chat messages, typing indicators, conversation rooms

**Events**:
- `conversation:join` / `conversation:leave` - Room management
- `conversation:event` - Unified event (NEW)
- `chat:typing` - Typing indicators
- `new-message` - Legacy message broadcast

#### Meetings Domain
**Handler**: `handlers/meetings.socket.js`  
**Responsibility**: Video call signaling and state

**Events**:
- `meeting:join` / `meeting:leave`
- `meeting:ended`

#### Huddles Domain
**Handler**: `handlers/huddles.socket.js`  
**Responsibility**: Voice channel state

**Events**:
- `huddle:start` / `huddle:join` / `huddle:leave`
- `huddle:audio_toggle`
- `huddle:ended`

#### Presence Domain
**Handler**: `handlers/presence.socket.js`  
**Responsibility**: User online/offline/away status

**Events**:
- `user:online` / `user:offline`
- `user:status_change`
- `workspace:join` / `workspace:leave`

#### Polls Domain
**Handler**: `handlers/polls.socket.js`  
**Responsibility**: Poll lifecycle

**Events**:
- `poll:created` / `poll:voted`
- `poll:closed` / `poll:deleted`

#### Admin Domain
**Handler**: `handlers/admin.socket.js`  
**Responsibility**: Admin notifications and system events

**Events**:
- `admin:join` - Join admin room
- `admin:dm:send` - Admin DM to company
- `audit:new` - Audit log updates
- `ticket:created` / `ticket:updated`

### Socket Emitter Service

**Path**: `server/src/socket/services/socketEmitter.js`

Centralized service for emitting socket events from backend code:

```javascript
const { getSocketEmitter } = require('./src/socket/services/socketEmitter');

// In a service
const emitter = getSocketEmitter();
emitter.emitNewMessage(channelId, 'channel', message);
```

**Benefits**:
- Type-safe emission
- Consistent event structure
- No need to pass `io` everywhere
- Documented methods

### Contract Documentation

**See**: [`SOCKET_CONTRACT.md`](file:///Users/thrishankkuntimaddi/Documents/Chttrix/ChttrixCollab/SOCKET_CONTRACT.md)

Every socket event is documented with:
- Purpose
- Payload structure
- Example usage
- Room naming

---

---

## Legacy Code

### ⚠️ FROZEN - Do Not Modify

The following files are in **legacy mode** and will be removed by March 2026:

#### Backend
- `server/controllers/messagesController.js` → Use `modules/messages/`
- `server/controllers/keyManagementController.js` → Use `modules/encryption/`
- `server/src/features/*` → Partially implemented, migrate to `modules/`

#### Frontend
- `client/src/components/messagesComp/chatWindowComp/ChatWindowV2.jsx` → Use `modules/chat/`
- `client/src/components/messagesComp/chatWindowComp/ChatWindowUnified.jsx` → Deprecated

### ESLint Protection

To prevent new code from using legacy imports:

```jsonc
// server/.eslintrc.json (TODO: Add)
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": ["../controllers/*"]
    }]
  }
}
```

---

## Frontend Architecture (In Progress)

### Target Structure

```
client/src/modules/
├── chat/
│   ├── components/
│   │   ├── ChatWindow.jsx
│   │   ├── MessageList.jsx
│   │   └── MessageInput.jsx
│   ├── hooks/
│   │   ├── useChatSocket.js
│   │   └── useConversation.js
│   ├── services/
│   │   └── messageService.js
│   └── encryption/
│       └── chatEncryption.js
```

---

## End-to-End Encryption

### E2EE Architecture

ChttrixCollab implements **Zero-Knowledge E2EE**:

1. **Client-side encryption**: Messages encrypted in browser
2. **Server-side key wrapping**: Workspace keys encrypted with user KEK
3. **PBKDF2 derivation**: Password → KEK on client
4. **AES-256-GCM**: Industry-standard authenticated encryption

### Data Flow

```
User Password
    ↓ (PBKDF2 on client)
User KEK
    ↓ (Encrypts workspace key)
Encrypted Workspace Key → Stored in DB
    ↓ (Decrypted with KEK)
Workspace Key
    ↓ (Encrypts message)
Ciphertext → Sent to server
```

### Message Schema

```javascript
{
  type: 'message',
  sender: ObjectId,
  workspace: ObjectId,
  channel: ObjectId,  // OR dm: ObjectId
  
  // E2EE Fields
  isEncrypted: true,
  ciphertext: 'base64...',
  messageIv: 'base64...',
  encryptionVersion: 'aes-256-gcm-v1',
  
  // Payload (empty if encrypted)
  payload: {
    text: '',  // Empty for E2EE
    attachments: []
  }
}
```

---

## Migration Guidelines

### Adding New Features

1. ✅ **DO**: Add to `modules/{domain}/`
2. ✅ **DO**: Follow service → controller → routes pattern
3. ✅ **DO**: Add tests in `__tests__/`
4. ❌ **DON'T**: Modify legacy `controllers/` files
5. ❌ **DON'T**: Import from `components/messagesComp/`

### Module Ownership

Each module has an owner tag:
```javascript
/**
 * @owner {module-name}
 * @status active | legacy
 */
```

### Backward Compatibility

During migration (Weeks 1-3):
- Old routes still work
- New modules coexist with old
- No breaking changes

---

## Verification

### Backend Tests

```bash
# Verify module structure
cd server
ls -la src/modules/messages/
ls -la src/modules/encryption/

# Test API endpoints (when running)
curl -X POST http://localhost:5000/api/messages/direct \
  -H "Authorization: Bearer {token}" \
  -d '{"receiverId": "...", "text": "test"}'
```

### Frontend Tests

```bash
cd client
npm run build  # Should build without errors
```

---

## Week 1 Deliverables ✅

- [x] Database reset (admin preserved)
- [x] Backend module structure created
- [x] Messages module (service, controller, routes)
- [x] Encryption module (service, controller, routes)
- [x] Legacy files frozen with ownership comments
- [x] Frontend module foundation started
- [x] Architecture documentation

---

## Next Steps (Week 2)

1. Complete frontend chat module
2. Migrate all routes to use new modules
3. Add comprehensive tests
4. Update server.js to register new routes
5. Proxy old components to new ones

---

## Contact

**Migration Lead**: Antigravity AI  
**Week**: 1 of 3  
**Completion**: Foundation ✅
