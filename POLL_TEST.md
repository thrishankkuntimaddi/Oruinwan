# Poll System - Complete Test Plan

## Current State
✅ Backend API exists at `/api/polls`
✅ Poll button exists in header (line 208-216)  
✅ Modal state exists (`showCreatePoll`)
✅ Handler opens modal (line 1482)
✅ Modal component exists (`CreatePollModal.jsx`)
✅ Modal rendered (line 1781-1786)
✅ Create handler calls backend API (line 1805-1834)

## Test Steps

### TEST 1: Does Poll Button Appear?
1. Open browser → http://localhost:3000
2. Go to #announcements channel
3. Look for poll button (chart icon) in header
4. **EXPECTED:** Button visible near other header buttons
5. **IF NOT:** Check browser console for import errors

### TEST 2: Does Modal Open?
1. Click the poll button
2. **EXPECTED:** Modal pops up with poll form
3. **IF NOT:** Check browser console for errors

### TEST 3: Can You Create a Poll?
1. In modal:
   - Question: "Test poll?"
   - Option 1: "Yes"
   - Option 2: "No"
2. Click "Create Poll"
3. **EXPECTED:** 
   - Toast: "Poll created successfully!"
   - Modal closes
   - Poll appears in chat
4. **IF NOT:** Check Network tab for POST request

### TEST 4: Does Poll Display?
1. Look for poll message in chat
2. **EXPECTED:** Poll card with question and options
3. **IF NOT:** Check if PollMessage component renders

### TEST 5: Can You Vote?
1. Click an option in the poll
2. **EXPECTED:**
   - Toast: "Vote recorded!"
   - Percentages update
3. **IF NOT:** Check Network tab

## Debugging Commands

```bash
# Check browser console
Open DevTools (F12) → Console tab

# Check network requests
Open DevTools → Network tab → Filter: XHR

# Check React components
Install React DevTools extension
Look for CreatePollModal in component tree
```

## What I Need From You

Please test TEST 1 and tell me:
1. Do you see the poll button?
2. What happens when you click it?
3. Any errors in console?

Then I'll fix the exact issue.
