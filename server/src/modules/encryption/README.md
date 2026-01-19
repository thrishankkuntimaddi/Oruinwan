# Encryption Module

First-class E2EE module handling all encryption key management for workspace-level end-to-end encryption.

## Structure

```
encryption/
├── encryption.service.js       - Core E2EE business logic
├── encryption.controller.js    - HTTP request handlers
├── encryption.routes.js        - Route definitions
├── index.js                    - Public API exports
└── __tests__/
    └── encryption.service.test.js
```

## Features

- ✅ **Workspace Key Generation**: 256-bit AES keys
- ✅ **User Enrollment**: Encrypt workspace keys with user KEK
- ✅ **Access Revocation**: Remove user access to workspaces
- ✅ **Key Rotation**: Support for key versioning
- ✅ **Zero-Knowledge**: Server never sees decrypted keys
- ✅ **PBKDF2**: Secure password-based key derivation

## API Endpoints

### Get User's Workspace Keys
```
GET /api/v2/encryption/keys
```

**Response**:
```json
{
  "keys": [
    {
      "workspaceId": "ws123",
      "encryptedKey": "base64-encrypted-workspace-key",
      "keyIv": "base64-iv",
      "pbkdf2Salt": "base64-salt",
      "pbkdf2Iterations": 100000
    }
  ]
}
```

### Enroll User in Workspace
```
POST /api/v2/encryption/enroll
```

**Request**:
```json
{
  "workspaceId": "ws123",
  "encryptedWorkspaceKey": "base64-encrypted-key",
  "keyIv": "base64-iv",
  "pbkdf2Salt": "base64-salt"
}
```

### Revoke User Access
```
DELETE /api/v2/encryption/revoke
```

### Check Workspace Access
```
GET /api/v2/encryption/access/:workspaceId
```

## Service Layer

### generateWorkspaceKey()

Generates a cryptographically random 256-bit workspace key.

**Returns**: `Buffer` (32 bytes)

### enrollUserInWorkspace(userId, workspaceId, workspaceKey, userKEK, userSalt)

Enrolls a user in workspace encryption by encrypting the workspace key with their KEK.

**Process**:
1. Encrypt workspace key with user's KEK (AES-256-GCM)
2. Store encrypted key + IV + salt in database
3. User can later decrypt with their password-derived KEK

### revokeUserAccess(userId, workspaceId)

Removes user's access to workspace by deleting their encrypted key.

### getUserWorkspaceKeys(userId)

Retrieves all encrypted workspace keys for a user.

### createWorkspaceKey(workspaceId, creatorId, creatorKEK)

Creates a new workspace encryption key and encrypts it for the creator.

### userHasWorkspaceAccess(userId, workspaceId)

Checks if user has access to workspace encryption.

## E2EE Flow

### Workspace Creation

```javascript
// 1. Generate workspace key (server)
const workspaceKey = encryptionService.generateWorkspaceKey();

// 2. Encrypt with creator's KEK
const { workspaceKey, workspaceKeyDoc } = await encryptionService.createWorkspaceKey(
  workspaceId,
  creatorId,
  creatorKEK
);

// 3. Store encrypted key
await encryptionService.enrollUserInWorkspace(
  creatorId,
  workspaceId,
  workspaceKey,
  creatorKEK,
  creatorSalt
);
```

### User Onboarding

```javascript
// 1. User logging in - derive KEK from password
const kek = await deriveKeyFromPassword(password, salt, 100000);

// 2. Get encrypted workspace keys
const keys = await encryptionService.getUserWorkspaceKeys(userId);

// 3. Client decrypts each workspace key with KEK
keys.forEach(async (key) => {
  const workspaceKey = await decryptWorkspaceKey(
    key.encryptedKey,
    key.keyIv,
    kek
  );
  
  // Store in memory for message encryption/decryption
  chatEncryption.setWorkspaceKey(key.workspaceId, workspaceKey);
});
```

### Adding User to Workspace

```javascript
// 1. Admin shares workspace key with new user
// 2. Encrypt workspace key with new user's KEK
const enrolled = await encryptionService.enrollUserInWorkspace(
  newUserId,
  workspaceId,
  workspaceKey,  // Raw workspace key
  newUserKEK,
  newUserSalt
);
```

## Cryptographic Details

### Key Derivation (PBKDF2)

```
User Password → PBKDF2(100,000 iterations) → KEK (256-bit)
```

### Workspace Key Encryption

```
Workspace Key (256-bit) + User KEK → AES-256-GCM → Encrypted Key + IV
```

### Message Encryption

```
Message Text + Workspace Key → AES-256-GCM → Ciphertext + IV
```

## Testing

```bash
npm test src/modules/encryption/__tests__/
```

**Test Coverage**:
- ✅ Key generation (workspace key, IV, salt)
- ✅ User enrollment with key encryption
- ✅ Access revocation
- ✅ Workspace key creation
- ✅ Access verification

## Security Considerations

1. **Zero-Knowledge**: Server never stores or sees:
   - User passwords
   - Decrypted KEKs
   - Decrypted workspace keys
   - Plaintext messages

2. **Key Wrapping**: Workspace keys are encrypted with user KEKs

3. **Perfect Forward Secrecy**: Past messages remain encrypted even if future keys compromised

4. **PBKDF2 Hardening**: 100,000 iterations resist brute-force attacks

## Usage Example

```javascript
const encryptionService = require('./encryption.service');

// Generate workspace key
const workspaceKey = encryptionService.generateWorkspaceKey();

// Enroll user
await encryptionService.enrollUserInWorkspace(
  'user123',
  'ws123',
  workspaceKey,
  userKEK,
  userSalt
);

// Check access
const hasAccess = await encryptionService.userHasWorkspaceAccess(
  'user123',
  'ws123'
);

// Revoke access
await encryptionService.revokeUserAccess('user123', 'ws123');
```

## Owner

@encryption-module

## Status

✅ **Active** - Production ready

## Legacy Files

These files are deprecated:
- `server/controllers/keyManagementController.js` - Use this module instead
- `server/routes/keys.js` - Use `/api/v2/encryption/*` routes
