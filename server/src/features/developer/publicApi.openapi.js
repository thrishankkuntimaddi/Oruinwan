'use strict';

/**
 * OpenAPI 3.0 description of the public REST API (v1), served unauthenticated at
 * GET /api/public/v1/openapi.json. Keep in step with publicApi.routes.js — the
 * test in __tests__/publicApi.openapi.test.js checks every router path is described.
 */

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const SCOPES = {
  'messages:read': 'Message metadata in public channels (never content)',
  'tasks:read': 'List tasks',
  'tasks:write': 'Create tasks',
  'files:read': 'List workspace files',
  'users:read': 'List active members',
  'channels:read': 'List public channels',
};

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema, description = 'OK') => ({ description, content: { 'application/json': { schema } } });
const err = (description) => ({ description, content: { 'application/json': { schema: ref('Error') } } });
const limitParam = { name: 'limit', in: 'query', required: false, description: 'Page size (default 50, max 100)', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } };
const common = {
  401: err('Missing, invalid or revoked API key'),
  429: err('Rate limit exceeded (100 requests/minute per key)'),
};
const scoped = (scope) => ({ ...common, 403: err(`The key lacks the ${scope} scope`) });
const list = (key, item) => ({
  type: 'object',
  required: [key, 'count'],
  properties: { [key]: { type: 'array', items: ref(item) }, count: { type: 'integer' } },
});

function buildOpenApiSpec({ serverUrl = '/api/public/v1' } = {}) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Oruinwan Public API',
      version: '1.0.0',
      description: 'REST API for workspace integrations. Authenticate with a workspace API key or an app token '
        + '(header X-Api-Key). Messages are end-to-end encrypted, so only message metadata is ever returned. '
        + 'The unversioned /api/public/* path is a deprecated alias of v1.',
    },
    servers: [{ url: serverUrl }],
    security: [{ ApiKey: [] }],
    tags: [
      { name: 'Key', description: 'The calling key or app token' },
      { name: 'Messages' }, { name: 'Tasks' }, { name: 'Files' }, { name: 'Users' }, { name: 'Channels' },
    ],
    paths: {
      '/me': {
        get: {
          tags: ['Key'], operationId: 'getMe', summary: 'Describe the calling key',
          description: 'Workspace, scopes and (for app tokens) the owning app. Needs no scope.',
          responses: { 200: json(ref('KeyInfo')), ...common },
        },
      },
      '/messages': {
        get: {
          tags: ['Messages'], operationId: 'listMessages', summary: 'List message metadata', 'x-scope': 'messages:read',
          description: 'Newest first, public non-archived channels only. Content is end-to-end encrypted and never returned.',
          parameters: [
            { name: 'channelId', in: 'query', required: false, description: 'A public channel id', schema: { type: 'string' } },
            limitParam,
          ],
          responses: {
            200: json(list('messages', 'MessageMeta')),
            400: err('Malformed channelId'),
            404: err('Channel is not a public channel of this workspace'),
            ...scoped('messages:read'),
          },
        },
      },
      '/tasks': {
        get: {
          tags: ['Tasks'], operationId: 'listTasks', summary: 'List tasks', 'x-scope': 'tasks:read',
          parameters: [
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: TASK_STATUSES } },
            limitParam,
          ],
          responses: { 200: json(list('tasks', 'Task')), 400: err('Invalid status'), ...scoped('tasks:read') },
        },
        post: {
          tags: ['Tasks'], operationId: 'createTask', summary: 'Create a task', 'x-scope': 'tasks:write',
          description: "Created as the key's creator, who must still be a workspace member.",
          requestBody: { required: true, content: { 'application/json': { schema: ref('TaskInput') } } },
          responses: {
            201: json({ type: 'object', properties: { task: ref('Task') } }, 'Created'),
            400: err('Validation error'),
            ...scoped('tasks:write'),
          },
        },
      },
      '/files': {
        get: {
          tags: ['Files'], operationId: 'listFiles', summary: 'List workspace files', 'x-scope': 'files:read',
          parameters: [limitParam],
          responses: { 200: json(list('files', 'File')), ...scoped('files:read') },
        },
      },
      '/users': {
        get: {
          tags: ['Users'], operationId: 'listUsers', summary: 'List active members', 'x-scope': 'users:read',
          responses: { 200: json(list('users', 'User')), ...scoped('users:read') },
        },
      },
      '/channels': {
        get: {
          tags: ['Channels'], operationId: 'listChannels', summary: 'List public channels', 'x-scope': 'channels:read',
          responses: { 200: json(list('channels', 'Channel')), ...scoped('channels:read') },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKey: {
          type: 'apiKey', in: 'header', name: 'X-Api-Key',
          description: 'Workspace API key (chx_…) from Developer → API keys, or the app token issued when an app is installed. '
            + `Scopes: ${Object.entries(SCOPES).map(([k, v]) => `${k} (${v})`).join('; ')}.`,
        },
      },
      schemas: {
        Error: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } },
        KeyInfo: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            keyPrefix: { type: 'string', example: 'chx_1a2b3c4d' },
            name: { type: 'string', nullable: true },
            scopes: { type: 'array', items: { type: 'string', enum: [...Object.keys(SCOPES), '*'] } },
            app: { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string', nullable: true } } },
          },
        },
        MessageMeta: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            channelId: { type: 'string', nullable: true },
            sender: { type: 'object', nullable: true, properties: { id: { type: 'string' }, username: { type: 'string' } } },
            type: { type: 'string' },
            parentId: { type: 'string', nullable: true },
            replyCount: { type: 'integer' },
            attachmentCount: { type: 'integer' },
            isEncrypted: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            editedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Task: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: TASK_STATUSES },
            priority: { type: 'string', enum: TASK_PRIORITIES },
            assignedTo: { type: 'array', items: { type: 'object', properties: { _id: { type: 'string' }, username: { type: 'string' } } } },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            issueKey: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TaskInput: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', maxLength: 500 },
            description: { type: 'string' },
            priority: { type: 'string', enum: TASK_PRIORITIES, default: 'medium' },
            status: { type: 'string', enum: TASK_STATUSES.filter((s) => s !== 'blocked'), default: 'todo' },
            dueDate: { type: 'string', format: 'date-time' },
            assigneeIds: { type: 'array', items: { type: 'string' } },
          },
        },
        File: {
          type: 'object',
          properties: {
            _id: { type: 'string' }, name: { type: 'string' }, mimeType: { type: 'string' },
            size: { type: 'integer' }, url: { type: 'string' }, folderId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' }, username: { type: 'string' },
            firstName: { type: 'string', nullable: true }, lastName: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true }, role: { type: 'string' },
          },
        },
        Channel: {
          type: 'object',
          properties: {
            _id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
            topic: { type: 'string' }, isDefault: { type: 'boolean' }, membersCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  };
}

module.exports = { buildOpenApiSpec, SCOPES };
