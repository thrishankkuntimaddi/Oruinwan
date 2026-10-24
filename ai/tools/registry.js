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
        channelId: { type: 'string', description: 'The channel: its id (from get_user_channels) or its name, e.g. "#design"' },
        message: { type: 'string', description: 'The message text' },
        mention: { type: 'array', items: { type: 'string' }, description: 'Optional people to @mention (user id, @username or name), or "here" / "channel"' },
      },
      required: ['channelId', 'message'],
    },
  },
  {
    name: 'create_thread',
    description: 'Start a thread: posts the thread title as a new message (as the user) and, when details are given, the details as its first reply. '
      + 'Defaults to the conversation you were asked in; give channel or person to start it elsewhere. '
      + 'Use when the user asks to create/start/open a thread, discussion or topic. Returns threadId (use it with reply_in_thread, create_task linkedMessageId or set_reminder) and a link.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title, e.g. "review is pending". It is posted as "[Thread] <topic>: <title>".' },
        topic: { type: 'string', description: 'Optional one- or two-word label, e.g. "review" -> "[Thread] review: review is pending"' },
        details: { type: 'string', description: 'Optional details, posted as the first reply inside the thread (Markdown)' },
        channel: { type: 'string', description: 'Optional channel id or name ("#design") when not the current conversation' },
        person: { type: 'string', description: "Optional: start it in the user's direct messages with this person (id, @username or name)" },
        mention: { type: 'array', items: { type: 'string' }, description: 'Optional people to @mention in the thread title (id, @username or name), or "here" / "channel"' },
      },
      required: ['title'],
    },
  },
  {
    name: 'reply_in_thread',
    description: 'Post a reply in a thread as the user. Without threadId it replies in the thread you were asked in. Only when the user asks to reply/answer/add something in a thread.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The reply text, written as the user' },
        threadId: { type: 'string', description: 'Optional thread id (e.g. from create_thread). Omit for the current thread.' },
        mention: { type: 'array', items: { type: 'string' }, description: 'Optional people to @mention (id, @username or name), or "here" / "channel" to notify the whole channel' },
      },
      required: ['message'],
    },
  },
  {
    name: 'send_direct_message',
    description: 'Send a direct message to a workspace member on behalf of the user, starting the conversation if they have none yet. Only when the user explicitly asks to message, tell or ping someone. Afterwards tell the user exactly what was sent and to whom.',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'Recipient: a user id (from the people the user @mentioned or get_workspace_members), their @username, or their name as the user wrote it (e.g. "Manideep")' },
        message: { type: 'string', description: 'The exact message text to send, written as the user (first person)' },
      },
      required: ['userId', 'message'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a task in the current workspace. Assigned to the user unless assignees are given. Returns taskId and a link.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        description: { type: 'string', description: 'Task description (optional)' },
        dueDate: { type: 'string', description: 'Due date YYYY-MM-DD (optional)' },
        priority: { type: 'string', enum: ['lowest', 'low', 'medium', 'high', 'highest'], description: 'Priority (optional, defaults to medium; "urgent" = highest)' },
        assignees: { type: 'array', items: { type: 'string' }, description: 'People to assign: user id, @username or name as the user wrote it (optional)' },
        assigneeIds: { type: 'array', items: { type: 'string' }, description: 'User ids to assign (optional; same as assignees)' },
        linkToConversation: { type: 'boolean', description: 'Link the task to the message / thread you were asked in (when the task comes from this conversation)' },
        linkedMessageId: { type: 'string', description: 'Optional message or thread id to link the task to (e.g. a threadId from create_thread)' },
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
    description: "Create a note owned by the user in the current workspace with a title and Markdown body (headings, lists, - [ ] checklists, code). Returns noteId and a link.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string', description: 'Markdown content' },
        shareWith: { type: 'array', items: { type: 'string' }, description: 'Optional workspace members to share it with (id, @username or name)' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'append_to_note',
    description: 'Add Markdown content to the end of an existing note the user can edit, found by noteId (from list_recent_notes or create_note) or by its exact title. Existing content is kept.',
    parameters: {
      type: 'object',
      properties: {
        noteId: { type: 'string', description: 'The note id (preferred)' },
        title: { type: 'string', description: 'The note title, when there is no id' },
        content: { type: 'string', description: 'Markdown to add' },
      },
      required: ['content'],
    },
  },
  {
    name: 'set_reminder',
    description: 'Remind the user about a message or thread at a time. Without messageId it is about the thread / message you were asked in. Only for the user themself.',
    parameters: {
      type: 'object',
      properties: {
        remindAt: { type: 'string', description: 'ISO 8601 date-time in the future' },
        note: { type: 'string', description: 'Optional short note shown with the reminder' },
        messageId: { type: 'string', description: 'Optional message or thread id (e.g. a threadId from create_thread)' },
      },
      required: ['remindAt'],
    },
  },
  {
    name: 'list_recent_notes',
    description: "List the user's most recent notes in the current workspace (id, title, updated time).",
    parameters: { type: 'object', properties: { limit: { type: 'number', description: 'Max notes (default 10)' } } },
  },
  {
    name: 'search_workspace',
    description: 'Search the current workspace\'s knowledge pages, notes and tasks by keywords (messages are end-to-end encrypted and not searchable here; for messages with a person the user @mentioned, use search_messages_with_person).',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Keywords' } },
      required: ['query'],
    },
  },
  {
    name: 'schedule_meeting',
    description: 'Schedule a meeting in the current workspace with optional participants. Give startsAt when the user named a time; leave it out to book the earliest slot where every participant is free and inside their working hours (optionally between earliest and latest). If no slot suits everyone, nothing is booked and the best candidate slots are returned so you can ask the user. A meeting booked at a given time that clashes with someone\'s other meeting is still booked; the result lists the clashes so you can tell the user.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startsAt: { type: 'string', description: 'ISO 8601 date-time. Omit to let the availability finder pick a time.' },
        durationMinutes: { type: 'number', description: 'Defaults to 30' },
        participantIds: { type: 'array', items: { type: 'string' } },
        earliest: { type: 'string', description: 'ISO 8601 date-time: when no startsAt, search for a slot from here (default now)' },
        latest: { type: 'string', description: 'ISO 8601 date-time: when no startsAt, the slot must start before this (default 7 days later, max 14)' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], description: 'How much the meeting matters (default normal)' },
      },
      required: ['title'],
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
  create_thread: 'createThread',
  reply_in_thread: 'replyInThread',
  create_task: 'createTaskForUser',
  list_my_tasks: 'listMyTasks',
  update_task_status: 'updateTaskStatus',
  create_note: 'createNote',
  append_to_note: 'appendToNote',
  list_recent_notes: 'listRecentNotes',
  search_workspace: 'searchWorkspace',
  schedule_meeting: 'scheduleMeeting',
  set_reminder: 'setReminder',
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
