const { GoogleGenerativeAI } = require("@google/generative-ai");
const User = require("../models/User");

// Initialize Gemini

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ FATAL: GEMINI_API_KEY is missing in aiController");
} else {
    console.log(`✅ AI Controller loaded with API Key (length: ${apiKey.length})`);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- Chat Handler ---
exports.chat = async (req, res) => {
    try {
        console.log("➡️ aiController.chat called");
        const { message, history } = req.body;
        console.log(`Input message: ${message}`);
        console.log(`History length: ${history?.length || 0}`);

        // Construct prompt with context
        const chat = model.startChat({
            history: history ? history.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            })) : [],
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        res.status(200).json({ text });
    } catch (error) {

        console.error("❌ AI Chat Error Full Object:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error("❌ AI Chat Error Response:", error.response);
        res.status(500).json({ message: "AI Service Unavailable", error: error.message, details: error.toString() });
    }
};

// --- Summarize Handler ---
exports.summarize = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: "No text provided" });

        const prompt = `Summarize the following conversation/text clearly and concisely:\n\n${text}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        res.status(200).json({ summary });
    } catch (error) {
        console.error("AI Summarize Error:", error);
        res.status(500).json({ message: "Summarization Failed", error: error.message });
    }
};

// --- Task Generation Handler ---
exports.generateTask = async (req, res) => {
    try {
        const { context } = req.body; // e.g., "Review the quarterly report by Friday"

        const prompt = `Extract a task from the following context: "${context}". 
        Return ONLY a JSON object with: { "title": "...", "description": "...", "priority": "medium" (low/medium/high) }. 
        Do not include markdown formatting.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let taskJson = response.text();

        // Simple cleanup if model returns markdown block
        taskJson = taskJson.replace(/```json/g, "").replace(/```/g, "").trim();

        try {
            const taskData = JSON.parse(taskJson);
            res.status(200).json(taskData);
        } catch (e) {
            res.status(200).json({
                title: "New Task",
                description: context,
                priority: "medium"
            });
        }
    } catch (error) {
        console.error("AI Task Gen Error:", error);
        res.status(500).json({ message: "Task Generation Failed", error: error.message });
    }
};
