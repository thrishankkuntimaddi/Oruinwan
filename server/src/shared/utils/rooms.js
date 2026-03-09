// server/src/shared/utils/rooms.js
//
// Phase 2 — Company Communication Layer
//
// Canonical Socket.IO room name helpers.
// All socket room join/emit calls should use this module —
// never hardcode room strings inline.
//
// Convention: <scope>:<id>:<channel>
//
// Usage:
//   io.to(ROOMS.companyUpdates(companyId)).emit('company:update:created', payload);
//   socket.join(ROOMS.companyUpdates(companyId));

const ROOMS = {
    // Company-wide broadcast — updates feed
    // Clients: join when entering the Owner Console / Updates feed
    companyUpdates: (companyId) => `company:${companyId}:updates`,

    // Department-scoped broadcast
    departmentUpdates: (companyId, deptId) => `company:${companyId}:dept:${deptId}:updates`,

    // Manager-scoped broadcast
    managersRoom: (companyId) => `company:${companyId}:managers`,

    // Analytics live refresh (owner dashboard)
    companyAnalytics: (companyId) => `company:${companyId}:analytics`,

    // Individual user notification room
    userNotifications: (userId) => `user:${userId}:notifications`,

    // Workspace room (preserved for workspace-level events, not modified)
    workspace: (workspaceId) => `workspace:${workspaceId}`,

    // Channel room (preserved, not modified)
    channel: (channelId) => `channel:${channelId}`,
};

module.exports = ROOMS;
