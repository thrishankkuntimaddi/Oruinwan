// Slash commands the composer actually runs. Each one maps to a real feature;
// `where` limits it to places that feature exists, `flag` to a release flag.

export const SLASH_COMMAND_CATEGORIES = [
  { id: "communication", label: "Communication" },
  { id: "productivity", label: "Productivity" },
  { id: "ai", label: "AI" },
  { id: "developer", label: "Developer" },
];

const cmd = (command, label, category, emoji, description, hint, extra = {}) => ({
  command, label, category, emoji, description,
  color: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
  preview: { title: label, actions: [{ icon: emoji, label: description, detail: hint }], hint },
  ...extra,
});

export const SLASH_COMMANDS = [
  cmd("/call", "Voice call", "communication", "📞", "Start (or join) a voice huddle here", "Usage: /call"),
  cmd("/video", "Video call", "communication", "🎥", "Start (or join) a video call here", "Usage: /video"),
  cmd("/meet", "Schedule meeting", "communication", "📅", "Schedule a meeting and post it here", "Usage: /meet"),
  cmd("/poll", "Poll", "productivity", "📊", "Create a poll in this conversation", "Usage: /poll"),
  cmd("/code", "Code block", "productivity", "💻", "Insert a code block", "Usage: /code [language]"),
  cmd("/shrug", "Shrug", "communication", "🤷", "Send a message with ¯\\_(ツ)_/¯", "Usage: /shrug [message]"),
  cmd("/ai", "Ask Oruinwan AI", "ai", "✨", "Ask the assistant about this conversation", "Usage: /ai <question>"),
  cmd("/task", "New task", "productivity", "✅", "Create a task in this conversation", "Usage: /task <title>"),
  cmd("/github", "GitHub", "developer", "🐙", "Open an issue or share a pull request", "Usage: /github issue [owner/repo] <title> · /github pr owner/repo#12", { flag: "integrations" }),
  cmd("/review", "Review pull request", "developer", "🔍", "Open a pull request's changes next to the chat", "Usage: /review owner/repo#12 (or a PR link)", { flag: "integrations" }),
  cmd("/jira", "Jira issue", "developer", "🎫", "Create a Jira issue", "Usage: /jira <PROJECT> <summary>", { flag: "integrations" }),
  cmd("/zoom", "Zoom meeting", "communication", "📹", "Create a Zoom meeting and post the join link", "Usage: /zoom [topic]", { flag: "integrations" }),
];

/** Commands available with the given release flags. */
export function availableSlashCommands(flags = {}) {
  return SLASH_COMMANDS.filter((c) => !c.flag || flags[c.flag] === true);
}

export const filterSlashCommands = (query, flags = {}) => {
  const list = availableSlashCommands(flags);
  if (!query || query === "/") return list;
  const q = query.toLowerCase().split(/\s+/)[0];
  return list.filter(
    (c) => c.command.toLowerCase().startsWith(q) || c.label.toLowerCase().includes(q.replace(/^\//, ""))
  );
};

/** "/ai what's next?" -> { name: "ai", args: "what's next?" }; null for unknown commands. */
export function parseSlashCommand(text, flags = {}) {
  const m = String(text || "").trim().match(/^\/([a-z]+)(?:\s+([\s\S]*))?$/i);
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (!availableSlashCommands(flags).some((c) => c.command === `/${name}`)) return null;
  return { name, args: (m[2] || "").trim() };
}
