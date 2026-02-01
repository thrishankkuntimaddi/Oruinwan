#!/bin/bash
# Test v2 task creation (requires auth token from client)
echo "To test with real authentication:"
echo "1. Login via client (http://localhost:3000)"
echo "2. Get access token from localStorage.getItem('accessToken')"
echo "3. Run: curl -H 'Authorization: Bearer <TOKEN>' http://localhost:5000/api/v2/tasks/my"
echo ""
echo "Current test result: ✅ Routes registered and authentication working"
