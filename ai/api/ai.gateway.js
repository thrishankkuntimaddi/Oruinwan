/**
 * ai/api/ai.gateway.js
 *
 * AI Gateway — Sub-Phase A8: AI Layer Isolation
 *
 * This file is the central gateway for all AI operations in the Chttrix platform.
 *
 * Architecture (current):
 *   client → server routes → ai.gateway.js → server/src/features/ai/ai.controller.js
 *
 * Architecture (future):
 *   client → server routes → ai.gateway.js → AI orchestrator / agents / memory
 *
 * DESIGN RULES:
 *   - No dependency on Express, HTTP request objects, or route handlers.
 *   - Accepts plain data payloads and context objects only.
 *   - Acts as a pure service layer proxy until the AI subsystem is extracted.
 *
 * NOTE ON PROXYING:
 *   The existing controller functions are Express handlers that read from req/res.
 *   Rather than passing fake request objects (anti-pattern), this gateway calls the
 *   underlying Gemini SDK and utility functions directly — the same logic the
 *   controller uses — so that it remains framework-agnostic.
 *
 *   This approach keeps the gateway clean and ready to route through the orchestrator
 *   in a future phase without any Express coupling.
 */

'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---------------------------------------------------------------------------
// Internal helpers (mirror controller internals — controller is NOT modified)
// ---------------------------------------------------------------------------

const {
  sendMessageToChannel,
  sendToAllGeneralChannels,
  getUserChannels,
  createTaskForUser,
  getCurrentWorkspace,
} = require('../../server/src/utils/aiActions');

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ [AI Gateway] GEMINI_API_KEY is missing');
} else {
  console.log(`✅ [AI Gateway] Initialised with API Key (length: ${apiKey.length})`);
}

const genAI = new GoogleGenerativeAI(apiKey);

/** Shared Gemini model with function-calling declarations (mirrors controller). */
const chatModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  tools: [
    {
      functionDeclarations: [
        {
          name: 'send_message_to_channel',
          description:
            'Send a message to a specific channel. Use this when user wants to send a message to a particular channel.',
          parameters: {
            type: 'object',
            properties: {
              channelId: {
                type: 'string',
                description: 'The ID of the channel to send message to',
              },
              message: {
                type: 'string',
                description: 'The message content to send',
              },
            },
            required: ['channelId', 'message'],
          },
        },
        {
          name: 'send_message_to_all_general_channels',
          description:
            "Send the same message to all channels named 'general' across all user's workspaces.",
          parameters: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The message to send to all general channels',
              },
            },
            required: ['message'],
          },
        },
        {
          name: 'get_user_channels',
          description:
            'Get list of channels the user is a member of. Can optionally filter by workspace.',
          parameters: {
            type: 'object',
            properties: {
              workspaceId: {
                type: 'string',
                description:
                  'Optional workspace ID to filter channels. If not provided, returns all channels across all workspaces.',
              },
            },
          },
        },
        {
          name: 'create_task',
          description: "Create a new task for the user. Extract task details from user's request.",
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task title (required)' },
              description: { type: 'string', description: 'Task description (optional)' },
              dueDate: {
                type: 'string',
                description: 'Due date in ISO format YYYY-MM-DD (optional)',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Task priority (optional, defaults to medium)',
              },
            },
            required: ['title'],
          },
        },
        {
          name: 'get_current_workspace',
          description: "Get the user's current workspace information",
          parameters: { type: 'object', properties: {} },
        },
      ],
    },
  ],
});

/**
 * Execute a tool/function requested by the Gemini model.
 * Mirrors executeFunction() in ai.controller.js — controller is NOT modified.
 *
 * @param {{ name: string, args: object }} functionCall
 * @param {string} userId
 * @param {string|null} workspaceId
 * @param {object|null} reqContext  Optional Express req for actions that need it.
 *                                  Will be null when called from a pure-service context.
 */
