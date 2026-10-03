'use strict';

/**
 * The event catalogue: every domain event the server publishes on the bus.
 *
 * An envelope is { id, name, at, companyId, workspaceId, actorId, payload }.
 * Payloads carry ids and metadata only. Messages are end-to-end encrypted, so
 * no event ever carries text, ciphertext, attachments or poll/contact contents.
 *
 * Adding an event: add it here first (name, what it means, payload fields,
 * which fields are required), then publish it from the producing service.
 * Consumers (webhooks, AI, notifications) only ever see catalogue events.
 */

const EVENTS = {
    'message.sent': {
        description: 'A message was posted in a public channel',
        since: '2026-10',
        payload: { messageId: 'string', channelId: 'string', senderId: 'string', type: 'string', parentId: 'string|null', hasAttachments: 'boolean', createdAt: 'date' },
        required: ['messageId', 'channelId'],
    },
    'message.deleted': {
        description: 'A message was deleted for everyone',
        since: '2026-10',
        payload: { messageId: 'string', channelId: 'string|null', dmId: 'string|null', deletedBy: 'string' },
        required: ['messageId'],
    },
    'task.created': {
        description: 'A task was created',
        since: '2026-10',
        payload: { taskId: 'string', title: 'string', priority: 'string', createdBy: 'string' },
        required: ['taskId'],
    },
    'task.updated': {
        description: 'A task was updated',
        since: '2026-10',
        payload: { taskId: 'string', title: 'string', status: 'string', updatedBy: 'string' },
        required: ['taskId'],
    },
    'task.completed': {
        description: 'A task was marked done',
        since: '2026-10',
        payload: { taskId: 'string', title: 'string', status: 'string', updatedBy: 'string' },
        required: ['taskId'],
    },
    'task.deleted': {
        description: 'A task was deleted (soft) by its creator or a workspace admin',
        since: '2026-10',
        payload: { taskId: 'string', deletedBy: 'string' },
        required: ['taskId'],
    },
    'note.created': {
        description: 'A note was created',
        since: '2026-10',
        payload: { noteId: 'string', title: 'string', createdBy: 'string' },
        required: ['noteId'],
    },
    'note.updated': {
        description: 'A note was edited',
        since: '2026-10',
        payload: { noteId: 'string', title: 'string', updatedBy: 'string' },
        required: ['noteId'],
    },
    'member.joined': {
        description: 'A user became a member of a workspace',
        since: '2026-10',
        payload: { userId: 'string', role: 'string', source: 'invite|registration|admin' },
        required: ['userId'],
    },
    'member.left': {
        description: 'A user left or was removed from a workspace',
        since: '2026-10',
        payload: { userId: 'string', removedBy: 'string|null' },
        required: ['userId'],
    },
    'channel.created': {
        description: 'A channel was created',
        since: '2026-10',
        payload: { channelId: 'string', name: 'string', isPrivate: 'boolean', createdBy: 'string' },
        required: ['channelId'],
    },
    'file.uploaded': {
        description: 'A file was stored in object storage',
        since: '2026-10',
        payload: { objectPath: 'string', name: 'string', size: 'number', mimeType: 'string', type: 'image|video|voice|file', folder: 'string' },
        required: ['objectPath'],
    },
    'integration.connected': {
        description: 'An integration was connected',
        since: '2026-10',
        payload: { type: 'string', integrationId: 'string' },
        required: ['type'],
    },
    'integration.disconnected': {
        description: 'An integration was disconnected',
        since: '2026-10',
        payload: { type: 'string' },
        required: ['type'],
    },
    'huddle.started': {
        description: 'A voice/video huddle started',
        since: '2026-10',
        payload: { huddleId: 'string', channelId: 'string|null', dmId: 'string|null', startedBy: 'string|null', video: 'boolean' },
        required: ['huddleId'],
    },
    'huddle.ended': {
        description: 'A huddle ended',
        since: '2026-10',
        payload: { huddleId: 'string', reason: 'ended|empty' },
        required: ['huddleId'],
    },
    'ai.answer_posted': {
        description: 'Oruinwan AI posted an answer into a conversation',
        since: '2026-10',
        payload: { messageId: 'string', channelId: 'string|null', dmId: 'string|null', requestedBy: 'string' },
        required: ['messageId'],
    },
};

function isKnownEvent(name) {
    return Object.prototype.hasOwnProperty.call(EVENTS, name);
}

/** Throws on an unknown event or a payload missing a required key. Returns the spec. */
function assertPayload(name, payload) {
    if (!isKnownEvent(name)) throw new Error(`Unknown event "${name}" (add it to src/shared/events/catalog.js)`);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error(`Event "${name}" needs an object payload`);
    const missing = (EVENTS[name].required || []).filter((k) => payload[k] === undefined || payload[k] === null || payload[k] === '');
    if (missing.length) throw new Error(`Event "${name}" payload is missing: ${missing.join(', ')}`);
    return EVENTS[name];
}

module.exports = { EVENTS, isKnownEvent, assertPayload, EVENT_NAMES: Object.keys(EVENTS) };
