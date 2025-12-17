# 🌊 ChttrixCollab - Complete Application Flow Guide

> **A comprehensive step-by-step journey through your entire application, from the first HTML file to database operations**

---

## 📑 Table of Contents

1. [Application Startup Flow](#1-application-startup-flow)
2. [Frontend Architecture Flow](#2-frontend-architecture-flow)
3. [User Login Journey](#3-user-login-journey-complete-flow)
4. [Real-Time Messaging Flow](#4-real-time-messaging-flow)
5. [Backend Request Processing](#5-backend-request-processing)
6. [Database Operations](#6-database-operations)
7. [Complete Feature Flows](#7-complete-feature-flows)

---

## 1. Application Startup Flow

### **Step 1: Browser Loads index.html**

**File:** `client/public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="icon" href="%PUBLIC_URL%/assets/ChttrixFavico.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chttrix</title>
</head>
<body>
  <div id="root"></div>
  <!-- React will inject the entire app here -->
</body>
</html>
```

**What happens:**
1. Browser downloads HTML file
2. Finds `<div id="root"></div>` - empty container
3. Looks for JavaScript bundles (created by React build process)
4. Executes JavaScript to render React app

**Key Points:**
- `%PUBLIC_URL%` is replaced with actual URL during build
- `id="root"` is the **mounting point** for React
- This is a **Single Page Application (SPA)** - only one HTML file
- All routing happens in JavaScript

---

### **Step 2: React Initializes (index.js)**

**File:** `client/src/index.js`

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';                    // 1. Load global styles
import App from './App';                 // 2. Import root component
import { AuthProvider } from './contexts/AuthContext';
import { GoogleOAuthProvider } from "@react-oauth/google";

// 3. Create React root
const root = ReactDOM.createRoot(document.getElementById('root'));

// 4. Render app
root.render(
  <React.StrictMode>                     {/* Development helper */}
    <GoogleOAuthProvider clientId="..."> {/* Google OAuth wrapper */}
      <AuthProvider>                     {/* Global auth state */}
        <App />                          {/* Your app! */}
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
```

**Execution Flow:**

```
1. ReactDOM.createRoot(element)
   ↓
   Finds <div id="root"></div>
   ↓
2. root.render(<App />)
   ↓
   Creates virtual DOM tree
   ↓
3. React.StrictMode wraps everything
   ↓
   Runs extra checks in development
   ↓
4. GoogleOAuthProvider initializes
   ↓
   Sets up Google Sign-In context
   ↓
5. AuthProvider initializes
   ↓
   Loads user from localStorage/server
   ↓
6. App component renders
   ↓
   Shows UI to user
```

**Key Concepts:**

**React.StrictMode:**
- Development-only wrapper
- Highlights potential problems
- Runs effects twice to catch bugs
- Removed in production build

**Provider Pattern (Wrapping):**
```javascript
<Provider1>          // Outermost = available to all inner components
  <Provider2>        // Can use Provider1's data
    <Provider3>      // Can use Provider1 & Provider2's data
      <App />        // Can use all providers' data
    </Provider3>
  </Provider2>
</Provider1>
```

---

### **Step 3: Global Styles Load (index.css)**

**File:** `client/src/index.css`

```css
@tailwind base;        /* Tailwind's reset styles */
@tailwind components;  /* Tailwind's component classes */
@tailwind utilities;   /* Tailwind's utility classes */

html, body, #root {
    height: 100%;      /* Full viewport height */
    width: 100%;       /* Full viewport width */
    overflow: hidden;  /* Prevent scrolling on root */
    margin: 0;
    padding: 0;
}
```

**What happens:**
1. Tailwind directives are processed at build time
2. CSS is injected into the page
3. All HTML elements get base styles
4. Your app fills the entire screen (100% height/width)

---

### **Step 4: AuthProvider Initializes**

**File:** `client/src/contexts/AuthContext.jsx`

```javascript
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(() => {
    // IMMEDIATELY load token from localStorage
    return localStorage.getItem("accessToken") || null;
  });

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const storedToken = localStorage.getItem("accessToken");
      
      if (storedToken) {
        setAccessToken(storedToken);
      }

      // Fetch user data from server
      const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: "include",  // Send cookies
        headers: storedToken 
          ? { Authorization: `Bearer ${storedToken}` }
          : {}
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);  // User is logged in!
      } else {
        // Invalid token, clear everything
        setUser(null);
        localStorage.removeItem("accessToken");
      }
    } finally {
      setLoading(false);  // Stop showing loading screen
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, accessToken, login, logout }}>
      {children}  {/* Render App component */}
    </AuthContext.Provider>
  );
};
```

**Flow:**

```
AuthProvider Mounts
    ↓
Initialize state:
  - user = null
  - loading = true
  - accessToken = from localStorage (or null)
    ↓
useEffect runs (componentDidMount)
    ↓
loadUser() called
    ↓
GET /api/auth/me (with token if exists)
    ↓
┌─── Token Valid? ───┐
│                    │
YES                 NO
│                    │
Set user data       Clear everything
Show main app       Show login page
```

**Key Points:**
- **Lazy initialization:** `useState(() => localStorage.getItem(...))` runs once
- **Automatic login:** If valid token exists, user is logged in automatically
- **Loading state:** Prevents flash of login screen while checking auth

---

### **Step 5: App Component Renders**

**File:** `client/src/App.js`

```javascript
function App() {
  return (
    <AuthProvider>           {/* Already wrapped in index.js */}
      <ContactsProvider>     {/* Loads channels & DMs */}
        <ToastProvider>      {/* Notifications system */}
          <Router>           {/* URL routing */}
            <NotesProvider>  {/* Notes state */}
              <BlogsProvider> {/* Blogs state */}
                <Routes>     {/* Define all routes */}
                
                  {/* PUBLIC ROUTES */}
                  <Route path="/" element={<FeatureShowcase />} />
                  <Route path="/login" element={<LoginPage />} />
                  
                  {/* PROTECTED ROUTES */}
                  <Route path="/app" element={
                    <RequireAuth>        {/* Check if logged in */}
                      <MainLayout sidePanel={<HomePanel />}>
                        <Home />
                      </MainLayout>
                    </RequireAuth>
                  } />
                  
                  {/* ... more routes */}
                  
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

**Provider Hierarchy:**

```
AuthProvider (user, login, logout)
  └─ ContactsProvider (channels, DMs, contacts)
      └─ ToastProvider (showToast, hideToast)
          └─ Router (navigation)
              └─ NotesProvider (notes)
                  └─ BlogsProvider (blogs)
                      └─ Routes (page rendering)
```

**Any component can access all providers:**

```javascript
function MyComponent() {
  const { user } = useAuth();           // From AuthProvider
  const { channels } = useContacts();   // From ContactsProvider
  const { showToast } = useToast();     // From ToastProvider
  
  // All available!
}
```

---

## 2. Frontend Architecture Flow

### **Routing System**

**React Router Flow:**

```
User types URL: /app
    ↓
React Router matches route
    ↓
<Route path="/app" element={...} />
    ↓
Checks RequireAuth wrapper
    ↓
┌─── User Logged In? ───┐
│                       │
YES                    NO
│                       │
Render MainLayout     Redirect to /login
    ↓
Render Home component
```

**RequireAuth Component:**

```javascript
// client/src/components/RequireAuth.jsx

export default function RequireAuth({ children }) {
  const { user, loading } = useContext(AuthContext);

  // Still fetching user? Show loading spinner
  if (loading) return <LoadingScreen />;

  // No user? Redirect to login
  if (!user) return <Navigate to="/login" replace />;

  // User exists! Show protected content
  return children;
}
```

**Visual Flow:**

```
┌──────────────────────────────────────────────────┐
│            User visits /app                      │
└──────────────────┬───────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │  RequireAuth      │
         │  checks user      │
         └────┬─────────┬────┘
              │         │
         loading?      user?
              │         │
        ┌─────▼──┐  ┌──▼──────┐
        │Loading │  │ Login   │
        │Screen  │  │ Page    │
        └────────┘  └─────────┘
                       │
                   user exists
                       │
                 ┌─────▼──────┐
                 │ MainLayout │
                 │   + Home   │
                 └────────────┘
```

---

### **MainLayout Structure**

**File:** `client/src/components/layout/MainLayout.jsx`

```javascript
function MainLayout({ sidePanel, children }) {
  return (
    <div className="flex h-screen">
      
      {/* Left: Icon Sidebar (Nav) */}
      <IconSidebar />
      
      {/* Middle: Context Panel (Channels, DMs, etc.) */}
      <div className="w-64">
        {sidePanel}  {/* HomePanel, MessagesPanel, etc. */}
      </div>
      
      {/* Right: Main Content Area */}
      <div className="flex-1">
        {children}   {/* Home, Messages, Tasks, etc. */}
      </div>
      
    </div>
  );
}
```

**Visual Layout:**

```
┌────────────────────────────────────────────────────────┐
│ ┌──────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│ │      │ │              │ │                         │ │
│ │ Icon │ │  SidePanel   │ │    Main Content         │ │
│ │ Side │ │              │ │                         │ │
│ │ bar  │ │  • Channels  │ │   Chat Window           │ │
│ │      │ │  • DMs       │ │   or                    │ │
│ │ 🏠   │ │  • Search    │ │   Task List             │ │
│ │ 💬   │ │              │ │   or                    │ │
│ │ ✓    │ │              │ │   Notes Editor          │ │
│ │ 📝   │ │              │ │                         │ │
│ │ 📢   │ │              │ │                         │ │
│ │      │ │              │ │                         │ │
│ └──────┘ └──────────────┘ └─────────────────────────┘ │
└────────────────────────────────────────────────────────┘
  60px       256px                  flex-1
```

---

## 3. User Login Journey (Complete Flow)

Let's trace what happens when a user logs in:

### **Step 1: User Opens Login Page**

**URL:** `http://localhost:3000/login`

**File:** `client/src/pages/LoginPageComp/LoginPage.jsx`

```javascript
function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();  // From AuthProvider
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();  // Prevent page reload
    
    try {
      // Call login from AuthContext
      const data = await login({ email, password });
      
      // Redirect based on user type
      if (data.redirectTo) {
        navigate(data.redirectTo);
      } else {
        navigate('/app');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="email" 
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input 
        type="password" 
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

---

### **Step 2: Frontend Login Function**

**File:** `client/src/contexts/AuthContext.jsx`

```javascript
const login = async ({ email, password }) => {
  // 1. Make API request to backend
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",  // IMPORTANT: Send/receive cookies
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  // 2. Check response
  if (!res.ok) {
    throw new Error(data.message || "Login failed");
  }

  // 3. Save access token to state and localStorage
  setAccessToken(data.accessToken);
  setUser(data.user);
  localStorage.setItem("accessToken", data.accessToken);

  // 4. Return data (for redirect info)
  return data;
};
```

**Request Details:**

```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json
Cookie: <existing cookies if any>

{
  "email": "user@example.com",
  "password": "password123"
}
```

---

### **Step 3: Backend Receives Request**

**Server Entry Point:** `server/server.js`

```javascript
// Express app is listening on port 5000

app.use("/api/auth", require("./routes/auth"));
```

**When request arrives:**

```
HTTP Request
    ↓
POST /api/auth/login
    ↓
Express Router matches
    ↓
routes/auth.js
```

---

### **Step 4: Route Handler**

**File:** `server/routes/auth.js`

```javascript
const express = require("express");
const router = express.Router();
const { login } = require("../controllers/authController");

// Define route
router.post("/login", login);  // Delegates to controller

module.exports = router;
```

**Flow:**

```
POST /api/auth/login
    ↓
router.post("/login", login)
    ↓
Calls authController.login()
```

---

### **Step 5: Controller Processes Login**

**File:** `server/controllers/authController.js`

```javascript
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. VALIDATION
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    // 2. FIND USER IN DATABASE
    const user = await User.findOne({ email })
      .populate("companyId", "name domain defaultWorkspace");

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    // 3. CHECK EMAIL VERIFICATION
    if (!user.verified) {
      return res.status(403).json({
        message: "Please verify your email first"
      });
    }

    // 4. VERIFY PASSWORD
    const match = await bcrypt.compare(password, user.passwordHash);
    
    if (!match) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    // 5. CHECK COMPANY STATUS (if company user)
    if (user.companyId) {
      const Company = require("../models/Company");
      const company = await Company.findById(user.companyId);

      if (!company || !company.isActive) {
        return res.status(403).json({
          message: "Company is inactive"
        });
      }
    }

    // 6. GENERATE TOKENS
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshHash = sha256(refreshToken);

    // 7. SAVE REFRESH TOKEN TO DATABASE
    user.refreshTokens.push({
      tokenHash: refreshHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: req.get("User-Agent") || "Unknown",
    });

    // 8. UPDATE USER STATUS
    user.lastLoginAt = new Date();
    user.isOnline = true;
    await user.save();

    // 9. SET HTTP-ONLY COOKIE (refresh token)
    res.cookie("jwt", refreshToken, {
      httpOnly: true,      // Can't access via JavaScript
      secure: false,       // true in production (HTTPS only)
      sameSite: "lax",     // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    });

    // 10. PREPARE RESPONSE
    const response = {
      message: "Login successful",
      accessToken,  // Short-lived token (15 mins)
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        verified: user.verified,
        userType: user.userType,
        companyRole: user.companyRole,
        profilePicture: user.profilePicture
      }
    };

    // 11. ADD COMPANY INFO (if applicable)
    if (user.companyId) {
      response.company = {
        id: user.companyId._id,
        name: user.companyId.name,
        domain: user.companyId.domain,
      };

      const isAdmin = user.companyRole === "owner" || 
                      user.companyRole === "admin";
      
      response.redirectTo = isAdmin 
        ? "/admin/dashboard" 
        : "/workspace";
    } else {
      response.redirectTo = "/personal/workspace";
    }

    // 12. SEND RESPONSE
    return res.json(response);

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
```

**Visual Flow:**

```
┌─────────────────────────────────────────────┐
│  1. Extract email & password from request   │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│  2. Query MongoDB: User.findOne({ email })  │
└────────────────┬────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  User exists?  │
         └───┬────────┬───┘
             │        │
            NO       YES
             │        │
        Return 400   Continue
                     │
            ┌────────▼─────────┐
            │ Verify password  │
            │ bcrypt.compare() │
            └────┬──────────┬──┘
                 │          │
               MATCH      FAIL
                 │          │
            Continue   Return 400
                 │
        ┌────────▼──────────┐
        │ Generate Tokens   │
        │ - Access (15 min) │
        │ - Refresh (7 days)│
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │ Save refresh hash │
        │ to user.refreshTokens
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │ Set cookie with   │
        │ refresh token     │
        └────────┬──────────┘
                 │
        ┌────────▼──────────┐
        │ Return response:  │
        │ - accessToken     │
        │ - user data       │
        │ - redirectTo      │
        └───────────────────┘
```

---

### **Step 6: Database Query**

**What happens in MongoDB:**

```javascript
User.findOne({ email: "user@example.com" })
  .populate("companyId", "name domain")
```

**MongoDB Query:**

```javascript
db.users.findOne({
  email: "user@example.com"
})
```

**Returns document:**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "username": "johndoe",
  "email": "user@example.com",
  "passwordHash": "$2a$12$...",
  "verified": true,
  "companyId": "507f1f77bcf86cd799439012",
  "companyRole": "member",
  "refreshTokens": [],
  "lastLoginAt": "2024-12-16T10:00:00Z",
  "isOnline": false
}
```

**Then populate:**

```javascript
.populate("companyId", "name domain")
```

**Replaces** `companyId` with actual company document:

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "username": "johndoe",
  "email": "user@example.com",
  "companyId": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Acme Corp",
    "domain": "acme.com"
  }
  // ... rest of fields
}
```

---

### **Step 7: Token Generation**

**Access Token (JWT):**

```javascript
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      sub: user._id,        // Subject (user ID)
      email: user.email     // Additional payload
    },
    process.env.ACCESS_TOKEN_SECRET,  // Secret key
    { expiresIn: '15m' }              // Expires in 15 minutes
  );
};
```

**Generated token looks like:**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE3MDMyNTYwMDAsImV4cCI6MTcwMzI1NjkwMH0.signature
```

