/**
 * mockIntegrations.js
 * Static mock data for the Visual Integration Ecosystem prototype.
 * NO real API calls. All state is managed locally in components.
 */

export const INTEGRATION_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "developer", label: "Developer Tools" },
  { id: "productivity", label: "Productivity" },
  { id: "communication", label: "Communication" },
  { id: "ai", label: "AI Tools" },
  { id: "automation", label: "Automation" },
];

export const MOCK_INTEGRATIONS = [
  // ── Developer Tools ─────────────────────────────────────────────────────────
  {
    id: "github",
    name: "GitHub",
    category: "developer",
    categoryLabel: "Developer Tools",
    emoji: "🐙",
    color: "from-gray-800 to-gray-900",
    accentColor: "#24292e",
    description: "Connect GitHub to get notifications about pull requests, issues, and commits directly in your channels.",
    useCases: [
      "Get notified when a PR is opened or merged",
      "Create and link issues from chat",
      "See commit activity in your channels",
    ],
    permissions: [
      "Read repository data",
      "Post messages to channels",
      "Create and update issues",
      "Receive webhook events",
    ],
    configOptions: {
      channel: "general",
      notifyOnPR: true,
      notifyOnIssue: true,
      notifyOnCommit: false,
    },
    connected: true,
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "developer",
    categoryLabel: "Developer Tools",
    emoji: "🦊",
    color: "from-orange-500 to-red-600",
    accentColor: "#FC6D26",
    description: "Bring GitLab merge requests, pipelines, and issue tracking into your Chttrix workspace.",
    useCases: [
      "Track CI/CD pipeline status",
      "Get alerts for failed pipelines",
      "Link merge requests to conversations",
    ],
    permissions: [
      "Read project data",
      "Post pipeline notifications",
      "Access merge request details",
    ],
    configOptions: {
      channel: "dev-alerts",
      notifyOnPipeline: true,
      notifyOnMR: true,
    },
    connected: false,
  },
  {
    id: "linear",
    name: "Linear",
    category: "developer",
    categoryLabel: "Developer Tools",
    emoji: "⚡",
    color: "from-violet-600 to-indigo-700",
    accentColor: "#5E6AD2",
    description: "Streamline your issue tracking by connecting Linear to create, update, and discuss issues without leaving chat.",
    useCases: [
      "Create issues from messages",
      "Get sprint update summaries",
      "Link issues to channel conversations",
    ],
    permissions: [
      "Read team issues and projects",
      "Create and update issues",
      "Post status updates to channels",
    ],
    configOptions: {
      channel: "engineering",
      notifyOnIssue: true,
      notifyOnCycle: false,
    },
    connected: false,
  },
  {
    id: "jira",
    name: "Jira",
    category: "developer",
    categoryLabel: "Developer Tools",
    emoji: "🎫",
    color: "from-blue-600 to-blue-800",
    accentColor: "#0052CC",
    description: "Track Jira tickets, sprints, and project progress directly in Chttrix channels.",
    useCases: [
      "Create Jira tickets from messages",
      "Get sprint progress updates",
      "Assign tickets to team members in chat",
    ],
    permissions: [
      "Read project and issue data",
      "Create and update issues",
      "Post notifications to channels",
      "Access sprint board data",
    ],
    configOptions: {
      channel: "product",
      notifyOnTransition: true,
      notifyOnComment: false,
    },
    connected: true,
  },

  // ── Productivity ─────────────────────────────────────────────────────────────
  {
    id: "google-drive",
    name: "Google Drive",
    category: "productivity",
    categoryLabel: "Productivity",
    emoji: "📁",
    color: "from-yellow-400 to-green-500",
    accentColor: "#34A853",
    description: "Share and preview Google Drive files directly in your channels without switching apps.",
    useCases: [
      "Share docs, sheets, and slides in chat",
      "Preview files without leaving Chttrix",
      "Get notified when files are shared with you",
    ],
    permissions: [
      "Read file metadata",
      "Share file links in channels",
      "Access your Drive file list",
    ],
    configOptions: {
      previewEnabled: true,
    },
    connected: false,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "productivity",
    categoryLabel: "Productivity",
    emoji: "📅",
    color: "from-blue-400 to-blue-600",
    accentColor: "#4285F4",
    description: "See your calendar events and schedule meetings from Chttrix. Get reminders before meetings start.",
    useCases: [
      "See today's schedule in your workspace",
      "Schedule meetings from chat",
      "Get pre-meeting reminders in your DMs",
    ],
    permissions: [
      "Read calendar events",
      "Create calendar events",
      "Send event invitations",
    ],
    configOptions: {
      reminderMinutes: 5,
      showDailyDigest: true,
    },
    connected: true,
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "productivity",
    categoryLabel: "Productivity",
    emoji: "📧",
    color: "from-red-400 to-red-600",
    accentColor: "#EA4335",
    description: "Get important email notifications and share email threads with your team in channels.",
    useCases: [
      "Get notified of important emails",
      "Share email threads in channels",
      "Reply to emails from Chttrix",
    ],
    permissions: [
      "Read email metadata and labels",
      "Post email summaries to channels",
    ],
    configOptions: {
      filterLabels: ["Important", "Starred"],
    },
    connected: false,
  },
  {
    id: "notion",
    name: "Notion",
    category: "productivity",
    categoryLabel: "Productivity",
    emoji: "📝",
    color: "from-gray-700 to-gray-900",
    accentColor: "#000000",
    description: "Link Notion pages and databases to your workspace for seamless knowledge sharing.",
    useCases: [
      "Share Notion pages in channels",
      "Preview Notion content without switching apps",
      "Create Notion pages from messages",
    ],
    permissions: [
      "Read workspace pages and databases",
      "Create new pages",
      "Share page previews in channels",
    ],
    configOptions: {
      defaultWorkspace: "Chttrix Docs",
    },
    connected: false,
  },

  // ── Communication / Meetings ──────────────────────────────────────────────────
  {
    id: "zoom",
    name: "Zoom",
    category: "communication",
    categoryLabel: "Communication",
    emoji: "🎥",
    color: "from-blue-500 to-blue-700",
    accentColor: "#2D8CFF",
    description: "Start or schedule Zoom meetings directly from Chttrix channels and DMs.",
    useCases: [
      "Start instant Zoom meetings from chat",
      "Schedule meetings and share invite links",
      "Get meeting reminders in channels",
    ],
    permissions: [
      "Create and manage meetings",
      "Post meeting links to channels",
      "Access your Zoom profile",
    ],
    configOptions: {
      defaultDuration: 60,
      autoRecord: false,
    },
    connected: true,
  },
  {
    id: "google-meet",
    name: "Google Meet",
    category: "communication",
    categoryLabel: "Communication",
    emoji: "🟢",
    color: "from-green-500 to-teal-600",
    accentColor: "#00897B",
    description: "Create and join Google Meet calls directly from your Chttrix conversations.",
    useCases: [
      "Generate Meet links from chat",
      "Join meetings with one click",
      "Schedule recurring team calls",
    ],
    permissions: [
      "Create Google Meet events",
      "Post meeting links to channels",
      "Access Google Calendar for scheduling",
    ],
    configOptions: {},
    connected: false,
  },
  {
    id: "slack-bridge",
    name: "Slack Bridge",
    category: "communication",
    categoryLabel: "Communication",
    emoji: "🌉",
    color: "from-purple-600 to-pink-600",
    accentColor: "#4A154B",
    description: "Bridge messages between Chttrix channels and Slack workspaces for cross-platform collaboration.",
    useCases: [
      "Sync messages with external Slack channels",
      "Keep external partners in the loop",
      "Mirror announcements across platforms",
    ],
    permissions: [
      "Read and post messages in channels",
      "Access Slack workspace connections",
    ],
    configOptions: {
      syncDirection: "bidirectional",
    },
    connected: false,
  },

  // ── AI Tools ─────────────────────────────────────────────────────────────────
  {
    id: "chatgpt",
    name: "ChatGPT",
    category: "ai",
    categoryLabel: "AI Tools",
    emoji: "🤖",
    color: "from-emerald-500 to-teal-600",
    accentColor: "#10A37F",
    description: "Bring ChatGPT into your channels for instant AI assistance, summaries, and content generation.",
    useCases: [
      "Summarize long message threads",
      "Generate drafts and content",
      "Answer technical questions in chat",
    ],
    permissions: [
      "Read channel messages for context",
      "Post AI responses to channels",
      "Access OpenAI API on your behalf",
    ],
    configOptions: {
      model: "gpt-4o",
      maxTokens: 1000,
    },
    connected: false,
  },
  {
    id: "gemini",
    name: "Gemini",
    category: "ai",
    categoryLabel: "AI Tools",
    emoji: "✨",
    color: "from-blue-500 to-purple-600",
    accentColor: "#8B5CF6",
    description: "Use Google Gemini for AI-powered task assistance, document analysis, and smart suggestions.",
    useCases: [
      "Analyze shared documents and files",
      "Generate action items from meetings",
      "Get context-aware suggestions in chat",
    ],
    permissions: [
      "Access messages for AI context",
      "Post Gemini responses",
      "Access Google AI services",
    ],
    configOptions: {
      model: "gemini-pro",
    },
    connected: false,
  },
  {
    id: "claude",
    name: "Claude",
    category: "ai",
    categoryLabel: "AI Tools",
    emoji: "🧠",
    color: "from-amber-500 to-orange-600",
    accentColor: "#D97706",
    description: "Integrate Anthropic Claude for nuanced AI responses, code review, and detailed analysis.",
    useCases: [
      "Code review and debugging help",
      "Long-form content summarization",
      "Safe and thoughtful AI responses",
    ],
    permissions: [
      "Read channel messages for context",
      "Post Claude responses",
      "Access Anthropic API",
    ],
    configOptions: {
      model: "claude-3-5-sonnet",
    },
    connected: false,
  },

  // ── Automation ────────────────────────────────────────────────────────────────
  {
    id: "zapier",
    name: "Zapier",
    category: "automation",
    categoryLabel: "Automation",
    emoji: "⚡",
    color: "from-orange-500 to-red-500",
    accentColor: "#FF4A00",
    description: "Connect Chttrix to 5000+ apps via Zapier to automate your workflows without code.",
    useCases: [
      "Trigger messages when CRM deals close",
      "Post form submissions to channels",
      "Automate routine status updates",
    ],
    permissions: [
      "Post messages to channels on your behalf",
      "Read basic workspace information",
    ],
    configOptions: {
      webhookUrl: "",
    },
    connected: false,
  },
  {
    id: "webhooks",
    name: "Webhooks",
    category: "automation",
    categoryLabel: "Automation",
    emoji: "🔗",
    color: "from-slate-600 to-slate-800",
    accentColor: "#475569",
    description: "Receive real-time HTTP POST notifications from any external system into your channels.",
    useCases: [
      "Post deployment alerts from CI servers",
      "Receive customer support ticket notifications",
      "Trigger messages from custom applications",
    ],
    permissions: [
      "Post messages to specified channels",
      "Read channel webhook configuration",
    ],
    configOptions: {
      webhookUrl: "",
      secret: "",
    },
    connected: false,
  },
  {
    id: "rest-api",
    name: "REST API",
    category: "automation",
    categoryLabel: "Automation",
    emoji: "🛠️",
    color: "from-cyan-600 to-blue-600",
    accentColor: "#0891B2",
    description: "Use the Chttrix REST API to build custom integrations for your specific workflow needs.",
    useCases: [
      "Build custom bots and workflows",
      "Integrate with internal tools",
      "Automate channel management",
    ],
    permissions: [
      "Full API access based on your token scopes",
      "Read and write workspace data",
    ],
    configOptions: {
      apiKey: "",
    },
    connected: false,
  },
];

// Helper: find integration by id
export const findIntegration = (id) => MOCK_INTEGRATIONS.find((i) => i.id === id);

// Map of channel-level integration toggles (mock state initial values)
export const CHANNEL_INTEGRATION_DEFAULTS = {
  github: false,
  jira: false,
  linear: false,
  zoom: false,
};
