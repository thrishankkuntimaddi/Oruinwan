// server/src/socket/roomConventions.js
//
// ARCH: Canonical Socket Room Naming Conventions for ChttrixCollab
//
// This file is the single source of truth for all socket room names.
// All socket.join() and io.to() calls must use these helpers — never hardcode room strings.
//
// ─────────────────────────────────────────────────────────────────────────────
// ROOM HIERARCHY
//
//  Platform Level
//    platform:admins                     → Chttrix platform admin broadcasts
//
//  Company Level (ARCH-FIX: added company-scoped rooms)
//    company:{companyId}                 → All active members of a company
//    company:{companyId}:updates         → Company-wide broadcast feed (Updates / Announcements)
//    company:{companyId}:admins          → Owner + Admin tier events (role changes, billing alerts)
//
//  Workspace Level
//    workspace:{workspaceId}             → All workspace members
//    workspace:{workspaceId}:admins      → Workspace owner + admin tier
//
//  Channel Level
//    channel:{channelId}                 → All channel members
//    channel:{channelId}:typing          → Typing indicators for this channel
//
//  Thread Level
//    thread:{threadId}                   → Thread participants
//
//  DM Level
//    dm:{sessionId}                      → DM session participants (existing — do not change)
//
//  User Level
//    user:{userId}                       → User-private events (notifications, key distribution)
//
// ─────────────────────────────────────────────────────────────────────────────
// USAGE GUIDELINES
//
//  1. Users join company:{companyId} on authentication.
//  2. Users join company:{companyId}:updates to receive announcements.
//  3. Workspace join MUST check company isolation before admitting to workspace room.
//  4. Channel events must NOT bleed into workspace or company rooms.
//  5. DM rooms follow existing convention — do not modify.

const ROOMS = {
    // ── Platform ───────────────────────────────────────────────────────────────
    platformAdmins: () => "platform:admins",

    // ── Company ────────────────────────────────────────────────────────────────
    company: (companyId) => `company:${companyId}`,
    companyUpdates: (companyId) => `company:${companyId}:updates`,   // ← ARCH-FIX: company announcements
    companyAdmins: (companyId) => `company:${companyId}:admins`,

    // ── Workspace ──────────────────────────────────────────────────────────────
    workspace: (workspaceId) => `workspace:${workspaceId}`,
    workspaceAdmins: (workspaceId) => `workspace:${workspaceId}:admins`,

    // ── Channel ────────────────────────────────────────────────────────────────
    channel: (channelId) => `channel:${channelId}`,
    channelTyping: (channelId) => `channel:${channelId}:typing`,

    // ── Thread ─────────────────────────────────────────────────────────────────
    thread: (threadId) => `thread:${threadId}`,

    // ── DM ─────────────────────────────────────────────────────────────────────
    // NOTE: DM room format must match existing socket implementation exactly.
    // Check socket/index.js for the current format before changing.
    dm: (sessionId) => `dm:${sessionId}`,

    // ── User (private) ─────────────────────────────────────────────────────────
    user: (userId) => `user:${userId}`,
};

module.exports = ROOMS;
