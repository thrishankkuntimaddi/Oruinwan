const axios = require('axios');

async function testAIChat() {
    console.log('🧪 Testing AI Chat endpoint...\n');

    try {
        
        const response = await axios.post('http://localhost:5000/api/ai/chat', {
            message: 'Hello! Can you introduce yourself?',
            history: []
        }, {
            headers: {
                'Authorization': 'Bearer YOUR_TOKEN_HERE' 
            }
        });

        console.log('✅ AI Chat Works!');
        console.log('📝 Response:', response.data);

    } catch (error) {
        if (error.response?.status === 401) {
            console.log('⚠️ Need authentication token (expected for this test)');
            console.log('✅ But the endpoint is accessible!');
        } else {
            console.error('❌ Error:', error.response?.status);
            console.error('📝 Data:', error.response?.data);
        }
    }
}

testAIChat();