**Decoded:**

```json
{
  "sub": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "iat": 1703256000,  // Issued at
  "exp": 1703256900   // Expires at (15 mins later)
}
```

**Refresh Token (similar but longer expiry):**

```javascript
const generateRefreshToken = (user) => {
  return jwt.sign(
    { sub: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }  // 7 days
  );
};
```

---

### **Step 8: Response Returns to Frontend**

**HTTP Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Set-Cookie: jwt=<refresh_token>; HttpOnly; SameSite=Lax; Max-Age=604800

{
  "message": "Login successful",
  "accessToken": "eyJhbGc...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "email": "user@example.com",
    "roles": ["user"],
    "verified": true,
    "userType": "company",
    "companyRole": "member"
  },
  "company": {
    "id": "507f1f77bcf86cd799439012",
    "name": "Acme Corp",
    "domain": "acme.com"
  },
  "redirectTo": "/workspace"
}
```

---

### **Step 9: Frontend Processes Response**

**Back in AuthContext:**

```javascript
const login = async ({ email, password }) => {
  const res = await fetch(...);
  const data = await res.json();  // Parse response

  if (!res.ok) throw new Error(data.message);

  // 1. Save access token
  setAccessToken(data.accessToken);
  localStorage.setItem("accessToken", data.accessToken);

  // 2. Save user data
  setUser(data.user);

  // 3. Return data (includes redirectTo)
  return data;
};
```

**Then in LoginPage:**

```javascript
const handleSubmit = async (e) => {
  try {
    const data = await login({ email, password });
    
    // Redirect user to appropriate page
    navigate(data.redirectTo);  // "/workspace"
  } catch (err) {
    setError(err.message);
  }
};
```

---

### **Step 10: User is Redirected**

```
navigate("/workspace")
    ↓
