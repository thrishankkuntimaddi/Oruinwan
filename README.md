# ChttrixCollab

**AI-Augmented Team Collaboration Platform**

A modern, real-time collaboration platform designed for distributed teams. ChttrixCollab combines messaging, task management, document collaboration, and company administration into a unified workspace with AI assistance.

---

## 🎯 Product Overview

### What is ChttrixCollab?

ChttrixCollab is an all-in-one team collaboration solution that helps companies:
- Communicate in real-time across channels and direct messages
- Manage tasks, projects, and team workflows
- Share and collaborate on notes and documentation
- Post company-wide updates and announcements
- Administer teams with role-based access control
- Onboard employees through invitation and domain verification

### Problem It Solves

Modern teams are fragmented across multiple tools (Slack for chat, Asana for tasks, Notion for docs, etc.). ChttrixCollab unifies these workflows into a single platform, reducing context switching and improving productivity.

### Target Users

- **Companies**: 10-1000 employees
- **Remote/Hybrid Teams**: Distributed workforce
- **Roles**: HR, Developers, Testers, Designers, Managers, Executives

---

## ✨ Features

### Core Features

#### 1. **Real-Time Messaging**
- **Channels**: Public/private team channels organized by topics
- **Direct Messages**: 1-on-1 and group conversations
- **File Sharing**: Upload and share documents, images, code snippets
- **Notifications**: Desktop and in-app notifications
- **Search**: Global search across all conversations

**Tech Used**: Socket.io for WebSocket connections, MongoDB for message persistence

#### 2. **Task Management**
- **Task Board**: Kanban-style task organization
- **Assignments**: Assign tasks to team members
- **Due Dates**: Set deadlines and reminders
- **Status Tracking**: Todo, In Progress, Done
- **Comments**: Discuss tasks in context

**Tech Used**: React DnD for drag-and-drop, MongoDB for task storage

#### 3. **Notes & Documentation**
- **Rich Text Editor**: Markdown support with formatting
- **Collaboration**: Share notes with team members and control editing permissions
- **Organization**: Folders and tags
- **Activity Tracking**: Track note creation and sharing events
- **Sharing**: Share notes with specific teams or company-wide

**Tech Used**: Rich text editor with permission-based sharing and activity logging

#### 4. **Company Updates**
- **Announcements**: Company-wide broadcasts
- **Feed**: Chronological update stream
- **Reactions**: Like, comment on updates
- **Pinned Posts**: Important announcements stay visible

**Tech Used**: RESTful API with MongoDB, real-time updates via WebSockets

#### 5. **Workspace Management**
- **Multi-Workspace**: Switch between different projects/teams
- **Workspace Settings**: Configure per-workspace preferences
- **Members**: Add/remove team members per workspace
- **Channels**: Create workspace-specific channels

**Tech Used**: MongoDB subdocuments for workspace hierarchy

#### 6. **Admin Dashboard**
- **Company Management**: Create and configure company settings
- **Domain Verification**: Verify company email domain for auto-join
- **Member Invitations**: Send email invites with role assignment
- **Role Management**: Assign Owner, Admin, Member roles
- **Member List**: View, edit, and remove team members
- **Analytics**: (Planned) Usage statistics and insights

**Tech Used**: React admin UI, RESTful API with role-based middleware

---

## 🏗️ Architecture

### System Design

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client    │◄────►│    Server    │◄────►│  MongoDB    │
│  (React)    │      │  (Node.js)   │      │  (Database) │
└─────────────┘      └──────────────┘      └─────────────┘
      │                     │
      │ HTTP/WebSocket      │
      │                     │
      ▼                     ▼
  REST API          Socket.io Events
  - Auth            - Messages
  - CRUD ops        - Notifications
  - File upload     - Presence
