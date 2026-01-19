# Chttrix Communication Spec - Quick Reference

## Component Guide

### Modals

#### ThreadsViewModal
**Location:** `client/src/components/messagesComp/chatWindowComp/modals/ThreadsViewModal.jsx`

**Usage:**
```jsx
<ThreadsViewModal
  isOpen={showThreadsView}
  onClose={() => setShowThreadsView(false)}
  messages={messages}
  threadCounts={threadCounts}
  onOpenThread={openThread}
  formatTime={(ts) => new Date(ts).toLocaleTimeString()}
/>
```

**Props:**
- `isOpen` (boolean) - Controls modal visibility
- `onClose` (function) - Close handler
- `messages` (array) - All channel messages
- `threadCounts` (object) - Map of message ID to reply count
- `onOpenThread` (function) - Handler to open thread panel
- `formatTime` (function) - Time formatting function

**Features:**
- Filters messages with `replyCount > 0`
- Real-time search
- Sorted by last reply time
- Shows reply count and participant avatars

---

#### MemberListModal
**Location:** `client/src/components/messagesComp/chatWindowComp/modals/MemberListModal.jsx`

**Usage:**
```jsx
<MemberListModal
  isOpen={showMemberList}
  onClose={() => setShowMemberList(false)}
  members={channelMembersWithJoinDates}
  channelName={chat.name?.replace(/^#/, '')}
  currentUserId={currentUserIdRef.current}
  onStartDM={(userId) => console.log('Start DM with', userId)}
  onViewProfile={(userId) => console.log('View profile', userId)}
/>
```

**Props:**
- `isOpen` (boolean) - Controls modal visibility
- `onClose` (function) - Close handler
- `members` (array) - Channel members with join dates
- `channelName` (string) - Channel name for display
- `currentUserId` (string) - Current user's ID
- `onStartDM` (function) - Handler for DM button
- `onViewProfile` (function) - Handler for profile button

**Features:**
- Smart sorting (online > role > alphabetical)
- Search by username or email
- Role badges (Owner, Admin)
- Online/offline indicators
- Join date formatting

---

#### MessageInfoModal
**Location:** `client/src/components/messagesComp/chatWindowComp/modals/MessageInfoModal.jsx`

**Usage:**
```jsx
<MessageInfoModal
  msg={selectedMessage}
  onClose={() => setInspectedMessage(null)}
  currentUserId={currentUserIdRef.current}
  workspaceMembers={workspaceMembers}
/>
```

**Props:**
- `msg` (object) - Message to display info for
- `onClose` (function) - Close handler
- `currentUserId` (string) - Current user's ID
- `workspaceMembers` (array) - All workspace members

**Features:**
- Encryption status display
- Reactions detail with user names
- Read receipts
- Delivery status
- Works for all messages

---

### Header Enhancements

**File:** `client/src/components/messagesComp/chatWindowComp/header/header.jsx`

**New Props:**
```jsx
<Header
  // ... existing props
  onShowThreadsView={() => setShowThreadsView(true)}
/>
```

**New Icons:**
- 🧵 Threads View (channels only)
- 🎥 Meeting (placeholder)

**Channel Type Icons:**
- `#` - Public channels
- 🔒 - Private channels
- 📢 - Announcements channel

**DM Status:**
- Green dot (🟢) - Online
- Gray dot - Offline
- "Active now" or "Offline" text

---

### Message Components

#### ChannelMessageItem
**File:** `client/src/components/messagesComp/chatWindowComp/messages/ChannelMessageItem.jsx`

**Changes:**
- Message Info now available for ALL messages
- Removed `isMe` restriction

**Menu Actions:**
1. Copy text
2. Reply
3. Pin/Unpin
4. **Message info** (NEW: for all users)
5. Delete for me
6. Delete for everyone

---

#### DMMessageItem
**File:** `client/src/components/messagesComp/chatWindowComp/messages/DMMessageItem.jsx`

**Changes:**
- Added Message Info action
- Same functionality as channel messages

