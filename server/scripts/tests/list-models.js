const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        console.log('📋 Fetching available models...\n');

        
        const models = await genAI.listModels();

        console.log('✅ Available models:');
        for await (const model of models) {
            console.log(`\n🔹 ${model.name}`);
            console.log(`   Supported: ${model.supportedGenerationMethods?.join(', ')}`);
        }

    } catch (error) {
        console.error('❌ Error listing models:', error.message);

        
        console.log('\n🔄 Trying direct model names...');
        const testModels = [
            'models/gemini-pro',
            'gemini-pro',
            'models/gemini-1.5-flash',
            'gemini-1.5-flash',
            'models/gemini-1.5-pro',
            'gemini-1.5-pro'
        ];

        for (const modelName of testModels) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hi");
                console.log(`✅ WORKS: ${modelName}`);
                const response = await result.response;
                console.log(`   Response: ${response.text()}`);
                break;
            } catch (err) {
                console.log(`❌ FAILED: ${modelName}`);
            }
        }
    }
}

listModels();