```

### Frontend Architecture

```
src/
├── components/       # Reusable UI components
├── pages/           # Route pages
├── contexts/        # React Context (Auth, Notes, etc.)
├── services/        # API services (axios, socket)
└── utils/           # Helper functions
```

### Backend Architecture

```
server/
├── controllers/     # Request handlers
├── models/         # MongoDB schemas
├── routes/         # API routes
├── middleware/     # Auth, validation
└── socket/         # Socket.io handlers
```

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose | Why We Use It |
|------------|---------|---------------|
| **React 18** | UI Framework | Component-based architecture, virtual DOM for performance, large ecosystem |
| **React Router** | Routing | SPA navigation, nested routes, protected routes |
| **Socket.io Client** | Real-time | WebSocket abstraction, automatic reconnection, fallback to polling |
| **Axios** | HTTP Client | Promise-based, interceptors for auth, better error handling than fetch |
| **Lucide Icons** | Icons | Lightweight, consistent design, tree-shakeable |
| **Tailwind CSS** | Styling | Utility-first, fast development, consistent design system |

### Backend

| Technology | Purpose | Why We Use It |
|------------|---------|---------------|
| **Node.js** | Runtime | JavaScript everywhere, non-blocking I/O, large package ecosystem |
| **Express** | Web Framework | Minimalist, flexible, middleware support, industry standard |
| **MongoDB** | Database | Document model fits our data, flexible schema, horizontal scaling |
| **Mongoose** | ODM | Schema validation, middleware hooks, query building |
| **Socket.io** | WebSockets | Real-time bidirectional communication, room support, namespace isolation |
| **JWT** | Authentication | Stateless auth, secure token-based sessions, refresh token support |
| **bcrypt** | Password Hashing | Industry standard, salted hashing, protection against rainbow tables |

### DevOps & Tools

| Technology | Purpose |
|------------|---------|
| **Google OAuth** | Social login |
| **Nodemailer** | Email sending |
| **Multer** | File uploads |
| **Helmet** | Security headers |
| **CORS** | Cross-origin requests |

---

## 📋 Setup Instructions

### Prerequisites

- **Node.js**: v16 or higher ([Download](https://nodejs.org/))
- **MongoDB**: Local or Atlas ([Setup](https://www.mongodb.com/cloud/atlas))
- **npm** or **yarn**: Package manager

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/ChttrixCollab.git
cd ChttrixCollab

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Configuration

#### Server Environment (`server/.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/chttrix
# Or MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email (for invitations)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

#### Client Environment (`client/.env`)

```env
# Backend API URL
REACT_APP_BACKEND_URL=http://localhost:5000

# Google OAuth
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

### Database Seeding

Create test data (company, workspaces, users):

```bash
cd server
node seed.js
```

**Test Accounts Created:**

| Email | Password | Role | Access |
|-------|----------|------|--------|
| admin@chttrix.com | admin123 | Owner | Full access + Admin Dashboard |
| jane@chttrix.com | admin456 | Admin | Full access + Admin Dashboard |
| employee@chttrix.com | employee123 | Member | Standard workspace access |

### Running the Application

**Development Mode:**

```bash
# Terminal 1: Start server
cd server
npm start
# Server runs on http://localhost:5000

# Terminal 2: Start client
cd client
npm start
# Client runs on http://localhost:3000
```

**Production Mode:**

```bash
# Build client
cd client
npm run build

# Serve static files from server
cd ../server
npm run production
```

---

## 🚀 Usage Guide

### First-Time Setup

1. **Open Application**: Navigate to `http://localhost:3000`
2. **Login**: Use test account or create new account
3. **Choose Role**: 
   - **Admin** → Redirected to `/admin/company`
   - **Employee** → Redirected to `/app`

### For Admins

#### Access Admin Dashboard
- Click **profile picture** (bottom left)
- Select **"Admin Dashboard"**
- Or navigate to `/admin/company`

#### Verify Company Domain
1. Go to Admin Dashboard
2. Click **"Verify Domain"**
3. Add TXT record to your DNS
4. Click **"Check Status"**

#### Invite Team Members
1. Go to Admin Dashboard
2. Enter **email address**
3. Select **role** (Member, Admin, Owner)
4. Choose **workspace** (optional)
5. Click **"Send Invite"**

#### Manage Members
- **View**: See all company members
- **Edit Role**: Click edit icon, change role, save
- **Remove**: Click remove icon, confirm deletion

### For Employees

#### Join Channels
1. Navigate to **Channels**
2. Browse available channels
3. Click **"Join"**

#### Send Messages
1. Select channel or DM
2. Type message
3. Press **Enter** or click **Send**

#### Create Tasks
1. Navigate to **Tasks**
2. Click **"New Task"**
3. Fill details, assign, set due date
4. Click **"Create"**

#### Write Notes
1. Navigate to **Notes**
2. Click **"New Note"**
3. Use rich text editor
4. Click **"Save"**

---

## 🔐 Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: Access (15min) + Refresh (7 days)
- **Role-Based Access**: Owner, Admin, Member roles
- **Route Protection**: RequireAuth + RequireAdmin components
- **CORS**: Configured for allowed origins
- **Helmet**: Security headers enabled
- **Input Validation**: Server-side validation on all inputs

---

## 📊 Project Structure

```
ChttrixCollab/
├── client/                 # Frontend React app
│   ├── public/            # Static files
│   └── src/
│       ├── components/    # Reusable components
│       │   ├── layout/   # Layout components
│       │   └── ui/       # UI components
│       ├── contexts/     # React Context providers
│       ├── pages/        # Route pages
│       ├── services/     # API services
│       └── utils/        # Utilities
│
├── server/                # Backend Node.js app
│   ├── controllers/      # Business logic
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── socket/          # Socket.io handlers
│   └── utils/           # Utilities
│
└── README.md            # This file
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

MIT License - see LICENSE file for details

---

## 📧 Contact

- **Website**: [chttrix.com](https://chttrix.com)
- **Email**: support@chttrix.com
- **GitHub**: [github.com/yourusername/ChttrixCollab](https://github.com/yourusername/ChttrixCollab)

---

**Built with ❤️ by the Chttrix Team**