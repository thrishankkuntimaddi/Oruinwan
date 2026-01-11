const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
console.log(`🔑 API Key found: ${apiKey ? 'YES' : 'NO'}`);
console.log(`📏 API Key length: ${apiKey?.length}`);

// Test with correct model name
async function testAPI() {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        // Try gemini-pro first (stable model)
        console.log('\n🧪 Testing with model: gemini-pro');
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const result = await model.generateContent("Say hello!");
        const response = await result.response;
        const text = response.text();

        console.log('✅ API WORKS!');
        console.log('📝 Response:', text);
        console.log('\n✨ Use model name: "gemini-pro"');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('📊 Status:', error.status);

        // Try alternative model
        if (error.status === 404) {
            console.log('\n🔄 Trying alternative model: gemini-1.5-pro');
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

                const result = await model.generateContent("Say hello!");
                const response = await result.response;
                const text = response.text();

                console.log('✅ API WORKS with gemini-1.5-pro!');
                console.log('📝 Response:', text);
                console.log('\n✨ Use model name: "gemini-1.5-pro"');
            } catch (err2) {
                console.error('❌ Also failed with gemini-1.5-pro:', err2.message);
            }
        }
    }
}

testAPI();
