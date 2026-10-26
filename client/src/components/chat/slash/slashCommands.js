// Slash commands in the web composer. The commands themselves, their arguments and help text are
// shared with the phone app (platform/commands/slashCommands.js); this adds the few that only the
// web app has: /meet and the integration commands (behind the `integrations` release flag).

import { COMMAND_CATEGORIES, filterCommands, matchesText, parseCommandLine } from '@platform/commands/slashCommands.js';

export * from '@platform/commands/slashCommands.js';

export const SLASH_COMMAND_CATEGORIES = [
    ...COMMAND_CATEGORIES,
    { id: 'developer', label: 'Integrations' },
];

const web = (name, emoji, description, args = '', extra = {}) => ({
    name, emoji, description, args, category: 'developer', webOnly: true, where: ['channel', 'dm', 'group'], ...extra,
});

/** Web-only commands. `flag` limits one to a release flag. */
export const WEB_ONLY_COMMANDS = [
    web('meet', '📅', 'Schedule a meeting and post it here', '', { category: 'calls' }),
    web('github', '🐙', 'Open an issue or share a pull request', 'issue [owner/repo] <title> · pr owner/repo#12', { flag: 'integrations' }),
    web('review', '🔍', "Open a pull request's changes next to the chat", 'owner/repo#12', { flag: 'integrations' }),
    web('jira', '🎫', 'Create a Jira issue', '<PROJECT> <summary>', { flag: 'integrations' }),
    web('zoom', '📹', 'Create a Zoom meeting and post the join link', '[topic]', { flag: 'integrations' }),
    web('gmeet', '🎥', 'Create a Google Meet link, or share one you paste', '[title | link]', { flag: 'integrations' }),
    web('gitlab', '🦊', 'Open a GitLab issue', 'issue group/project <title>', { flag: 'integrations' }),
    web('bitbucket', '🪣', 'Open a Bitbucket issue', 'issue workspace/repo <title>', { flag: 'integrations' }),
    web('linear', '◑', 'Create a Linear issue', 'issue TEAM <title>', { flag: 'integrations' }),
    web('drive', '📁', 'Share a Google Drive file', '[search]', { flag: 'integrations' }),
    web('onedrive', '☁️', 'Share a OneDrive file', '[search]', { flag: 'integrations' }),
    web('dropbox', '📦', 'Share a Dropbox file', '[search]', { flag: 'integrations' }),
    web('notion', '📝', 'Share a Notion page or import it into Knowledge', '[search]', { flag: 'integrations' }),
    web('confluence', '📚', 'Share a Confluence page or import it into Knowledge', '[search]', { flag: 'integrations' }),
];

/** Web-only commands available with these release flags in this place. */
export function webOnlyCommands(flags = {}, where = 'channel') {
    return WEB_ONLY_COMMANDS.filter((c) => (!c.flag || flags[c.flag] === true) && c.where.includes(where));
}

/** The web-only command `text` starts with, or null. */
export function webOnlyCommandFor(text, flags = {}, where = 'channel') {
    const line = parseCommandLine(text);
    if (!line) return null;
    const command = webOnlyCommands(flags, where).find((c) => c.name === line.name);
    return command ? { command, args: line.argsText } : null;
}

/** The menu: shared commands for ctx, then the web-only ones, filtered by what's typed. */
export function menuCommands(query, ctx = {}, flags = {}) {
    const shared = filterCommands(query, ctx);
    const q = String(query || '').replace(/^\//, '').split(/\s+/)[0].toLowerCase();
    const extras = webOnlyCommands(flags, ctx.where).filter((c) => !q || c.name.startsWith(q) || matchesText(c, q));
    return [...shared, ...extras];
}
