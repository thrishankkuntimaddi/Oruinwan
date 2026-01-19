# Testing Checklist - Systematic Debugging

## Step 1: Verify Poll Button Exists

**Open:** http://localhost:3000
**Go to:** #announcements channel
**Look for:** Poll button (📊) in header near search

**If button exists:**
- ✅ Header component is rendering
- ✅ onCreatePoll prop is being passed
- → Proceed to Step 2

**If button missing:**
- ❌ Check: Is `chat.type === "channel"`?
- ❌ Check: Is `onCreatePoll` prop defined?
- → Fix: Verify Header component receives prop

---

## Step 2: Test Poll Button Click

**Action:** Click the Poll button

**Expected:** CreatePollModal opens

**If modal opens:**
- ✅ Modal state is working
- ✅ Modal component renders
- → Proceed to Step 3

**If modal doesn't open:**
- ❌ Check browser console for errors
- ❌ Check: Is `showCreatePoll` state updating?
- ❌ Check: Is CreatePollModal imported correctly?
- → Fix based on error

---

## Step 3: Test Poll Creation

**Action:**
1. Fill in question: "What's your favorite color?"
2. Add options: "Red", "Blue", "Green"
3. Click "Create Poll"

**Expected:**
- Network request to `POST /api/polls`
- Toast: "Poll created successfully!"
- Modal closes
- Poll appears in chat

**If poll doesn't appear:**
- ❌ Check Network tab: Did POST request succeed?
- ❌ Check response: Any error message?
- ❌ Check socket: Did 'new-message' event fire?
- → Fix based on issue

---

## Step 4: Test Poll Voting

**Action:** Click on a poll option

**Expected:**
- Network request to `POST /api/polls/:id/vote`
- Toast: "Vote recorded!"
- Results update with percentages

**If vote fails:**
- ❌ Check: Is poll ID correct?
- ❌ Check: Is optionIds array formatted correctly?
- ❌ Check backend logs for errors
- → Fix based on error

---

## Step 5: Test Tasks Tab

**Action:** Click "Tasks" tab in channel tabs

**Expected:** Tasks interface appears

**If tasks don't show:**
- ❌ Check: Is `activeTab === 'tasks'` condition working?
- ❌ Check: Is TasksTab component rendering?
- ❌ Check console for import errors
- → Fix based on issue

---

## Step 6: Test Canvas Tab

**Action:** Click "Canvas" tab

**Expected:** Canvas with drawing tools appears

**If canvas doesn't show:**
- ❌ Check: Is `activeTab === 'canvas'` condition working?
- ❌ Check: Is CanvasTab rendering?
- → Fix based on issue

---

## Common Issues to Check

### 1. Import Errors
```bash
# Check browser console for:
- "Module not found"
- "Failed to compile"
- "Unexpected token"
```

### 2. Prop Drilling Issues
```javascript
// Verify prop chain:
chatWindow.jsx sends onCreatePoll
  ↓
header.jsx receives onCreatePoll
  ↓
Button onClick calls onCreatePoll
```

### 3. State Not Updating
```javascript
// Add console.log to verify:
const handleCreatePoll = (poll) => {
  console.log('Creating poll:', poll); // Should log
  // ... rest of code
};
```

### 4. API Call Fails
```bash
# Check these:
- Is server running on port 5000?
- Is token in localStorage?
- Is CORS configured?
- Check server logs for errors
```

---

## Quick Fixes

### If Poll Button Missing:
```jsx
// In header.jsx, verify this exists:
{chat.type === "channel" && onCreatePoll && (
  <button onClick={onCreatePoll}>
    <BarChart2 size={16} />
  </button>
)}
```

### If Modal Not Opening:
```jsx
// In chatWindow.jsx, verify:
const [showCreatePoll, setShowCreatePoll] = useState(false);

// And in Header:
onCreatePoll={() => setShowCreatePoll(true)}
```

### If API Calls Fail:
```javascript
// Check token exists:
const token = localStorage.getItem('token');
console.log('Token:', token ? 'exists' : 'missing');
```

---

## Next Actions

1. **Open browser to http://localhost:3000**
2. **Open DevTools (F12)**
3. **Go to Console tab**
4. **Follow Steps 1-6 above**
5. **Report which step fails**

Then I can fix the EXACT issue instead of guessing.