React Router changes URL
    ↓
<Route path="/workspace" element={<Workspace />} />
    ↓
Workspace component renders
    ↓
User sees their workspace!
```

---

## 4. Real-Time Messaging Flow

### **Step 1: User Opens a Chat**

**Component:** `ChatWindow.jsx`

**Socket Connection Setup:**

```javascript
useEffect(() => {
  const token = getAccessToken();  // From localStorage

  // 1. Create socket connection
  const socket = io(API_BASE, {
    auth: { token },           // Send JWT for authentication
    transports: ["websocket"], // Force WebSocket (no polling)
  });

  socketRef.current = socket;

  // 2. Listen for connection
  socket.on("connect", () => {
    console.log("Connected:", socket.id);
    setConnected(true);

    // 3. Join appropriate room
    if (chat.type === "dm") {
      socket.emit("join-dm", { otherUserId: chat.id });
    } else {
      socket.emit("join-channel", { channelId: chat.id });
    }
  });

  // 4. Listen for new messages
  socket.on("new-message", ({ message, clientTempId }) => {
    const uiMessage = mapBackendMsgToUI(message);
    setMessages(prev => [...prev, uiMessage]);
  });

  // 5. Cleanup on unmount
  return () => socket.disconnect();
}, [chat]);
```

---

### **Step 2: Backend Socket Authentication**

**File:** `server/server.js`

```javascript
// Socket.io middleware (runs before connection)
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No token"));
    }

    // Verify JWT token
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Attach user to socket
    socket.user = { id: decoded.sub };
    
    next();  // Allow connection
  } catch (err) {
    console.error("SOCKET AUTH ERROR:", err);
    next(new Error("Authentication failed"));
  }
});
```

**Flow:**

```
Client connects
    ↓
