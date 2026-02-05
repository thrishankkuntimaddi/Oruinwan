const { GoogleGenerativeAI } = require("@google/generative-ai");
const _User = require("../../../models/User");
const {
    sendMessageToChannel,
    sendToAllGeneralChannels,
    getUserChannels,
    createTaskForUser,
    getCurrentWorkspace
} = require("../../../utils/aiActions");

// Initialize Gemini

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ FATAL: GEMINI_API_KEY is missing in aiController");
} else {
    console.log(`✅ AI Controller loaded with API Key (length: ${apiKey.length})`);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    tools: [{
        functionDeclarations: [
            {
                name: "send_message_to_channel",
                description: "Send a message to a specific channel. Use this when user wants to send a message to a particular channel.",
                parameters: {
                    type: "object",
                    properties: {
                        channelId: {
                            type: "string",
                            description: "The ID of the channel to send message to"
                        },
                        message: {
                            type: "string",
                            description: "The message content to send"
                        }
                    },
                    required: ["channelId", "message"]
                }
            },
            {
                name: "send_message_to_all_general_channels",
                description: "Send the same message to all channels named 'general' across all user's workspaces. Use this when user wants to broadcast a message to all general channels.",
                parameters: {
                    type: "object",
                    properties: {
                        message: {
                            type: "string",
                            description: "The message to send to all general channels"
                        }
                    },
                    required: ["message"]
                }
            },
            {
                name: "get_user_channels",
                description: "Get list of channels the user is a member of. Can optionally filter by workspace.",
                parameters: {
                    type: "object",
                    properties: {
                        workspaceId: {
                            type: "string",
                            description: "Optional workspace ID to filter channels. If not provided, returns all channels across all workspaces."
                        }
                    }
                }
            },
            {
                name: "create_task",
                description: "Create a new task for the user. Extract task details from user's request.",
                parameters: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "Task title (required)"
                        },
                        description: {
                            type: "string",
                            description: "Task description (optional)"
                        },
                        dueDate: {
                            type: "string",
                            description: "Due date in ISO format YYYY-MM-DD (optional)"
                        },
                        priority: {
                            type: "string",
                            enum: ["low", "medium", "high"],
                            description: "Task priority (optional, defaults to medium)"
                        }
                    },
                    required: ["title"]
                }
            },
            {
                name: "get_current_workspace",
                description: "Get the user's current workspace information",
                parameters: {
                    type: "object",
                    properties: {}
                }
            }
        ]
    }]
});

/**
 * Execute a function called by the AI
 */
async function executeFunction(functionCall, userId, workspaceId, req) {
    const { name, args } = functionCall;

    console.log(`🤖 Executing function: ${name}`, args);

    try {
        switch (name) {
            case "send_message_to_channel":
                return await sendMessageToChannel(args.channelId, args.message, userId, req);

            case "send_message_to_all_general_channels":
                return await sendToAllGeneralChannels(args.message, userId, req);

            case "get_user_channels":
                return await getUserChannels(args.workspaceId || null, userId);

            case "create_task":
                return await createTaskForUser({ ...args, userId });

            case "get_current_workspace":
                return await getCurrentWorkspace(userId);

            default:
                return { success: false, error: `Unknown function: ${name}` };
        }
    } catch (_error) {
        console.error(`❌ Error executing ${name}:`, error);
        return { success: false, error: error.message };
    }
}

// --- Chat Handler with Function Calling ---
exports.chat = async (req, res) => {
    try {
        console.log("➡️ aiController.chat called");
        const { message, history, workspaceId } = req.body;
        const userId = req.user.sub; // From auth middleware

        console.log(`Input message: ${message}`);
        console.log(`History length: ${history?.length || 0}`);
        console.log(`User ID: ${userId}`);

        // Start chat with function calling enabled
        const chat = model.startChat({
            history: history ? history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            })) : [],
            generationConfig: {
                maxOutputTokens: 2000,
            },
        });

        let result = await chat.sendMessage(message);
        let response = result.response;

        // Check if AI wants to call functions
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
            console.log(`🤖 AI wants to call ${functionCalls.length} function(s)`);

            // Execute all function calls with workspace context
            const functionResponses = await Promise.all(
                functionCalls.map(async (call) => {
                    const functionResult = await executeFunction(call, userId, workspaceId, req);
                    return {
                        name: call.name,
                        response: functionResult
                    };
                })
            );

            console.log("Function execution results:", JSON.stringify(functionResponses, null, 2));

            // Send function results back to AI for final response  
            const finalResult = await chat.sendMessage([{
                functionResponse: {
                    name: functionResponses[0].name,
                    response: functionResponses[0].response
                }
            }]);

            const finalResponse = finalResult.response;

            return res.status(200).json({
                text: finalResponse.text(),
                actionsExecuted: functionCalls.map((call, i) => ({
                    function: call.name,
                    parameters: call.args,
                    result: functionResponses[i].response
                }))
            });
        }

        // No function call, just return text response
        res.status(200).json({ text: response.text() });

    } catch (_error) {
        console.error("❌ AI Chat Error Full Object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error("❌ AI Chat Error:", error);
        res.status(500).json({
            message: "AI Service Unavailable",
            error: error.message,
            details: error.toString()
        });
    }
};

// --- Summarize Handler ---
exports.summarize = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: "No text provided" });

        const summarizeModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const prompt = `Summarize the following conversation/text clearly and concisely:\n\n${text}`;
        const result = await summarizeModel.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        res.status(200).json({ summary });
    } catch (_error) {
        console.error("AI Summarize Error:", error);
        res.status(500).json({ message: "Summarization Failed", error: error.message });
    }
};

// --- Task Generation Handler ---
exports.generateTask = async (req, res) => {
    try {
        const { context } = req.body;

        const taskModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        const prompt = `Extract a task from the following context: "${context}". 
        Return ONLY a JSON object with: { "title": "...", "description": "...", "priority": "medium" (low/medium/high) }. 
        Do not include markdown formatting.`;

        const result = await taskModel.generateContent(prompt);
        const response = await result.response;
        let taskJson = response.text();

        // Simple cleanup if model returns markdown block
        taskJson = taskJson.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const taskData = JSON.parse(taskJson);
            res.status(200).json(taskData);
        } catch (_e) {
            res.status(200).json({
                title: "New Task",
                description: context,
                priority: "medium"
            });
        }
    } catch (_error) {
        console.error("AI Task Gen Error:", error);
        res.status(500).json({ message: "Task Generation Failed", error: error.message });
    }
};