**Menu Actions:**
1. Pin/Unpin
2. Copy text
3. **Message info** (NEW)
4. Delete for me
5. Delete for everyone

---

### Footer Component

**File:** `client/src/components/messagesComp/chatWindowComp/footer/footerInput.jsx`

**Universal Features:**
- Bold, Italic, Links, Lists
- Emoji picker
- File attachments
- Voice recording
- @ChttrixAI mentions (channels only)

**Context-Aware:**
- **Channels:** Full features + @mentions
- **DMs:** Full features, no @mentions
- **Threads:** Uses ThreadPanel footer (same features)

**Markdown Conversion:**
```jsx
const handleSend = () => {
  let markdown = turndownService.turndown(newMessage);
  onSend(markdown);
};
```

---

### Thread Panel

**File:** `client/src/components/messagesComp/chatWindowComp/ThreadPanel.jsx`

**Features:**
- Parent message highlighted (blue background)
- Visual separator between parent and replies
- Rich text footer (Bold, Italic, Link, List)
- Emoji picker and file attachments
- Auto-scroll to new replies
- Optimistic updates

---

## State Management

### Chat Window State

```jsx
// Modal states
const [showThreadsView, setShowThreadsView] = useState(false);
const [showMemberList, setShowMemberList] = useState(false);
const [inspectedMessage, setInspectedMessage] = useState(null);

// Thread state
const [activeThread, setActiveThread] = useState(null);
const [threadCounts, setThreadCounts] = useState({});

// Message state
const [messages, setMessages] = useState([]);
const [channelMembersWithJoinDates, setChannelMembersWithJoinDates] = useState([]);
```

---

## Socket Events

**Used Events:**
- `new-message` - New message received
- `thread-reply` - New thread reply
- `reaction-added` - Reaction added to message
- `reaction-removed` - Reaction removed
- `message-pinned` - Message pinned
- `message-unpinned` - Message unpinned
- `message-deleted` - Message deleted
- `read-update` - Read receipts update
- `typing` - User typing indicator
- `user:online` - User went online
- `user:offline` - User went offline

**Contract:** See `SOCKET_CONTRACT.md` for full details

---

## Styling Guidelines

### Tailwind Classes

**Dark Mode:**
```jsx
className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
```

**Hover States:**
```jsx
className="hover:bg-gray-100 dark:hover:bg-gray-800"
```

**Focus States:**
```jsx
className="focus:ring-2 focus:ring-blue-500 focus:outline-none"
```

**Buttons:**
```jsx
className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
```

---

## Common Patterns

### Opening Modals

```jsx
// Add state
const [showModal, setShowModal] = useState(false);

// Add button
<button onClick={() => setShowModal(true)}>
  Open Modal
</button>

// Render modal
<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  // ... other props
/>
```

---

### Handling Message Actions

```jsx
const infoMessage = (messageId) => {
  const message = messages.find(m => m.id === messageId);
  setInspectedMessage(message);
};

// Pass to message component
<MessageItem
  msg={msg}
  infoMessage={infoMessage}
  // ... other props
/>
```

---

### Formatting Time

```jsx
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};
```

---

### Join Date Formatting

```jsx
const formatJoinDate = (date) => {
  if (!date) return 'Unknown';
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return d.toLocaleDateString();
};
```

---

## Accessibility

### ARIA Labels

```jsx
<button
  title="Threads View - Show only threaded messages"
  aria-label="Open threads view"
  onClick={() => setShowThreadsView(true)}
>
  <MessageSquare size={16} />
</button>
```

### Keyboard Navigation

- **Escape** - Close modals
- **Enter** - Submit forms, send messages
- **Shift+Enter** - New line in message input
- **Tab** - Navigate between elements

---

## Performance Tips

### useMemo for Filtering

```jsx
const filteredMembers = useMemo(() => {
  if (!searchQuery) return sortedMembers;
  return sortedMembers.filter(m => 
    m.username.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [sortedMembers, searchQuery]);
```