Socket.io middleware runs
    ↓
Extract token from handshake
    ↓
Verify token with jwt.verify()
    ↓
┌─── Valid? ───┐
│              │
YES            NO
│              │
Attach user   Reject
to socket     connection
│
Allow connection
    ↓
User connected!
```

---

### **Step 3: User Joins Room**

**Client emits:**

```javascript
socket.emit("join-channel", { channelId: "channel123" });
```

**Server handles:**

```javascript
// server/socket/index.js

socket.on("join-channel", ({ channelId }) => {
  const room = `channel_${channelId}`;
  socket.join(room);  // Subscribe to room
  console.log(`User ${socket.user.id} joined ${room}`);
});
```

**Visual:**

```
Socket.io Server
├─ Room: channel_general
│   ├─ socket-abc (user1)
│   ├─ socket-def (user2)
│   └─ socket-ghi (user3)
│
├─ Room: channel_random
│   ├─ socket-jkl (user4)
│   └─ socket-mno (user5)
│
└─ Room: dm_user1_user2
    ├─ socket-abc (user1)
    └─ socket-def (user2)
```

---

### **Step 4: User Sends Message**

**Client:**

```javascript
const sendMessage = () => {
  const clientTempId = generateTempId();

  // 1. Optimistic UI update
  const tempMsg = {
    id: clientTempId,
    sender: "you",
    text: "Hello!",
    temp: true,
    sending: true,
  };
  setMessages(prev => [...prev, tempMsg]);

  // 2. Emit to server
  socket.emit("send-message", {
    text: "Hello!",
    channelId: "channel123",
    clientTempId,
  });
};
```

---

### **Step 5: Server Processes Message**

**File:** `server/socket/index.js`

```javascript
socket.on("send-message", async (data) => {
  try {
    const { channelId, text, clientTempId } = data;

    // 1. Validate
    if (!channelId) {
      socket.emit("send-error", { 
        clientTempId, 
        message: "Channel required" 
      });
      return;
    }

    // 2. Create message in database
    const message = await Message.create({
      senderId: socket.user.id,
      channelId,
      text,
    });

    // 3. Populate sender info
    const populated = await Message.findById(message._id)
      .populate("senderId", "username profilePicture");

    // 4. Broadcast to EVERYONE in the room
    io.to(`channel_${channelId}`).emit("new-message", {
      message: populated,
      clientTempId,
    });

    // 5. Acknowledge to sender
    socket.emit("message-sent", {
      message: populated,
      clientTempId,
    });

  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err);
    socket.emit("send-error", { 
      clientTempId: data.clientTempId 
    });
  }
});
```

---

### **Step 6: Database Saves Message**

**MongoDB Operation:**

```javascript
await Message.create({
  senderId: "507f1f77bcf86cd799439011",
  channelId: "channel123",
  text: "Hello!",
});
```

**Document Created:**

```json
{
  "_id": "65ab123456789",
  "senderId": "507f1f77bcf86cd799439011",
  "channelId": "channel123",
  "text": "Hello!",
  "attachments": [],
  "reactions": [],
  "readBy": [],
  "createdAt": "2024-12-17T09:31:00.000Z",
  "updatedAt": "2024-12-17T09:31:00.000Z"
}
```

**Then populate:**

```javascript
.populate("senderId", "username profilePicture")
```

**Result:**

```json
{
  "_id": "65ab123456789",
  "senderId": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "johndoe",
    "profilePicture": "https://..."
  },
  "channelId": "channel123",
  "text": "Hello!",
  "createdAt": "2024-12-17T09:31:00.000Z"
}
```

---

### **Step 7: Server Broadcasts to Room**

```javascript
io.to(`channel_${channelId}`).emit("new-message", {
  message: populated,
  clientTempId,
});
```

**What happens:**

```
Server
  ↓
