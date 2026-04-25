export const SLASH_COMMAND_CATEGORIES = [
  { id: "developer", label: "Developer Tools" },
  { id: "productivity", label: "Productivity" },
  { id: "communication", label: "Communication" },
  { id: "ai", label: "AI Tools" },
  { id: "automation", label: "Automation" },
];

export const SLASH_COMMANDS = [
  
  {
    command: "/github",
    label: "GitHub",
    category: "developer",
    emoji: "🐙",
    color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    description: "Create issues and share pull requests",
    preview: {
      title: "GitHub",
      actions: [
        { icon: "📌", label: "Create issue", detail: "Opens issue form for any repo" },
        { icon: "🔀", label: "Share pull request", detail: "Link a PR directly in chat" },
        { icon: "🔗", label: "Link repository", detail: "Attach a repo card to your message" },
      ],
      hint: "Usage: /github create-issue | /github pr | /github link",
    },
  },
  {
    command: "/jira",
    label: "Jira",
    category: "developer",
    emoji: "🎫",
    color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    description: "Create and manage Jira tickets",
    preview: {
      title: "Jira",
      actions: [
        { icon: "🆕", label: "Create ticket", detail: "Add a bug, task or story" },
        { icon: "🔍", label: "Search issues", detail: "Find a ticket by ID or keyword" },
        { icon: "📊", label: "Sprint status", detail: "Show active sprint progress" },
      ],
      hint: "Usage: /jira create | /jira search | /jira sprint",
    },
  },
  {
    command: "/linear",
    label: "Linear",
    category: "developer",
    emoji: "⚡",
    color: "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
    description: "Create issues and browse cycles",
    preview: {
      title: "Linear",
      actions: [
        { icon: "➕", label: "New issue", detail: "Create an issue in any Linear team" },
        { icon: "🔄", label: "Assign issue", detail: "Assign an existing issue to a teammate" },
        { icon: "📅", label: "View cycle", detail: "See the current sprint cycle" },
      ],
      hint: "Usage: /linear create | /linear assign | /linear cycle",
    },
  },
  {
    command: "/gitlab",
    label: "GitLab",
    category: "developer",
    emoji: "🦊",
    color: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    description: "Link merge requests and pipeline status",
    preview: {
      title: "GitLab",
      actions: [
        { icon: "🔀", label: "Share MR", detail: "Link a merge request in chat" },
        { icon: "🚦", label: "Pipeline status", detail: "Show the latest CI/CD status" },
        { icon: "🐛", label: "Create issue", detail: "Open a new GitLab issue" },
      ],
      hint: "Usage: /gitlab mr | /gitlab pipeline | /gitlab issue",
    },
  },

  
  {
    command: "/drive",
    label: "Google Drive",
    category: "productivity",
    emoji: "📁",
    color: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    description: "Share files from Google Drive",
    preview: {
      title: "Google Drive",
      actions: [
        { icon: "📤", label: "Share file", detail: "Pick a file and share the link" },
        { icon: "📄", label: "New document", detail: "Create a Doc and share instantly" },
        { icon: "🔍", label: "Search Drive", detail: "Find any file in your Drive" },
      ],
      hint: "Usage: /drive share | /drive new | /drive search",
    },
  },
  {
    command: "/calendar",
    label: "Google Calendar",
    category: "productivity",
    emoji: "📅",
    color: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",
    description: "Schedule events and share calendar links",
    preview: {
      title: "Google Calendar",
      actions: [
        { icon: "📆", label: "Schedule event", detail: "Create an event and invite teammates" },
        { icon: "👀", label: "View agenda", detail: "See today's upcoming events" },
        { icon: "🔗", label: "Share event", detail: "Share an event invite link" },
      ],
      hint: "Usage: /calendar schedule | /calendar today | /calendar share",
    },
  },
  {
    command: "/gmail",
    label: "Gmail",
    category: "productivity",
    emoji: "📧",
    color: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300",
    description: "Share email threads in channels",
    preview: {
      title: "Gmail",
      actions: [
        { icon: "📨", label: "Share email", detail: "Paste an email thread into chat" },
        { icon: "⭐", label: "Starred emails", detail: "Browse your starred messages" },
      ],
      hint: "Usage: /gmail share | /gmail starred",
    },
  },
  {
    command: "/notion",
    label: "Notion",
    category: "productivity",
    emoji: "📝",
    color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    description: "Share Notion pages and create docs",
    preview: {
      title: "Notion",
      actions: [
        { icon: "🔗", label: "Share page", detail: "Embed a Notion page preview" },
        { icon: "➕", label: "New page", detail: "Create a page from chat" },
        { icon: "🔍", label: "Search workspace", detail: "Find any Notion page" },
      ],
      hint: "Usage: /notion share | /notion new | /notion search",
    },
  },

  
  {
    command: "/zoom",
    label: "Zoom",
    category: "communication",
    emoji: "🎥",
    color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    description: "Start or schedule a Zoom meeting",
    preview: {
      title: "Zoom",
      actions: [
        { icon: "🚀", label: "Start instant meeting", detail: "Launch a meeting right now" },
        { icon: "📆", label: "Schedule meeting", detail: "Pick a time and invite attendees" },
        { icon: "🔗", label: "Share meeting link", detail: "Drop your personal Zoom link" },
      ],
      hint: "Usage: /zoom start | /zoom schedule | /zoom link",
    },
  },
  {
    command: "/meet",
    label: "Google Meet",
    category: "communication",
    emoji: "🟢",
    color: "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
    description: "Create a Google Meet call",
    preview: {
      title: "Google Meet",
      actions: [
        { icon: "🚀", label: "Start Meet call", detail: "Generate a Meet link instantly" },
        { icon: "📆", label: "Schedule call", detail: "Add a Meet to Google Calendar" },
      ],
      hint: "Usage: /meet start | /meet schedule",
    },
  },

  
  {
    command: "/chatgpt",
    label: "ChatGPT",
    category: "ai",
    emoji: "🤖",
    color: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    description: "Ask ChatGPT anything from chat",
    preview: {
      title: "ChatGPT",
      actions: [
        { icon: "💬", label: "Ask a question", detail: "Get an AI answer shared in channel" },
        { icon: "✍️", label: "Generate content", detail: "Draft a message, email or doc" },
        { icon: "📋", label: "Summarize thread", detail: "Condense recent messages" },
      ],
      hint: "Usage: /chatgpt [your question]",
    },
  },
  {
    command: "/gemini",
    label: "Gemini",
    category: "ai",
    emoji: "✨",
    color: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
    description: "Use Google Gemini AI in your chat",
    preview: {
      title: "Gemini",
      actions: [
        { icon: "🧠", label: "Ask Gemini", detail: "Get context-aware AI responses" },
        { icon: "📄", label: "Analyze document", detail: "Upload and analyze a file" },
        { icon: "💡", label: "Get suggestions", detail: "AI ideas for your current task" },
      ],
      hint: "Usage: /gemini [your question]",
    },
  },
  {
    command: "/claude",
    label: "Claude",
    category: "ai",
    emoji: "🧠",
    color: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    description: "Use Anthropic Claude for AI assistance",
    preview: {
      title: "Claude",
      actions: [
        { icon: "💬", label: "Ask Claude", detail: "Thoughtful, nuanced AI responses" },
        { icon: "🔍", label: "Review code", detail: "Get a code review or debugging help" },
        { icon: "📋", label: "Summarize text", detail: "Condense long documents" },
      ],
      hint: "Usage: /claude [your question]",
    },
  },

  
  {
    command: "/zapier",
    label: "Zapier",
    category: "automation",
    emoji: "⚡",
    color: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
    description: "Trigger Zapier automations from chat",
    preview: {
      title: "Zapier",
      actions: [
        { icon: "▶️", label: "Trigger Zap", detail: "Fire a configured Zapier automation" },
        { icon: "📋", label: "List active Zaps", detail: "See all running automations" },
      ],
      hint: "Usage: /zapier trigger | /zapier list",
    },
  },
  {
    command: "/webhook",
    label: "Webhook",
    category: "automation",
    emoji: "🔗",
    color: "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    description: "Send a custom webhook notification",
    preview: {
      title: "Webhook",
      actions: [
        { icon: "📡", label: "Send webhook", detail: "POST data to a configured endpoint" },
        { icon: "📋", label: "View webhook log", detail: "See recent webhook deliveries" },
      ],
      hint: "Usage: /webhook send | /webhook log",
    },
  },
];

export const COMMANDS_BY_CATEGORY = SLASH_COMMAND_CATEGORIES.map((cat) => ({
  ...cat,
  commands: SLASH_COMMANDS.filter((cmd) => cmd.category === cat.id),
})).filter((cat) => cat.commands.length > 0);

export const filterSlashCommands = (query) => {
  if (!query || query === "/") return SLASH_COMMANDS;
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.command.toLowerCase().includes(q) ||
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q)
  );
};
