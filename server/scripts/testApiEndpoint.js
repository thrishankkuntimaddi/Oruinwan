#!/usr/bin/env node
// server/scripts/testApiEndpoint.js
// Test the actual HTTP POST /api/companies/register endpoint

const http = require('http');

const testData = JSON.stringify({
    companyName: "API Test Company",
    adminName: "API Test Admin",
    adminEmail: "apitest@example.com",
    adminPassword: "APITestPassword123!"
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/companies/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': testData.length
    }
};

console.log('🚀 Testing POST /api/companies/register');
console.log('📝 Request Data:\n', testData, '\n');

const req = http.request(options, (res) => {
    let data = '';

    console.log(`✅ Response Status: ${res.statusCode}`);
    console.log('📋 Response Headers:\n', res.headers, '\n');

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📦 Response Body:\n', data, '\n');

        try {
            const jsonData = JSON.parse(data);
            console.log('✅ Parsed JSON Response:\n', JSON.stringify(jsonData, null, 2));

            if (res.statusCode === 201) {
                console.log('\n✅✅✅ REGISTRATION SUCCESSFUL! ✅✅✅\n');
            } else {
                console.log('\n❌ Registration failed with status:', res.statusCode);
            }
        } catch (e) {
            console.error('❌ Failed to parse JSON response:', e.message);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
});

req.write(testData);
req.end();