Find room "channel_channel123"
  ↓
Get all sockets in room:
  - socket-abc (user1) ✓
  - socket-def (user2) ✓
  - socket-ghi (user3) ✓
  ↓
Emit "new-message" to ALL of them
```

---

### **Step 8: All Clients Receive Message**

**Client listener:**

```javascript
socket.on("new-message", ({ message, clientTempId }) => {
  const uiMessage = mapBackendMsgToUI(message);

  // Replace optimistic message with real one
  if (clientTempId) {
    setMessages(prev => 
      prev.map(m => 
        m.id === clientTempId 
          ? { ...uiMessage, sending: false }
          : m
      )
    );
  } else {
    // New message from someone else
    setMessages(prev => [...prev, uiMessage]);
  }
});
```

---

### **Complete Message Flow Diagram:**

```
USER A (Sender)                    SERVER                     USER B (Receiver)
     │                               │                              │
     │  1. Types "Hello"             │                              │
     │                               │                              │
     │  2. Shows message             │                              │
     │     (optimistic UI)           │                              │
     │     temp-abc123               │                              │
     │                               │                              │
     │  3. emit("send-message")      │                              │
     ├──────────────────────────────►│                              │
     │                               │                              │
     │                               │  4. Save to MongoDB          │
     │                               │     → Message created        │
     │                               │     → _id: msg789            │
     │                               │                              │
     │                               │  5. Broadcast to room        │
     │                               ├─────────────────────────────►│
     │                               │  emit("new-message")         │
     │◄──────────────────────────────┤  { message, clientTempId }   │
     │                               │                              │
     │  6. Replace temp with real    │                              │  7. Show new message
     │     temp-abc123 → msg789      │                              │     msg789
     │                               │                              │
