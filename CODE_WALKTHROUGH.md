# 📚 ChttrixCollab - Complete Code Walkthrough

> **A comprehensive guide to understanding the architecture, patterns, and implementation details of your full-stack collaboration platform**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Understanding the Tech Stack](#2-understanding-the-tech-stack)
3. [Code Flow: From Frontend to Backend](#3-code-flow-from-frontend-to-backend)
4. [Deep Dive: Authentication System](#4-deep-dive-authentication-system)
5. [Deep Dive: Real-Time Messaging](#5-deep-dive-real-time-messaging)
6. [Database Design & Models](#6-database-design--models)
7. [Key Patterns & Best Practices](#7-key-patterns--best-practices)
8. [Component Architecture](#8-component-architecture)
9. [State Management](#9-state-management)
10. [Security Implementation](#10-security-implementation)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React App)                        │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │   Pages    │  │  Components │  │  Context Providers   │ │
│  │ (Routes)   │  │    (UI)     │  │  (Global State)      │ │
│  └─────┬──────┘  └──────┬──────┘  └──────────┬───────────┘ │
│        │                 │                    │              │
│        └─────────────────┴────────────────────┘              │
│                          │                                   │
│                    (HTTP + WebSocket)                        │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    SERVER (Express + Socket.io)              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Routes    │  │ Controllers  │  │  Socket Handlers │   │
│  │ (Endpoints) │  │   (Logic)    │  │  (Real-time)     │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │
│         │                 │                   │              │
│         └─────────────────┴───────────────────┘              │
│                          │                                   │
│                  ┌───────┴────────┐                          │
│                  │  Middleware    │                          │
│                  │ (Auth, CORS)   │                          │
│                  └───────┬────────┘                          │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    MONGODB DATABASE                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐    │
│  │  Users  │  │Messages │  │Channels │  │  Companies  │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Request Flow Example

Let's trace what happens when a user sends a message:

```
User Types Message → React Component
    ↓
Socket.io Client emits "send-message"
    ↓
Server Socket Handler receives event
    ↓
Validates & Saves to MongoDB
    ↓
Broadcasts to room (channel or DM)
    ↓
All connected clients in room receive "new-message"
    ↓
React components update UI
```

---

## 2. Understanding the Tech Stack

### 2.1 Frontend Stack

#### **React 19.1.0**
- **Purpose**: UI framework
- **Why**: Component-based architecture, virtual DOM for performance
- **Usage in your app**: All UI components, pages, state management

#### **React Router 7.6.3**
- **Purpose**: Client-side routing
- **Why**: Single-page application with multiple views
- **Usage**: Defines all app routes in `App.js`

#### **Socket.io-client 4.8.1**
- **Purpose**: Real-time bidirectional communication
- **Why**: Live messaging, typing indicators, instant updates
- **Usage**: WebSocket connection to server for real-time features

#### **TailwindCSS 3.4.17**
- **Purpose**: Utility-first CSS framework
- **Why**: Rapid styling, consistent design system
- **Usage**: All component styling

### 2.2 Backend Stack

#### **Express 5.1.0**
- **Purpose**: Web framework for Node.js
- **Why**: Minimal, flexible, powerful routing and middleware
- **Usage**: All API endpoints, server setup

#### **MongoDB + Mongoose 8.20.1**
- **Purpose**: NoSQL database + ODM (Object Data Modeling)
- **Why**: Flexible schema, scalable, great for document-based data
- **Usage**: All data persistence (users, messages, companies, etc.)

#### **Socket.io 4.8.1**
- **Purpose**: Real-time engine
- **Why**: Enables WebSocket communication with fallback
- **Usage**: Powers all real-time features (messaging, typing, online status)

#### **JWT (jsonwebtoken)**
- **Purpose**: Stateless authentication
- **Why**: Secure, scalable, works across services
- **Usage**: Access tokens (15min) + Refresh tokens (7 days)

---

## 3. Code Flow: From Frontend to Backend

### 3.1 Understanding Your App.js (Entry Point)

```javascript
// client/src/App.js

function App() {
  return (
    <AuthProvider>                    {/* 1. Auth state (user, login, logout) */}
      <ContactsProvider>              {/* 2. Contacts/channels state */}
        <ToastProvider>               {/* 3. Notifications/toasts */}
          <Router>                    {/* 4. Routing system */}
            <NotesProvider>           {/* 5. Notes-specific state */}
              <BlogsProvider>         {/* 6. Blogs-specific state */}
                <Routes>
                  {/* Protected routes */}
                  <Route path="/app" element={
                    <RequireAuth>     {/* 7. Authentication check */}
                      <MainLayout>    {/* 8. App layout structure */}
                        <Home />      {/* 9. Page content */}
                      </MainLayout>
                    </RequireAuth>
                  } />
                </Routes>
              </BlogsProvider>
            </NotesProvider>
          </Router>
        </ToastProvider>
      </ContactsProvider>
    </AuthProvider>
  );
}
```

**Key Concepts:**

1. **Context Providers**: Wrap the app to make state available everywhere
2. **Nested Structure**: Providers wrap each other (composition pattern)
3. **RequireAuth**: HOC (Higher-Order Component) that protects routes
4. **MainLayout**: Consistent layout structure across pages

### 3.2 Context Pattern (Global State Management)

Your app uses the **React Context API** for state management. Let's understand it:

```javascript
// client/src/contexts/AuthContext.jsx

// 1. CREATE CONTEXT (storage container)
export const AuthContext = createContext(null);

// 2. CREATE PROVIDER (state manager + logic)
export const AuthProvider = ({ children }) => {
  // State
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(() => {
    return localStorage.getItem("accessToken") || null;
  });

  // Functions
  const login = async ({ email, password }) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",  // IMPORTANT: sends cookies
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    
    if (!res.ok) throw new Error(data.message);

    // Save tokens
    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem("accessToken", data.accessToken);

    return data;
  };

  // Make available to all children
  return (
    <AuthContext.Provider value={{
      user,
      loading,
      accessToken,
      login,
      logout,
      // ... other methods
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// 3. CREATE HOOK (easy access)
export const useAuth = () => useContext(AuthContext);
```

**How to use in any component:**

```javascript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, login, logout } = useAuth();
  
  return (
    <div>
      {user ? (
        <p>Welcome, {user.username}!</p>
      ) : (
        <p>Please login</p>
      )}
    </div>
  );
}
```

---

## 4. Deep Dive: Authentication System

### 4.1 The Two-Token Strategy

Your app uses **JWT tokens** with a dual-token approach:

1. **Access Token** (short-lived: 15 minutes)
   - Stored in: `localStorage`
   - Used for: API requests
   - Sent via: `Authorization: Bearer <token>` header

2. **Refresh Token** (long-lived: 7 days)
   - Stored in: HTTP-only cookie (secure)
   - Used for: Getting new access tokens
   - Sent via: Browser automatically includes cookies

**Why this dual approach?**
- Access tokens are short-lived for security
- If stolen, they expire quickly
- Refresh tokens are HTTP-only (JavaScript can't access them) = safer
- When access token expires, use refresh token to get a new one

### 4.2 Authentication Flow

#### **Signup Flow**

```
User fills signup form
    ↓
Frontend: POST /api/auth/signup
    ↓
Backend: authController.signup()
    ├─ Hash password with bcrypt
    ├─ Check if email exists
    ├─ AUTO-ASSIGN to company (if email domain matches)
    ├─ Create user in MongoDB
    ├─ Generate verification token
    └─ Send verification email
    ↓
Return success (user needs to verify email)
```

**Code breakdown:**

```javascript
// server/controllers/authController.js

async signup(req, res) {
  const { username, email, password } = req.body;

  // 1. Hash password (NEVER store plain passwords!)
  const passwordHash = await bcrypt.hash(password, 12);

  // 2. Check if user exists
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: "Email taken" });

  // 3. Domain extraction for auto-assignment
  const domain = email.split('@')[1];

  // 4. Find matching company
  let company = await Company.findOne({
    domainVerified: true,
    domains: domain
  });

  // 5. Create user
  const user = await User.create({
    username,
    email,
    passwordHash,
    companyId: company?._id || null,
    userType: company ? "company" : "personal",
    // ... more fields
  });

  // 6. Generate verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  user.verificationTokenHash = sha256(verificationToken);
  user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24hrs
  await user.save();

  // 7. Send email
  const verifyURL = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
  await sendEmail({
    to: email,
    subject: "Verify Your Email",
    html: `<a href="${verifyURL}">Click to verify</a>`
  });

  res.status(201).json({ message: "Signup successful! Check email." });
}
```

#### **Login Flow**

```
User enters credentials
    ↓
Frontend: POST /api/auth/login
    ↓
Backend: authController.login()
    ├─ Find user by email
    ├─ Compare password with bcrypt
    ├─ Generate Access Token (JWT, 15min)
    ├─ Generate Refresh Token (JWT, 7 days)
    ├─ Save refresh token hash to DB
    ├─ Set refresh token as HTTP-only cookie
    └─ Return access token + user data
    ↓
Frontend: 
    ├─ Save access token to localStorage
    ├─ Save user to state
    └─ Redirect to /app
```

**Code breakdown:**

```javascript
// server/controllers/authController.js

async login(req, res) {
  const { email, password } = req.body;

  // 1. Find user
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  // 2. Verify password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  // 3. Generate tokens
  const accessToken = jwt.sign(
    { sub: user._id, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { sub: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  // 4. Save refresh token hash to DB (for validation later)
  const refreshTokenHash = sha256(refreshToken);
  user.refreshTokens.push({
    tokenHash: refreshTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  await user.save();

  // 5. Set HTTP-only cookie (secure, can't be accessed by JS)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  // 6. Return access token and user
  res.json({
    accessToken,
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      // ... more user fields
    }
  });
}
```

### 4.3 Protected Route Pattern

```javascript
// client/src/components/RequireAuth.jsx

export default function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);

  // Still loading user data?
  if (loading) return <LoadingScreen />;

  // No user? Redirect to login
  if (!user) return <Navigate to="/login" replace />;

  // User exists, show protected content
  return children;
}
```

**How it works:**
1. Checks if user is authenticated
2. If loading, show loading screen
3. If not authenticated, redirect to `/login`
4. If authenticated, render the protected component

---

## 5. Deep Dive: Real-Time Messaging

### 5.1 Socket.io Architecture

Socket.io enables **bidirectional, real-time communication** between client and server.

```
CLIENT                          SERVER
  │                               │
  │──── connect (with JWT) ──────▶│
  │                               │ (authenticate)
  │◀─── connection success ───────│
  │                               │
  │──── join-channel ────────────▶│ (join room)
  │                               │
  │──── send-message ────────────▶│ (save to DB)
  │                               │
  │◀─── message-sent ─────────────│ (ack to sender)
  │                               │
  │◀─── new-message ──────────────│ (broadcast to room)
  │                               │
```

### 5.2 Socket Events Explained

#### **Server-Side: Socket Handler**

```javascript
// server/socket/index.js

module.exports = function registerChatHandlers(io, socket) {
  const userId = socket.user.id; // from JWT authentication

  // 1. JOIN CHANNEL ROOM
  socket.on("join-channel", ({ channelId }) => {
    const room = `channel_${channelId}`;
    socket.join(room);  // Subscribe to this room
    console.log(`User ${userId} joined: ${room}`);
  });

  // 2. SEND MESSAGE
  socket.on("send-message", async (data) => {
    const { channelId, text, attachments, clientTempId } = data;

    // Save to database
    const message = await Message.create({
      senderId: userId,
      channelId,
      text,
      attachments
    });

    // Populate sender info
    const populated = await Message.findById(message._id)
      .populate("senderId", "username profilePicture");

    // BROADCAST to everyone in the channel room
    io.to(`channel_${channelId}`).emit("new-message", {
      message: populated,
      clientTempId  // so client can replace optimistic message
    });

    // ACK to sender (confirmation)
    socket.emit("message-sent", {
      message: populated,
      clientTempId
    });
  });

  // 3. TYPING INDICATOR
  socket.on("typing", ({ channelId }) => {
    io.to(`channel_${channelId}`).emit("typing", { 
      from: userId 
    });
  });

  // 4. DISCONNECT
  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
  });
};
```

**Key Concepts:**

- **Rooms**: Logical channels for grouping sockets (e.g., `channel_123`)
- **socket.join(room)**: Subscribe to a room
- **io.to(room).emit()**: Broadcast to all sockets in that room
- **socket.emit()**: Send to only this socket (acknowledge)

#### **Client-Side: Using Socket.io**

```javascript
// client/src/components/messages/chat/ChatWindow/useSocketConnection.js

import { io } from 'socket.io-client';

export function useSocketConnection(accessToken) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!accessToken) return;

    // 1. Connect to server with JWT
    const newSocket = io(BACKEND_URL, {
      auth: { token: accessToken }  // Sent to server for authentication
    });

    // 2. Listen for connection
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    // 3. Listen for new messages
    newSocket.on('new-message', ({ message, clientTempId }) => {
      // Update UI with new message
      setMessages(prev => [...prev, message]);
    });

    // 4. Listen for typing indicators
    newSocket.on('typing', ({ from }) => {
      showTypingIndicator(from);
    });

    setSocket(newSocket);

    // 5. Cleanup on unmount
    return () => newSocket.close();
  }, [accessToken]);

  return socket;
}
```

### 5.3 Message Schema Design

```javascript
// server/models/Message.js

const MessageSchema = new mongoose.Schema({
  company: { type: ObjectId, ref: "Company", required: true },
  workspace: { type: ObjectId, ref: "Workspace" },
  channel: { type: ObjectId, ref: "Channel" },      // For channel messages
  dm: { type: ObjectId, ref: "DMSession" },         // For direct messages
  sender: { type: ObjectId, ref: "User", required: true },
  text: { type: String, default: "" },
  attachments: [{
    type: { type: String, enum: ["image", "video", "file"] },
    url: String,
    name: String,
    size: Number
  }],
  threadParent: { type: ObjectId, ref: "Message" }, // For threaded replies
  reactions: [{
    emoji: String,
    userId: { type: ObjectId, ref: "User" }
  }],
  readBy: [{ type: ObjectId, ref: "User" }]         // Read receipts
}, { timestamps: true });

// Indexes for fast queries
MessageSchema.index({ company: 1, channel: 1, createdAt: -1 });
MessageSchema.index({ company: 1, dm: 1, createdAt: -1 });
```

**Design Decisions:**

1. **Flexible Message Type**: Can be channel or DM (one schema for both)
2. **Attachments Array**: Support multiple files per message
3. **Thread Support**: `threadParent` enables reply threads
4. **Reactions**: Array of emoji reactions with user tracking
5. **Read Receipts**: `readBy` array tracks who read the message
6. **Indexes**: Optimize common queries (channel messages, DM messages)

---

## 6. Database Design & Models

### 6.1 User Model (Most Complex)

```javascript
// server/models/User.js

const UserSchema = new mongoose.Schema({
  // IDENTITY
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },

  // TYPE & COMPANY
  userType: { 
    type: String, 
    enum: ["personal", "company"], 
    default: "personal" 
  },
  companyId: { type: ObjectId, ref: "Company", default: null },
  companyRole: { 
    type: String, 
    enum: ["owner", "admin", "manager", "member", "guest"],
    default: "member"
  },

  // WORKSPACES
  workspaces: [{
    workspace: { type: ObjectId, ref: "Workspace" },
    role: { type: String, enum: ["owner", "admin", "member"] },
    joinedAt: { type: Date, default: Date.now }
  }],

  // AUTHENTICATION
  verified: { type: Boolean, default: false },
  verificationTokenHash: String,
  refreshTokens: [{
    tokenHash: String,
    expiresAt: Date,
    createdAt: Date,
    deviceInfo: String
  }],

  // GOOGLE OAUTH
  googleId: { type: String, unique: true, sparse: true },
  googleAccount: { type: Boolean, default: false },

  // ACTIVITY
  lastLoginAt: Date,
  isOnline: { type: Boolean, default: false },

  // PROFILE
  profile: {
    name: String,
    dob: Date,
    about: String,
    company: String
  },
  profilePicture: String
}, { timestamps: true });
```

**Key Design Patterns:**

1. **Embedded Documents**: `workspaces` array with role info
2. **References**: `companyId` links to Company model
3. **Enums**: Restricted values (userType, companyRole)
4. **Sparse Indexes**: `googleId` unique but optional
5. **Timestamps**: Auto `createdAt` and `updatedAt`

### 6.2 Relationship Patterns

#### **One-to-Many: User → Messages**
```javascript
// One user can have many messages
{
  _id: userId,
  username: "john"
}

// Messages reference the user
{
  _id: messageId,
  sender: userId,  // Reference to User
  text: "Hello!"
}
```

#### **Many-to-Many: Users ↔ Channels**
```javascript
// Channel has array of members
{
  _id: channelId,
  name: "general",
  members: [userId1, userId2, userId3]  // Array of User IDs
}

// Query: Get all channels for a user
Channel.find({ members: userId })
```

#### **Embedded Documents: User.workspaces**
```javascript
{
  _id: userId,
  username: "john",
  workspaces: [
    {
      workspace: workspaceId1,
      role: "admin",
      joinedAt: "2024-01-01"
    },
    {
      workspace: workspaceId2,
      role: "member",
      joinedAt: "2024-02-01"
    }
  ]
}
```

---

## 7. Key Patterns & Best Practices

### 7.1 Async/Await Error Handling

**Bad:**
```javascript
function getData() {
  fetch('/api/data')
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(err => console.error(err));
}
```

**Good (Your pattern):**
```javascript
async function getData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('Failed to fetch');
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Error:', err);
    throw err;  // Re-throw for caller to handle
  }
}
```

### 7.2 Component Composition

**Instead of large components, you break them down:**

```javascript
// ❌ BAD: One massive component
function ChatWindow() {
  return (
    <div>
      {/* 500 lines of code */}
    </div>
  );
}

// ✅ GOOD: Composed of smaller components
function ChatWindow() {
  return (
    <div>
      <ChatHeader />
      <MessagesContainer>
        {messages.map(msg => <MessageItem key={msg.id} message={msg} />)}
      </MessagesContainer>
      <ChatFooter />
    </div>
  );
}
```

### 7.3 Custom Hooks for Logic Reuse

```javascript
// client/src/components/layout/hooks/useResizablePanel.js

export function useResizablePanel(minWidth, maxWidth) {
  const [width, setWidth] = useState(300);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e) => {
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newWidth = Math.min(Math.max(e.clientX, minWidth), maxWidth);
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return { width, handleMouseDown, isDragging };
}
```

**Usage:**
```javascript
function SidePanel() {
  const { width, handleMouseDown } = useResizablePanel(250, 500);

  return (
    <div style={{ width }}>
      <div onMouseDown={handleMouseDown} className="resize-handle" />
      {/* Panel content */}
    </div>
  );
}
```

### 7.4 Environment Variables

**Frontend (.env):**
```env
REACT_APP_BACKEND_URL=http://localhost:5000
REACT_APP_GOOGLE_CLIENT_ID=your_client_id
```

**Backend (.env):**
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/chttrix
ACCESS_TOKEN_SECRET=your_secret_key
REFRESH_TOKEN_SECRET=another_secret
FRONTEND_URL=http://localhost:3000
```

**Access in code:**
```javascript
// Frontend
const BACKEND = process.env.REACT_APP_BACKEND_URL;

// Backend
const PORT = process.env.PORT || 5000;
```

---

## 8. Component Architecture

### 8.1 Folder Structure Philosophy

```
src/components/
├── layout/          # Structural components (MainLayout, Sidebars)
├── home/            # Home-specific components
├── messages/        # Messaging components
├── modals/          # Reusable modals
└── ui/              # Generic UI components (Button, Toast, etc.)
```

**Principles:**
- **Feature-based**: Group by feature, not type
- **Reusability**: UI components are generic
- **Co-location**: Related code stays together

### 8.2 Smart vs. Presentational Components

**Smart (Container) Components:**
- Handle logic and state
- Connect to context/API
- Pass data to presentational components

**Presentational Components:**
- Focus on UI
- Receive data via props
- No API calls or complex logic

**Example:**

```javascript
// Smart: MessagesPanel (connects to context, manages state)
function MessagesPanel() {
  const { directMessages, loadMessages } = useContacts();
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadMessages();
  }, []);

  const filtered = directMessages.filter(dm => 
    dm.username.toLowerCase().includes(search.toLowerCase())
  );

  return <MessageList messages={filtered} onSearch={setSearch} />;
}

// Presentational: MessageList (just displays data)
function MessageList({ messages, onSearch }) {
  return (
    <div>
      <input onChange={(e) => onSearch(e.target.value)} />
      {messages.map(msg => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </div>
  );
}
```

---

## 9. State Management

### 9.1 Different Types of State

#### **1. Local State (Component-level)**
```javascript
function Counter() {
  const [count, setCount] = useState(0);  // Only this component knows about it
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

#### **2. Global State (Context)**
```javascript
// Available to entire app
const { user, login, logout } = useAuth();
```

#### **3. Server State (From API)**
```javascript
const [messages, setMessages] = useState([]);

useEffect(() => {
  fetch('/api/messages')
    .then(res => res.json())
    .then(data => setMessages(data));
}, []);
```

#### **4. URL State (React Router)**
```javascript
const { id } = useParams();  // From /channel/:id
const navigate = useNavigate();
```

### 9.2 When to Use Each

| State Type | Use When | Example |
|------------|----------|---------|
| Local | Component-specific | Toggle open/close, form input |
| Context | Shared across many components | User auth, theme, language |
| Server | Data from backend | Messages, users, channels |
| URL | Shareable state | Current channel, search params |

---

## 10. Security Implementation

### 10.1 Password Security

```javascript
// NEVER store plain passwords!

// ✅ CORRECT: Hash before saving
const bcrypt = require('bcryptjs');
const passwordHash = await bcrypt.hash(password, 12);  // 12 rounds
await User.create({ email, passwordHash });

// ✅ CORRECT: Compare hashed passwords
const isMatch = await bcrypt.compare(plainPassword, user.passwordHash);
```

### 10.2 JWT Token Security

```javascript
// ACCESS TOKEN (short-lived)
const accessToken = jwt.sign(
  { sub: userId, email: user.email },
  process.env.ACCESS_TOKEN_SECRET,
  { expiresIn: '15m' }  // Expires quickly
);

// REFRESH TOKEN (long-lived, but stored securely)
const refreshToken = jwt.sign(
  { sub: userId },
  process.env.REFRESH_TOKEN_SECRET,
  { expiresIn: '7d' }
);

// Store refresh token in HTTP-only cookie (can't be accessed by JavaScript)
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,      // Can't access via document.cookie
  secure: true,        // HTTPS only (in production)
  sameSite: 'strict'   // CSRF protection
});
```

### 10.3 Rate Limiting

```javascript
// server/server.js

const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,              // 100 requests per minute
  message: "Too many requests, please try again later."
});

app.use('/api/auth', limiter);  // Apply to auth routes
```

### 10.4 CORS Configuration

```javascript
// server/server.js

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,  // Allow cookies
}));
```

### 10.5 Input Validation

```javascript
// ❌ BAD: Trust user input
const { email } = req.body;
const user = await User.findOne({ email });

// ✅ GOOD: Validate and sanitize
const { email } = req.body;

if (!email || !email.includes('@')) {
  return res.status(400).json({ message: 'Invalid email' });
}

const sanitizedEmail = email.toLowerCase().trim();
const user = await User.findOne({ email: sanitizedEmail });
```

---

## 🎓 Learning Exercises

### Exercise 1: Trace a Login Request
1. Open `client/src/pages/LoginPageComp/LoginPage.jsx`
2. Find the login form submit handler
3. Trace the request to `authController.js`
4. Follow the token generation
5. See how the token gets back to the client

### Exercise 2: Add a New Feature
Try adding a "like" feature to messages:
1. Update Message model (add `likes` array)
2. Create socket event `like-message`
3. Add backend handler in `socket/index.js`
4. Add UI button in message component
5. Emit socket event on click

### Exercise 3: Debug with Console Logs
Add strategic `console.log` statements:
```javascript
console.log('📥 Received data:', data);
console.log('✅ Success:', result);
console.log('❌ Error:', error);
```

---

## 🚀 Next Steps

1. **Read the code**: Start with small components, work your way up
2. **Modify and test**: Change something, see what breaks, fix it
3. **Add features**: Build new features using existing patterns
4. **Read documentation**: 
   - [React Docs](https://react.dev)
   - [Express Docs](https://expressjs.com)
   - [Socket.io Docs](https://socket.io/docs/v4/)
   - [Mongoose Docs](https://mongoosejs.com/docs/)

---

## 📚 Glossary

| Term | Definition |
|------|------------|
| **API** | Application Programming Interface - how frontend talks to backend |
| **REST** | Representational State Transfer - architectural style for APIs |
| **WebSocket** | Persistent connection for real-time bidirectional communication |
| **JWT** | JSON Web Token - compact way to securely transmit information |
| **OAuth** | Open Authorization - third-party authentication (Google, etc.) |
| **CORS** | Cross-Origin Resource Sharing - security feature for API access |
| **Middleware** | Function that runs before route handlers |
| **Hook** | React feature for using state and lifecycle in functional components |
| **Context** | React feature for sharing state across components |
| **ODM** | Object Document Mapping - Mongoose maps JS objects to MongoDB |

---

**Happy Coding! 🎉**

Feel free to ask questions about any part of this codebase. The best way to learn is to read code, modify it, break it, and fix it!
