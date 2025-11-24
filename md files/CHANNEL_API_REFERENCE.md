# Channel Management API - Complete Reference

## Overview
This document provides a complete reference for all channel-related API endpoints. The same functionality is available through two route namespaces for flexibility.

## Available Route Namespaces

### Option 1: `/api/channels` (Original)
Direct channel operations

### Option 2: `/api/chat` (Aliases)
Unified chat namespace including channels

---

## API Endpoints

### 1. Get My Channels
**Get all channels the authenticated user is a member of**

#### Endpoints:
- `GET /api/channels/my`
- `GET /api/chat/channels` *(alias)*

#### Authentication:
Required (Bearer token)

#### Request:
No body required

#### Response:
```json
{
  "channels": [
    {
      "_id": "channelId",
      "name": "general",
      "description": "General discussion",
      "members": ["userId1", "userId2"],
      "createdBy": "userId1",
      "isPrivate": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Implementation:
```javascript
exports.getMyChannels = async (req, res) => {
  const userId = req.user.sub;
  const channels = await Channel.find({ members: userId })
    .select("-__v")
    .lean();
  return res.json({ channels });
};
```

#### Features:
- ✅ Returns only channels where user is a member
- ✅ Uses MongoDB `$in` operator on members array
- ✅ Includes both public and private channels
- ✅ Sorted by creation date (newest first)

---

### 2. Create Channel
**Create a new channel (public or private)**

#### Endpoints:
- `POST /api/channels`
- `POST /api/chat/channel/create` *(alias)*

#### Authentication:
Required (Bearer token)

#### Request Body:
```json
{
  "name": "project-alpha",
  "description": "Discussion for Project Alpha",
  "isPrivate": false,
  "memberIds": ["userId1", "userId2"]
}
```

**Fields:**
- `name` (required): Channel name (string, non-empty)
- `description` (optional): Channel description (string)
- `isPrivate` (optional): Privacy setting (boolean, default: false)
- `memberIds` (optional): Initial members (array of user IDs)

#### Response:
```json
{
  "channel": {
    "_id": "newChannelId",
    "name": "project-alpha",
    "description": "Discussion for Project Alpha",
    "members": ["creatorId", "userId1", "userId2"],
    "isPrivate": false,
    "createdBy": "creatorId",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Features:
- ✅ Creator automatically added to members
- ✅ Prevents duplicate members
- ✅ Validates channel name (non-empty string)
- ✅ Broadcasts `channel-created` socket event
- ✅ Returns 201 status on success

#### Socket Event:
```javascript
io.emit("channel-created", {
  _id, name, description, members, isPrivate, createdBy, createdAt
});
```

---

### 3. Join Channel
**Join a public channel**

#### Endpoints:
- `POST /api/channels/:id/join`
- `POST /api/chat/channel/join` *(alias with channelId in body)*

#### Authentication:
Required (Bearer token)

#### Request:
**Option 1** (using `/api/channels/:id/join`):
```
POST /api/channels/channelId123/join
```
No body required

**Option 2** (using `/api/chat/channel/join`):
```json
{
  "channelId": "channelId123"
}
```

#### Response:
```json
{
  "channelId": "channelId123",
  "joined": true
}
```

#### Error Responses:
- `404`: Channel not found
- `403`: Cannot join private channel (invite-only)

#### Features:
- ✅ Only works for public channels
- ✅ Idempotent (no error if already a member)
- ✅ Adds user to members array
- ✅ Broadcasts `channel-member-joined` socket event

#### Socket Event:
```javascript
io.to(`channel_${channelId}`).emit("channel-member-joined", {
  channelId,
  userId
});
```

---

### 4. Invite to Channel
**Invite a user to a channel (public or private)**

#### Endpoint:
`POST /api/channels/:id/invite`

#### Authentication:
Required (Bearer token)

#### Permissions:
Only channel members can invite others

#### Request Body:
```json
{
  "userId": "userIdToInvite"
}
```

#### Response:
```json
{
  "channelId": "channelId123",
  "userId": "invitedUserId"
}
```

#### Error Responses:
- `404`: Channel not found
- `403`: Not a channel member (permission denied)
- `400`: User already a member

#### Features:
- ✅ Works for both public and private channels
- ✅ Only members can invite
- ✅ Prevents duplicate invitations
- ✅ Broadcasts two socket events

#### Socket Events:
```javascript
// To channel members
io.to(`channel_${channelId}`).emit("channel-member-added", {
  channelId,
  userId: inviteeId
});

// To invited user
io.to(`user_${inviteeId}`).emit("invited-to-channel", {
  channelId,
  channelName
});
```

---

### 5. Remove Member
**Remove a member from a channel**

#### Endpoint:
`DELETE /api/channels/:id/member`

#### Authentication:
Required (Bearer token)

#### Permissions:
Only channel creator can remove members

#### Request Body:
```json
{
  "userId": "userIdToRemove"
}
```

#### Response:
```json
{
  "channelId": "channelId123",
  "userId": "removedUserId"
}
```

#### Error Responses:
- `404`: Channel not found
- `403`: Only channel creator can remove members

#### Features:
- ✅ Creator-only permission
- ✅ Removes user from members array
- ✅ Broadcasts two socket events

#### Socket Events:
```javascript
// To channel members
io.to(`channel_${channelId}`).emit("channel-member-removed", {
  channelId,
  userId: victimId
});

// To removed user
io.to(`user_${victimId}`).emit("removed-from-channel", {
  channelId
});
```

---

### 6. Update Channel
**Update channel metadata (name, description, privacy)**

#### Endpoint:
`PUT /api/channels/:id`

#### Authentication:
Required (Bearer token)

#### Permissions:
Only channel creator can update

#### Request Body:
```json
{
  "name": "new-channel-name",
  "description": "Updated description",
  "isPrivate": true
}
```

**All fields are optional**

#### Response:
```json
{
  "channel": {
    "channelId": "channelId123",
    "name": "new-channel-name",
    "description": "Updated description",
    "isPrivate": true
  }
}
```

#### Features:
- ✅ Creator-only permission
- ✅ Partial updates supported
- ✅ Broadcasts `channel-updated` socket event

#### Socket Event:
```javascript
io.emit("channel-updated", {
  channelId,
  name,
  description,
  isPrivate
});
```

---

### 7. Get Channel Members
**Get list of all members in a channel**

#### Endpoint:
`GET /api/channels/:id/members`

#### Authentication:
Required (Bearer token)

#### Request:
No body required

#### Response:
```json
{
  "members": [
    {
      "_id": "userId1",
      "username": "john_doe",
      "profilePicture": "https://..."
    },
    {
      "_id": "userId2",
      "username": "jane_smith",
      "profilePicture": "https://..."
    }
  ]
}
```

#### Features:
- ✅ Returns populated user data
- ✅ Only returns _id, username, profilePicture
- ✅ No sensitive data exposed

---

## Route Mapping Summary

| Functionality | `/api/channels` Route | `/api/chat` Route |
|--------------|----------------------|-------------------|
| Get my channels | `GET /my` | `GET /channels` |
| Create channel | `POST /` | `POST /channel/create` |
| Join channel | `POST /:id/join` | `POST /channel/join` |
| Invite member | `POST /:id/invite` | N/A |
| Remove member | `DELETE /:id/member` | N/A |
| Update channel | `PUT /:id` | N/A |
| Get members | `GET /:id/members` | N/A |

---

## Socket Events Reference

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `channel-created` | `{ _id, name, description, members, isPrivate, createdBy, createdAt }` | New channel created |
| `channel-member-added` | `{ channelId, userId }` | Member added to channel |
| `channel-member-removed` | `{ channelId, userId }` | Member removed from channel |
| `channel-member-joined` | `{ channelId, userId }` | User joined public channel |
| `invited-to-channel` | `{ channelId, channelName }` | User invited to channel |
| `removed-from-channel` | `{ channelId }` | User removed from channel |
| `channel-updated` | `{ channelId, name, description, isPrivate }` | Channel metadata updated |

---

## Permission Model

### Public Channels
- **View**: Anyone can see in channel list
- **Join**: Anyone can join
- **Post**: Only members can post
- **Invite**: Only members can invite
- **Remove**: Only creator can remove
- **Update**: Only creator can update

### Private Channels
- **View**: Only members can see
- **Join**: Invite-only
- **Post**: Only members can post
- **Invite**: Only members can invite
- **Remove**: Only creator can remove
- **Update**: Only creator can update

---

## Frontend Integration

### Using the API

```javascript
// Get my channels
const response = await axios.get('/api/chat/channels', { headers });
const channels = response.data.channels;

// Create channel
const newChannel = await axios.post('/api/chat/channel/create', {
  name: 'project-alpha',
  description: 'Project discussion',
  isPrivate: false
}, { headers });

// Join channel
await axios.post('/api/chat/channel/join', {
  channelId: 'channelId123'
}, { headers });
```

### Socket Listeners

```javascript
socket.on('channel-created', (channel) => {
  // Add to channel list
});

socket.on('invited-to-channel', ({ channelId, channelName }) => {
  // Show notification
  // Add to channel list
});

socket.on('removed-from-channel', ({ channelId }) => {
  // Remove from channel list
  // Close chat if open
});
```

---

## Testing Checklist

- [ ] Create public channel
- [ ] Create private channel
- [ ] Get my channels (verify membership filter)
- [ ] Join public channel
- [ ] Try to join private channel (should fail)
- [ ] Invite user to channel
- [ ] Remove user from channel (as creator)
- [ ] Try to remove user (as non-creator, should fail)
- [ ] Update channel name
- [ ] Update channel privacy
- [ ] Get channel members
- [ ] Socket events fire correctly
- [ ] Duplicate prevention works
- [ ] Permission checks enforced

---

## Notes

- All endpoints require authentication
- Channel IDs are MongoDB ObjectIds
- Socket events use room-based broadcasting
- Membership validation uses MongoDB `$in` operator
- Duplicate prevention handled at application level
- Creator role is permanent (cannot be transferred)