async function _executeFunction(functionCall, userId, workspaceId, reqContext) {
  const { name, args } = functionCall;
  console.log(`🤖 [AI Gateway] Executing function: ${name}`, args);

  try {
    switch (name) {
      case 'send_message_to_channel':
        return await sendMessageToChannel(args.channelId, args.message, userId, reqContext);

      case 'send_message_to_all_general_channels':
        return await sendToAllGeneralChannels(args.message, userId, reqContext);

      case 'get_user_channels':
        return await getUserChannels(args.workspaceId || null, userId);

      case 'create_task':
        return await createTaskForUser({ ...args, userId });

      case 'get_current_workspace':
        return await getCurrentWorkspace(userId);

      default:
        return { success: false, error: `Unknown function: ${name}` };
    }
  } catch (err) {
    console.error(`❌ [AI Gateway] Error executing ${name}:`, err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Public Gateway API
// ---------------------------------------------------------------------------

/**
 * chat() — AI conversational interface.
 *
 * @param {object} payload
 * @param {string}   payload.message      The user's message.
 * @param {Array}    [payload.history]    Prior conversation history.
 * @param {string}   [payload.workspaceId] Active workspace identifier.
 * @param {object} context
 * @param {string}   context.userId       Authenticated user ID.
 * @param {object}   [context.req]        Optional: original Express req, passed
 *                                        through only for action utilities that
 *                                        need it (e.g. socket emission).
 *
 * @returns {Promise<{ text: string, actionsExecuted?: Array }>}
 */
export async function chat(payload, context) {
  // TODO (A9+): route through AI orchestrator instead of calling Gemini directly.

  const { message, history = [], workspaceId } = payload;
  const { userId, req: reqContext = null } = context;

  console.log('➡️ [AI Gateway] chat() called');
  console.log(`   message: ${message}`);
  console.log(`   history length: ${history.length}`);
  console.log(`   userId: ${userId}`);

  const geminiHistory = history.map((msg) => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  const chatSession = chatModel.startChat({
    history: geminiHistory,
    generationConfig: { maxOutputTokens: 2000 },
  });

  let result = await chatSession.sendMessage(message);
  let response = result.response;

  const functionCalls = response.functionCalls();

  if (functionCalls && functionCalls.length > 0) {
    console.log(`🤖 [AI Gateway] AI requested ${functionCalls.length} function call(s)`);

    const functionResponses = await Promise.all(
      functionCalls.map(async (call) => {
        const functionResult = await _executeFunction(call, userId, workspaceId, reqContext);
        return { name: call.name, response: functionResult };
      })
    );

    console.log(
      '[AI Gateway] Function results:',
      JSON.stringify(functionResponses, null, 2)
    );

    const finalResult = await chatSession.sendMessage([
      {
        functionResponse: {
          name: functionResponses[0].name,
          response: functionResponses[0].response,
        },
      },
    ]);

    const finalResponse = finalResult.response;

    return {
      text: finalResponse.text(),
      actionsExecuted: functionCalls.map((call, i) => ({
        function: call.name,
        parameters: call.args,
        result: functionResponses[i].response,
      })),
    };
  }

  return { text: response.text() };
}

/**
 * summarize() — Summarise a body of text or conversation transcript.
 *
 * @param {object} payload
 * @param {string}   payload.text  The text to summarise.
 * @param {object} _context        Reserved for future use (e.g. user preferences).
 *
 * @returns {Promise<{ summary: string }>}
 */
export async function summarize(payload, _context) {
  // TODO (A9+): route through AI orchestrator instead of calling Gemini directly.

  const { text } = payload;

  if (!text) {
    throw new Error('[AI Gateway] summarize(): No text provided');
  }

  console.log('➡️ [AI Gateway] summarize() called');

  const summarizeModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const prompt = `Summarize the following conversation/text clearly and concisely:\n\n${text}`;

  const result = await summarizeModel.generateContent(prompt);
  const response = await result.response;
  const summary = response.text();

  return { summary };
}

/**
 * generateTask() — Extract a structured task object from a natural-language context string.
 *
 * @param {object} payload
 * @param {string}   payload.context  The text from which a task should be extracted.
 * @param {object} _context           Reserved for future use.
 *
 * @returns {Promise<{ title: string, description: string, priority: string }>}
 */
export async function generateTask(payload, _context) {
  // TODO (A9+): route through AI orchestrator instead of calling Gemini directly.

  const { context } = payload;

  console.log('➡️ [AI Gateway] generateTask() called');

  const taskModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  const prompt = `Extract a task from the following context: "${context}".
Return ONLY a JSON object with: { "title": "...", "description": "...", "priority": "medium" (low/medium/high) }.
Do not include markdown formatting.`;

  const result = await taskModel.generateContent(prompt);
  const response = await result.response;
  let taskJson = response.text();

  // Strip markdown code fences if the model includes them.
  taskJson = taskJson.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(taskJson);
  } catch (_e) {
    // Graceful fallback — mirrors controller behaviour.
    return {
      title: 'New Task',
      description: context,
      priority: 'medium',
    };
  }
}
