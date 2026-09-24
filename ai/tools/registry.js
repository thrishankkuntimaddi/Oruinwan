'use strict';

/**
 * Tool registry.
 *
 * Each tool pairs a function declaration (sent to the model) with an executor.
 * Executors receive the model's arguments plus the call context and delegate
 * to an `actions` object, which keeps this module free of database code. The
 * server injects its real implementation from server/utils/aiActions.js.
 */

const DECLARATIONS = [
  {
    name: 'send_message_to_channel',
    description: 'Send a message to a specific channel. Use this when the user wants to post to a particular channel.',
    parameters: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'The ID of the channel to send the message to' },
        message: { type: 'string', description: 'The message content to send' },
      },
      required: ['channelId', 'message'],
    },
  },
  {
    name: 'send_message_to_all_general_channels',
    description: "Send the same message to every channel named 'general' across all of the user's workspaces.",
    parameters: {
      type: 'object',
      properties: { message: { type: 'string', description: 'The message to send' } },
      required: ['message'],
    },
  },
  {
    name: 'get_user_channels',
    description: 'List the channels the user is a member of, optionally filtered by workspace.',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: 'Optional workspace ID to filter by' },
      },
    },
  },
  {
    name: 'create_task',
    description: "Create a new task for the user. Extract the details from the user's request.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        description: { type: 'string', description: 'Task description (optional)' },
        dueDate: { type: 'string', description: 'Due date in ISO format YYYY-MM-DD (optional)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Task priority (optional, defaults to medium)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_current_workspace',
    description: "Get the user's current workspace information.",
    parameters: { type: 'object', properties: {} },
  },
];

/**
 * @param {object} actions  Implementation of the side effects. Missing actions
 *                          make the corresponding tool unavailable.
 * @returns {Array<{ declaration: object, execute: Function }>}
 */
function createTools(actions = {}) {
  const executors = {
    send_message_to_channel: (args, ctx) =>
      actions.sendMessageToChannel(args.channelId, args.message, ctx.userId, ctx.req || null),
    send_message_to_all_general_channels: (args, ctx) =>
      actions.sendToAllGeneralChannels(args.message, ctx.userId, ctx.req || null),
    get_user_channels: (args, ctx) =>
      actions.getUserChannels(args.workspaceId || ctx.workspaceId || null, ctx.userId),
    create_task: (args, ctx) =>
      actions.createTaskForUser({ ...args, userId: ctx.userId, workspaceId: ctx.workspaceId || undefined }),
    get_current_workspace: (_args, ctx) => actions.getCurrentWorkspace(ctx.userId),
  };

  const actionFor = {
    send_message_to_channel: 'sendMessageToChannel',
    send_message_to_all_general_channels: 'sendToAllGeneralChannels',
    get_user_channels: 'getUserChannels',
    create_task: 'createTaskForUser',
    get_current_workspace: 'getCurrentWorkspace',
  };

  return DECLARATIONS
    .filter((d) => typeof actions[actionFor[d.name]] === 'function')
    .map((declaration) => ({ declaration, execute: executors[declaration.name] }));
}

module.exports = { DECLARATIONS, createTools };