```

---

## 5. Backend Request Processing

### **Middleware Pipeline**

Every request goes through a pipeline:

```
HTTP Request
    ↓
1. express.json()          Parse JSON body
    ↓
2. cookieParser()          Parse cookies
    ↓
3. helmet()                Security headers
    ↓
4. cors()                  CORS headers
    ↓
5. rateLimit (on /auth)    Rate limiting
    ↓
6. Route Handler           Your code
    ↓
7. Response                Send back to client
```

**Example: Protected Route**

```javascript
router.get("/me", requireAuth, getMe);
```

**Flow:**

```
GET /api/auth/me
    ↓
1-5. Middleware pipeline
    ↓
6. requireAuth middleware
    ↓
    Extract token from header
    ↓
    Verify JWT
    ↓
    ┌─── Valid? ───┐
    │              │
   YES            NO
    │              │
    Attach user   Return 401
    to req.user   Unauthorized
    │
    Call next()
    ↓
7. getMe controller
    ↓
    Return user data
```

**requireAuth Middleware:**

```javascript
// server/middleware/auth.js

const requireAuth = (req, res, next) => {
  try {
    // 1. Extract token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token" });
    }

    const token = authHeader.split(" ")[1];  // "Bearer <token>"

    // 2. Verify token
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // 3. Attach user to request
    req.user = decoded;  // { sub: userId, email: ... }

    // 4. Continue to next middleware/controller
    next();

  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
```

---

## 6. Database Operations

### **Mongoose Schema → MongoDB Collection**

**Schema Definition:**

```javascript
// server/models/User.js

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Company" 
  },
  workspaces: [{
    workspace: { type: ObjectId, ref: "Workspace" },
    role: { type: String, enum: ["owner", "admin", "member"] },
    joinedAt: { type: Date, default: Date.now }
  }],
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
```

**MongoDB Collection:**

```
Database: chttrix
  └─ Collection: users
      ├─ Document 1
      ├─ Document 2
      └─ Document 3
