'use strict';

/**
 * Tool registry.
 *
 * Each tool pairs a function declaration (sent to the model) with an executor.
 * Executors receive the model's arguments plus the call context and delegate
 * to an `actions` object, which keeps this module free of database code. The
 * server injects its real implementation from server/utils/aiActions.js.
 *
 * Every action receives `ctx = { userId, workspaceId, req, io }` and must
 * enforce membership itself; the model never gets to pick the user.
 */

const DECLARATIONS = [
  {
    name: 'get_current_workspace',
    description: "Get the workspace the user is currently working in (id, name, the user's role).",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_user_channels',
    description: 'List the channels the user is a member of in the current workspace.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_workspace_members',
    description: 'List members of the current workspace (id, username, role). Use it to resolve names to user ids before assigning tasks or sending direct messages.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'send_message_to_channel',
    description: 'Post a message in a channel on behalf of the user. Only when the user explicitly asks to send/post something.',
    parameters: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'The channel id (from get_user_channels)' },
        message: { type: 'string', description: 'The message text' },
      },
      required: ['channelId', 'message'],
    },
  },
  {
    name: 'send_direct_message',
    description: 'Send a direct message to a workspace member on behalf of the user. Only when explicitly asked.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Recipient user id (from get_workspace_members)' },
        message: { type: 'string', description: 'The message text' },
      },
      required: ['userId', 'message'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task in the current workspace. Assign it to the user unless assignee ids are given.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        description: { type: 'string', description: 'Task description (optional)' },
        dueDate: { type: 'string', description: 'Due date YYYY-MM-DD (optional)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority (optional, defaults to medium)' },
        assigneeIds: { type: 'array', items: { type: 'string' }, description: 'User ids to assign (optional)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_my_tasks',
    description: "List the user's tasks in the current workspace, optionally filtered by status.",
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'], description: 'Optional status filter' },
        limit: { type: 'number', description: 'Max tasks to return (default 20)' },
      },
    },
  },
  {
    name: 'update_task_status',
    description: 'Move one of the user\'s tasks to a new status.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task id (from list_my_tasks)' },
        status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'] },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a personal note in the current workspace with a title and Markdown body.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string', description: 'Markdown content' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'list_recent_notes',
    description: "List the user's most recent notes in the current workspace (id, title, updated time).",
    parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Max notes (default 10)' } } },
  },
  {
    name: 'search_workspace',
    description: 'Search the current workspace\'s knowledge pages, notes and tasks by keywords (messages are end-to-end encrypted and not searchable).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Keywords' } },
      required: ['query'],
    },
  },
  {
    name: 'schedule_meeting',
    description: 'Schedule a meeting in the current workspace at a given time with optional participants.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startsAt: { type: 'string', description: 'ISO 8601 date-time' },
        durationMinutes: { type: 'number', description: 'Defaults to 30' },
        participantIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'startsAt'],
    },
  },
  {
    name: 'remember_about_user',
    description: 'Save a lasting fact or preference about the user for future chats, e.g. their role, team, timezone or how they like answers. Only when the user asks you to remember something or clearly states a lasting preference.',
    parameters: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'One short sentence, written about the user, e.g. "Leads the design team" or "Prefers short answers"' },
      },
      required: ['fact'],
    },
  },
  {
    name: 'forget_about_user',
    description: 'Delete saved facts about the user that match a phrase. Only when the user asks you to forget something.',
    parameters: {
      type: 'object',
      properties: { about: { type: 'string', description: 'Words identifying what to forget, e.g. "timezone"' } },
      required: ['about'],
    },
  },
];

const ACTION_FOR = {
  get_current_workspace: 'getCurrentWorkspace',
  get_user_channels: 'getUserChannels',
  get_workspace_members: 'getWorkspaceMembers',
  send_message_to_channel: 'sendMessageToChannel',
  send_direct_message: 'sendDirectMessage',
  create_task: 'createTaskForUser',
  list_my_tasks: 'listMyTasks',
  update_task_status: 'updateTaskStatus',
  create_note: 'createNote',
  list_recent_notes: 'listRecentNotes',
  search_workspace: 'searchWorkspace',
  schedule_meeting: 'scheduleMeeting',
  remember_about_user: 'rememberAboutUser',
  forget_about_user: 'forgetAboutUser',
};

/**
 * @param {object} actions  Implementation of the side effects. Missing actions
 *                          make the corresponding tool unavailable.
 * @returns {Array<{ declaration: object, execute: Function }>}
 */
function createTools(actions = {}) {
  return DECLARATIONS
    .filter((d) => typeof actions[ACTION_FOR[d.name]] === 'function')
    .map((declaration) => ({
      declaration,
      execute: (args, ctx) => actions[ACTION_FOR[declaration.name]](args || {}, ctx),
    }));
}

module.exports = { DECLARATIONS, ACTION_FOR, createTools };
