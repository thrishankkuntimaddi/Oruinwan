/**
 * platform/constants/socketEvents.js
 *
 * Chttrix Platform — Centralized Socket Event Registry
 *
 * Single source of truth for all Socket.IO event names used across the
 * platform. All platforms (web, desktop, mobile) and the server should
 * eventually reference these constants rather than inline string literals.
 *
 * Phase A4: Definition only — no integration yet.
 * Integration phase will replace inline strings in:
 *   • server/socket/index.js
 *   • client/src/contexts/SocketContext.jsx
 *   • client/src/hooks/useChatSocket.js
 */

export const SOCKET_EVENTS = Object.freeze({

    // ─── Connection / Session ──────────────────────────────────────────────
    RECONNECTED:              'reconnected',

    // ─── Room Joins ────────────────────────────────────────────────────────
    JOIN_DM:                  'join-dm',
    JOIN_CHANNEL:             'join-channel',
    JOIN_WORKSPACE:           'join-workspace',
    JOIN_COMPANY_UPDATES:     'join-company-updates',
    LEAVE_COMPANY_UPDATES:    'leave-company-updates',
    CHAT_JOIN:                'chat:join',           // acknowledged join variant

    // ─── Messages ─────────────────────────────────────────────────────────
    SEND_MESSAGE:             'send-message',
    NEW_MESSAGE:              'new-message',
    MESSAGE_SENT:             'message-sent',        // ack to sender
    SEND_ERROR:               'send-error',
    MESSAGE_DELETED:          'message-deleted',
    MESSAGE_PINNED:           'message-pinned',
    MESSAGE_UNPINNED:         'message-unpinned',
    NEW_DM_SESSION:           'new-dm-session',
    THREAD_REPLY:             'thread-reply',

    // ─── Read Receipts ─────────────────────────────────────────────────────
    MARK_CHAT_READ:           'mark-chat-read',
    MESSAGE_READ:             'message-read',
    READ_UPDATE:              'read-update',

    // ─── Typing ────────────────────────────────────────────────────────────
    TYPING:                   'typing',

    // ─── Reactions ─────────────────────────────────────────────────────────
    ADD_REACTION:             'add-reaction',
    REMOVE_REACTION:          'remove-reaction',
    REACTION_ADDED:           'reaction-added',
    REACTION_REMOVED:         'reaction-removed',
    REACTION_ERROR:           'reaction-error',

    // ─── Message Moderation ────────────────────────────────────────────────
    DELETE_MESSAGE:           'delete-message',
    DELETE_ERROR:             'delete-error',
    PIN_MESSAGE:              'pin-message',
    UNPIN_MESSAGE:            'unpin-message',
    PIN_ERROR:                'pin-error',

    // ─── Channels ──────────────────────────────────────────────────────────
    CHANNEL_CREATED:          'channel-created',
    CHANNEL_UPDATED:          'channel-updated',
    CHANNEL_DELETED:          'channel-deleted',
    CHANNEL_PRIVACY_CHANGED:  'channel-privacy-changed',
    CHANNEL_MEMBER_ADDED:     'channel-member-added',
    CHANNEL_MEMBER_JOINED:    'channel-member-joined',
    CHANNEL_MEMBER_REMOVED:   'channel-member-removed',
    MEMBER_LEFT:              'member-left',
    INVITED_TO_CHANNEL:       'invited-to-channel',
    REMOVED_FROM_CHANNEL:     'removed-from-channel',
    ADMIN_ASSIGNED:           'admin-assigned',
    ADMIN_DEMOTED:            'admin-demoted',
    MESSAGES_CLEARED:         'messages-cleared',
    JOIN_ERROR:               'join-error',

    // ─── Channel Tabs ──────────────────────────────────────────────────────
    TAB_ADDED:                'tab-added',
    TAB_UPDATED:              'tab-updated',
    TAB_DELETED:              'tab-deleted',

    // ─── Workspaces ────────────────────────────────────────────────────────
    WORKSPACE_JOINED:         'workspace-joined',
    WORKSPACE_CREATED:        'workspace-created',
    WORKSPACE_UPDATED:        'workspace-updated',
    WORKSPACE_DELETED:        'workspace-deleted',

    // ─── Tasks ─────────────────────────────────────────────────────────────
    TASK_CREATED:             'task-created',
    TASK_UPDATED:             'task-updated',
    TASK_DELETED:             'task-deleted',
    TASK_ASSIGNED:            'task-assigned',
    TASK_REMOVED:             'task-removed',

    // ─── Notes ─────────────────────────────────────────────────────────────
    NOTE_CREATED:             'note-created',
    NOTE_UPDATED:             'note-updated',
    NOTE_DELETED:             'note-deleted',
    NOTE_SHARED:              'note-shared',

    // ─── Company Updates ───────────────────────────────────────────────────
    COMPANY_UPDATE_CREATED:   'company:update:created',
    COMPANY_UPDATE_DELETED:   'company:update:deleted',
    COMPANY_UPDATE_REACTED:   'company:update:reacted',

    // ─── Notifications ─────────────────────────────────────────────────────
    NOTIFICATION_NEW:         'notification:new',

    // ─── User Presence ─────────────────────────────────────────────────────
    USER_STATUS_CHANGED:      'user-status-changed',

    // ─── Scheduled Meetings ────────────────────────────────────────────────
    SCHEDULE_CREATED:         'schedule:created',
    SCHEDULE_UPDATED:         'schedule:updated',
    SCHEDULE_DELETED:         'schedule:deleted',
});