```

**Example Document:**

```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "username": "johndoe",
  "email": "john@example.com",
  "passwordHash": "$2a$12$...",
  "companyId": ObjectId("507f1f77bcf86cd799439012"),
  "workspaces": [
    {
      "workspace": ObjectId("507f1f77bcf86cd799439013"),
      "role": "member",
      "joinedAt": ISODate("2024-01-01T00:00:00Z")
    }
  ],
  "createdAt": ISODate("2024-01-01T00:00:00Z"),
  "updatedAt": ISODate("2024-12-17T09:00:00Z")
}
```

---

### **Common Mongoose Operations**

#### **1. Create**

```javascript
const user = await User.create({
  username: "johndoe",
  email: "john@example.com",
  passwordHash: hashedPassword,
});
```

**MongoDB:**

```javascript
db.users.insertOne({
  username: "johndoe",
  email: "john@example.com",
  passwordHash: "...",
  createdAt: new Date(),
  updatedAt: new Date()
});
```

#### **2. Find One**

```javascript
const user = await User.findOne({ email: "john@example.com" });
```

**MongoDB:**

```javascript
db.users.findOne({ email: "john@example.com" });
```

#### **3. Find Many**

```javascript
const users = await User.find({ companyId: companyId });
```

**MongoDB:**

```javascript
db.users.find({ companyId: ObjectId("...") });
```

#### **4. Update**

```javascript
await User.findByIdAndUpdate(userId, {
  $set: { username: "newname" }
});
```

**MongoDB:**

```javascript
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { username: "newname" } }
);
```

#### **5. Delete**

```javascript
await User.findByIdAndDelete(userId);
```

**MongoDB:**

```javascript
db.users.deleteOne({ _id: ObjectId("...") });
```

#### **6. Populate (Join)**

```javascript
const user = await User.findById(userId)
  .populate("companyId", "name domain");
