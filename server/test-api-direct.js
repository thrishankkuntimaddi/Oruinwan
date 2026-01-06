const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;

async function testAPIDirectly() {
    console.log('🔑 Testing API key with direct HTTP request...\n');

    const url = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        console.log('✅ API Key is VALID!\n');
        console.log('📋 Available models:');
        data.models?.forEach(model => {
            console.log(`\n🔹 ${model.name}`);
            console.log(`   Methods: ${model.supportedGenerationMethods?.join(', ')}`);
        });

        // Find a model that supports generateContent
        const contentModel = data.models?.find(m =>
            m.supportedGenerationMethods?.includes('generateContent')
        );

        if (contentModel) {
            console.log(`\n✨ RECOMMENDED MODEL: ${contentModel.name}`);

            // Test it
            await testGeneration(contentModel.name);
        }
    } catch (error) {
        console.error('❌ API Error:', error.response?.status, error.response?.statusText);
        console.error('📝 Response:', error.response?.data);
        console.error('Message:', error.message);
    }
}

async function testGeneration(modelName) {
    console.log(`\n🧪 Testing generation with ${modelName}...\n`);

    const url = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`;

    try {
        const response = await axios.post(url, {
            contents: [{
                parts: [{
                    text: 'Say hello in one sentence!'
                }]
            }]
        });

        const data = response.data;

        console.log('✅ Generation WORKS!');
        console.log('📝 Response:', data.candidates[0].content.parts[0].text);
        console.log(`\n🎯 USE THIS MODEL IN CODE: "${modelName.replace('models/', '')}"`);
    } catch (error) {
        console.error('❌ Generation failed:', error.response?.status);
        console.error('📝 Error:', error.response?.data);
    }
}

testAPIDirectly();