### React.memo for List Items

```jsx
const MessageItem = React.memo(({ msg, ...props }) => {
  // Component logic
});

export default MessageItem;
```

---

## Debugging

### Common Issues

**Modal won't close:**
- Check if `isOpen` state is being updated
- Verify `onClose` handler is called
- Check for stopPropagation issues

**Icons not showing:**
- Verify lucide-react import
- Check icon name spelling
- Ensure icon size prop is set

**Dark mode not working:**
- Check Tailwind config has `darkMode: 'class'`
- Verify `dark:` prefix on all color classes
- Test with browser/OS dark mode toggle

**Search not filtering:**
- Check useMemo dependencies
- Verify search query is lowercase
- Ensure filter logic is correct

---

## File Structure

```
client/src/components/messagesComp/chatWindowComp/
├── chatWindow.jsx (Main container)
├── header/
│   └── header.jsx (Enhanced with icons and buttons)
├── footer/
│   └── footerInput.jsx (Universal footer)
├── messages/
│   ├── ChannelMessageItem.jsx (Enhanced with info action)
│   ├── DMMessageItem.jsx (Enhanced with info action)
│   └── messagesContainer.jsx
├── modals/
│   ├── ThreadsViewModal.jsx (NEW)
│   ├── MemberListModal.jsx (NEW)
│   └── MessageInfoModal.jsx (ENHANCED)
└── ThreadPanel.jsx (Verified footer functionality)
```

---

## API Endpoints Used

**Messages:**
- `GET /api/messages/channel/:channelId`
- `GET /api/messages/dm/:workspaceId/:userId`
- `POST /api/messages`

**Threads:**
- `GET /api/messages/thread/:messageId`
- `POST /api/messages/thread/:messageId`

**Channels:**
- `GET /api/channels/:id/members`
- `GET /api/channels/:workspaceId`

**No new endpoints required!**

---

## Environment Variables

**Client (.env):**
```
REACT_APP_API_BASE=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
```

**Server (.env):**
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/chttrix
JWT_SECRET=your_jwt_secret
```

---

## Next Steps

1. ✅ Run comprehensive tests (see TESTING_GUIDE.md)
2. ✅ Test in all browsers (Chrome, Firefox, Safari)
3. ✅ Verify dark mode throughout
4. ✅ Performance test with large datasets
5. ✅ Accessibility audit
6. ⏳ Create MeetingModal (optional)
7. ⏳ Implement profile view (optional)
8. ⏳ Add keyboard shortcuts (optional)

---

## Support

**Documentation:**
- `TESTING_GUIDE.md` - Comprehensive testing scenarios
- `SOCKET_CONTRACT.md` - Socket event specifications
- `implementation_plan.md` - Original implementation plan
- `walkthrough.md` - Feature walkthrough

**Key Files:**
- Main container: `chatWindow.jsx`
- Header: `header.jsx`
- Threading: `ThreadPanel.jsx`, `ThreadsViewModal.jsx`
- Members: `MemberListModal.jsx`
- Message info: `MessageInfoModal.jsx`

---

## Changelog

### v0.1.0 - Initial Implementation (66% Complete)

**Added:**
- ✅ Channel type icons (public, private, announcements)
- ✅ DM online/offline indicators
- ✅ ThreadsViewModal for filtering threaded messages
- ✅ MemberListModal with join dates and roles
- ✅ Enhanced MessageInfoModal with encryption and reactions
- ✅ Universal message info access (all users)
- ✅ Verified thread panel footer functionality
- ✅ Confirmed universal footer across contexts

**Modified:**
- `header.jsx` - Added icons, threads button, meeting button
- `MessageInfoModal.jsx` - Added sections for encryption, reactions
- `ChannelMessageItem.jsx` - Removed message info restriction
- `DMMessageItem.jsx` - Added message info action
- `chatWindow.jsx` - Integrated new modals

**Technical:**
- 0 backend changes
- 0 new API endpoints
- 0 new socket events
- Full backward compatibility
