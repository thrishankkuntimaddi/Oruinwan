'use strict';

/**
 * Natural-language commands from the command palette (Cmd+/):
 * classify the intent through the AI gateway, then execute it with the same
 * services the UI uses (so permissions, notifications and sockets all apply).
 */
const gateway = require('../ai.gatewayResolver');
const aiCore = require('../ai-core.service');
const meetingsSvc = require('../../meetings/meetings.service');
const logger = require('../../../../utils/logger');

const INTENTS = {
    CREATE_TASK: 'create_task',
    SUMMARIZE_CHANNEL: 'summarize_channel',
    SCHEDULE_MEETING: 'schedule_meeting',
    ASK_QUESTION: 'ask_question',
    GENERATE_TASKS: 'generate_tasks',
    UNKNOWN: 'unknown',
};

const sys = (context = {}) => ({ userId: context.userId || 'system', ...context });

async function parseCommand(command, userId, workspaceId, context = {}) {
    if (!command) return { intent: INTENTS.UNKNOWN, result: { message: 'No command provided' } };

    let classified = { intent: INTENTS.UNKNOWN, title: null, dueDate: null };
    try {
        classified = await gateway.classifyIntent({ command, intents: Object.values(INTENTS) }, sys({ userId, workspaceId, ...context, req: undefined }));
    } catch (err) {
        logger.warn('[AI-Automation] intent classification fallback:', err.message);
        classified.intent = _heuristicIntent(command);
    }
    const intent = classified.intent || INTENTS.UNKNOWN;

    switch (intent) {
        case INTENTS.CREATE_TASK:
            return { intent, result: await _handleCreateTask(command, userId, workspaceId, classified, context) };
        case INTENTS.GENERATE_TASKS:
            return { intent, result: await generateTasksFromText(command, workspaceId, userId, context) };
        case INTENTS.SCHEDULE_MEETING:
            return { intent, result: await _handleScheduleMeeting(command, userId, workspaceId) };
        case INTENTS.SUMMARIZE_CHANNEL:
            return { intent, result: { message: 'Open the channel and use "Summarize conversation" in Oruinwan AI — messages are end-to-end encrypted, so the summary runs on what your device can read.' } };
        case INTENTS.ASK_QUESTION: {
            const knowledge = require('../knowledge/ai-knowledge.service');
            const answer = await knowledge.askQuestion(command, workspaceId, { userId, ...context, req: undefined });
            return { intent, result: { message: answer.answer, references: answer.references } };
        }
        default:
            return {
                intent: INTENTS.UNKNOWN,
                result: { message: 'I didn\'t understand that command. Try: "Create task for X", "Schedule a meeting for tomorrow", or ask a question about your workspace.' },
            };
    }
}

function _heuristicIntent(cmd) {
    const c = cmd.toLowerCase();
    if (/\b(create|add|new)\b.*\btask\b/.test(c)) return INTENTS.CREATE_TASK;
    if (/\bsummariz(e|ing)\b/.test(c)) return INTENTS.SUMMARIZE_CHANNEL;
    if (/\bschedul(e|ing)\b.*\bmeeting\b/.test(c)) return INTENTS.SCHEDULE_MEETING;
    if (/\b(what|how|who|when|where|why|explain)\b/.test(c)) return INTENTS.ASK_QUESTION;
    if (/\bgenerate\b.*\btask(s)?\b/.test(c)) return INTENTS.GENERATE_TASKS;
    return INTENTS.UNKNOWN;
}

async function _handleCreateTask(command, userId, workspaceId, classified, context) {
    const title = (classified.title || command.replace(/^(create|add|new)\s+(a\s+)?task\s+(for|to|about)?\s*/i, '').trim() || 'New Task').slice(0, 200);
    try {
        const tasksService = require('../../tasks/tasks.service');
        const out = await tasksService.createTask(userId, {
            workspaceId: String(workspaceId), title, assignmentType: 'self', priority: 'medium',
            dueDate: classified.dueDate ? new Date(classified.dueDate) : undefined, source: 'ai',
        }, context.req?.app?.get('io') || null, context.req);
        const task = Array.isArray(out?.tasks) ? out.tasks[0] : (out?.task || out);
        return { message: `Task created: "${task?.title || title}"`, task: task ? { _id: task._id, title: task.title, status: task.status, dueDate: task.dueDate } : { title } };
    } catch (err) {
        logger.error('[AI-Automation] _handleCreateTask error:', err.message);
        return { message: `Could not create the task: ${err.message}` };
    }
}

async function generateTasksFromText(text, workspaceId, userId, context = {}) {
    const { tasks, items } = await aiCore.extractTasks(text, { userId, workspaceId, ...context, req: undefined });
    return { tasks: items, detailed: tasks, message: `Found ${items.length} potential task(s)` };
}

async function _handleScheduleMeeting(command, userId) {
    try {
        const suggestion = await meetingsSvc.suggestTime({ participantIds: [userId] });
        return { message: 'Meeting time suggestion ready', suggested: suggestion, command };
    } catch (err) {
        return { message: 'Could not generate meeting suggestion', error: err.message };
    }
}

module.exports = { parseCommand, generateTasksFromText, INTENTS };
