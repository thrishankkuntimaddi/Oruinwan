// server/src/features/ai/automation/ai-automation.service.js
'use strict';

const aiCore   = require('../ai-core.service');
const meetingsSvc = require('../../meetings/meetings.service');
const logger   = require('../../../../utils/logger');

// ─── Intent Classification ────────────────────────────────────────────────────

const INTENTS = {
    CREATE_TASK:        'create_task',
    SUMMARIZE_CHANNEL:  'summarize_channel',
    SCHEDULE_MEETING:   'schedule_meeting',
    ASK_QUESTION:       'ask_question',
    GENERATE_TASKS:     'generate_tasks',
    UNKNOWN:            'unknown',
};

/**
 * Classify user intent and dispatch to the correct handler.
 * @param {string} command     Natural language command
 * @param {string} userId      Requesting user ID
 * @param {string} workspaceId
 * @returns {Promise<{ intent: string, result: object }>}
 */
async function parseCommand(command, userId, workspaceId) {
    if (!command) return { intent: INTENTS.UNKNOWN, result: { message: 'No command provided' } };

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
    let intent = INTENTS.UNKNOWN;

    if (apiKey) {
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-1.5-flash' });

            const classifyPrompt = [
                'Classify the following workplace command into one of these intents:',
                'create_task | summarize_channel | schedule_meeting | ask_question | generate_tasks | unknown',
                '',
                'Return ONLY the intent label as a single plain-text word, nothing else.',
                '',
                `Command: "${command}"`,
            ].join('\n');

            const result = await model.generateContent(classifyPrompt);
            const raw = result.response.text().trim().toLowerCase().replace(/[^a-z_]/g, '');
            if (Object.values(INTENTS).includes(raw)) intent = raw;
        } catch (err) {
            logger.error('[AI-Automation] intent classification error:', err.message);
            intent = _heuristicIntent(command);
        }
    } else {
        intent = _heuristicIntent(command);
    }

    // --- Dispatch ---
    switch (intent) {
        case INTENTS.CREATE_TASK:
            return { intent, result: await _handleCreateTask(command, userId, workspaceId) };
        case INTENTS.GENERATE_TASKS:
            return { intent, result: await _handleGenerateTasks(command, workspaceId, userId) };
        case INTENTS.SCHEDULE_MEETING:
            return { intent, result: await _handleScheduleMeeting(command, userId, workspaceId) };
        case INTENTS.SUMMARIZE_CHANNEL:
            return { intent, result: { message: 'Use the Summarize Channel button in the channel header to summarise it.' } };
        case INTENTS.ASK_QUESTION:
            return { intent, result: { message: 'Use the Ask AI panel to query your workspace knowledge base.' } };
        default:
            return {
                intent: INTENTS.UNKNOWN,
                result: { message: 'I didn\'t understand that command. Try: "Create task for X", "Summarize channel #general", or "Schedule a meeting for tomorrow."' },
            };
    }
}

/** Simple heuristic fallback when Gemini is unavailable */
function _heuristicIntent(cmd) {
    const c = cmd.toLowerCase();
    if (/\b(create|add|new)\b.*\btask\b/.test(c))       return INTENTS.CREATE_TASK;
    if (/\bsummariz(e|ing)\b/.test(c))                  return INTENTS.SUMMARIZE_CHANNEL;
    if (/\bschedul(e|ing)\b.*\bmeeting\b/.test(c))      return INTENTS.SCHEDULE_MEETING;
    if (/\b(what|how|who|when|where|why|explain)\b/.test(c)) return INTENTS.ASK_QUESTION;
    if (/\bgenerate\b.*\btask(s)?\b/.test(c))           return INTENTS.GENERATE_TASKS;
    return INTENTS.UNKNOWN;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function _handleCreateTask(command, userId, workspaceId) {
    try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
        let title = command.replace(/^(create|add|new)\s+task\s+(for\s+)?/i, '').trim();
        let dueDate = null;

        if (apiKey) {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-1.5-flash' });
            const prompt = [
                'Extract the task title and optional due date from this command.',
                'Return JSON: { "title": "...", "dueDate": "YYYY-MM-DD or null" }. Nothing else.',
                `Command: "${command}"`,
            ].join('\n');
            try {
                const r = await model.generateContent(prompt);
                let raw = r.response.text().trim().replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();
                const parsed = JSON.parse(raw);
                if (parsed.title) title = parsed.title;
                if (parsed.dueDate && parsed.dueDate !== 'null') dueDate = new Date(parsed.dueDate);
            } catch { /* keep heuristic title */ }
        }

        // Try to find Task model (works if tasks feature is present)
        let task = null;
        try {
            const TaskModel = require('../../../../models/Task');
            task = await TaskModel.create({
                title:       title || 'New Task',
                status:      'todo',
                priority:    'medium',
                workspaceId,
                createdBy:   userId,
                assignees:   [userId],
                dueDate:     dueDate || undefined,
            });
        } catch (dbErr) {
            logger.warn('[AI-Automation] Could not persist task:', dbErr.message);
        }

        return {
            message: `Task created: "${title}"`,
            task:    task ? { _id: task._id, title: task.title, status: task.status, dueDate: task.dueDate } : { title },
        };
    } catch (err) {
        logger.error('[AI-Automation] _handleCreateTask error:', err.message);
        return { message: 'Failed to create task', error: err.message };
    }
}

async function _handleGenerateTasks(text, workspaceId, userId) {
    const { items } = await aiCore.extractTasks(text);
    return { tasks: items, message: `Found ${items.length} potential task(s)` };
}

async function _handleScheduleMeeting(command, userId, workspaceId) {
    try {
        const suggestion = await meetingsSvc.suggestTime({ participantIds: [userId] });
        return {
            message:   'Meeting time suggestion ready',
            suggested: suggestion,
            command,
        };
    } catch (err) {
        return { message: 'Could not generate meeting suggestion', error: err.message };
    }
}

// ─── Generate Tasks from Content ──────────────────────────────────────────────

/**
 * Extract tasks from a block of text (message, meeting transcript, document).
 * @param {string} text
 * @param {string} workspaceId
 * @param {string} userId
 * @returns {Promise<{ tasks: string[], message: string }>}
 */
async function generateTasksFromText(text, workspaceId, userId) {
    const { items } = await aiCore.extractTasks(text);
    return { tasks: items, message: `Extracted ${items.length} task(s) from content` };
}

module.exports = { parseCommand, generateTasksFromText, INTENTS };