```

**What happens:**

```
1. Find user document
    ↓
2. Find companyId field: ObjectId("507f...")
    ↓
3. Query companies collection for that ID
    ↓
4. Replace ObjectId with actual document
```

---

## 7. Complete Feature Flows

### **Feature: Creating a Channel**

**End-to-End Flow:**

```
1. USER CLICKS "CREATE CHANNEL"
    ↓
2. FRONTEND: Modal opens
    ↓
3. USER fills form (name, description, privacy)
    ↓
4. FRONTEND: Submit button clicked
    ↓
5. POST /api/channels/create
    Headers: Authorization: Bearer <token>
    Body: { name, description, privacy }
    ↓
6. BACKEND: middleware/auth.js
    Extract & verify token
    ↓
7. BACKEND: controllers/channelController.js
    Extract companyId from req.user
    ↓
8. MONGODB: Create channel document
    ↓
9. MONGODB: Update user's workspaces array
    ↓
10. BACKEND: Return channel data
    ↓
11. FRONTEND: Add to local channels state
    ↓
12. UI: Show new channel in sidebar
    ↓
13. USER: Clicks on channel
    ↓
14. SOCKET.IO: emit("join-channel")
    ↓
15. USER can send messages!
```

---

## 🎯 Summary: Complete Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                               │
│                                                               │
│  index.html → index.js → App.js → Routes → Components        │
│       ↓          ↓         ↓         ↓          ↓            │
│    <div id=  ReactDOM   Context   Router   UI Logic          │
│     "root">   .render   Providers                            │
│                                                               │
│  State Management: useState, useContext, useEffect            │
│                                                               │
└────────────────┬──────────────────────────────┬──────────────┘
                 │                              │
            HTTP/HTTPS                      WebSocket
          (REST API)                       (Socket.io)
                 │                              │
┌────────────────▼──────────────────────────────▼──────────────┐
│                      EXPRESS SERVER                           │
│                                                               │
│  server.js → routes → middleware → controllers                │
│      ↓         ↓         ↓             ↓                      │
│   Listen    Define    Auth, CORS    Business Logic           │
│   Port 5000  Routes   Validation                             │
│                                                               │
│  Socket.io: Real-time event handling                         │
│                                                               │
└────────────────────────────┬─────────────────────────────────┘
                             │
                        Mongoose ODM
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                    MONGODB DATABASE                           │
│                                                               │
│  Collections: users, messages, channels, companies            │
│                                                               │
│  Operations: create, read, update, delete, populate          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 🎓 Key Takeaways

1. **Single Page Application**: Only one HTML file, JavaScript handles everything
2. **Component Hierarchy**: React tree from App → Routes → Pages → Components
3. **Context Providers**: Global state available to all components
4. **Protected Routes**: RequireAuth checks authentication before rendering
5. **REST API**: HTTP requests for CRUD operations
6. **WebSocket**: Real-time bidirectional communication
7. **JWT Tokens**: Stateless authentication (access + refresh)
8. **Middleware Pipeline**: Every request goes through validation layers
9. **Mongoose ODM**: JavaScript objects ↔ MongoDB documents
10. **Optimistic UI**: Show changes immediately, update when confirmed

---

**You now understand the complete flow from HTML to Database and back!** 🎉

Would you like me to:
1. Deep dive into any specific flow?
2. Explain a particular feature in detail?
3. Show you how to add a new feature step-by-step?
4. Create diagrams for any section?
