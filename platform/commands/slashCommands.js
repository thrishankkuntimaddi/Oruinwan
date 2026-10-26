// Slash commands: one list for the web app and the phone app, so both offer the same commands
// with the same arguments and help text. Each command checks its arguments here and runs through
// the `ctx` the app passes in (send a message, create a task, start a call…), so the apps only
// supply the actions. Messages a command sends go through the app's normal, end-to-end
// encrypted send.
//
// ctx: {
//   where: 'channel' | 'dm' | 'group' | 'thread',
//   canPost, isChannelAdmin, me: { id, username }, people: [{ id, username, name }], now?: Date,
//   send(text) → { id }?            post a message (the encrypted path)
//   notice(text) → { id }?          post the small "what happened" line (defaults to send)
//   unsend(id)                      take that line back when the action fails
//   lastMessageId() → id | null     the newest message here (a thread: its newest reply or the parent)
//   createTask({ title, assigneeIds, dueDate, linkedMessageId }) → { issueKey? }
//   remind({ messageId, at, note, forUserId })
//   createPoll({ question, options }), createChecklist({ title, items })
//   startCall({ video }), callPerson(person)
//   askAi(question), summarize()
//   scheduleMessage(text, at)
//   invite(people), leave()
//   setMuted(bool), setStatus({ emoji, text } | null), setPresence('away' | 'active')
//   setTopic(text), openSearch(words), insert(text), showHelp(), toast(message, tone)
// }
// A missing action means the command isn't available in that place.

import { parseWhen, parseTrailingWhen, whenText, isoDay } from './when.js';

export const WHERE_ALL = ['channel', 'dm', 'group', 'thread'];
const CONVERSATIONS = ['channel', 'dm', 'group'];

export const COMMAND_CATEGORIES = [
    { id: 'create', label: 'Create' },
    { id: 'calls', label: 'Calls' },
    { id: 'ai', label: 'AI' },
    { id: 'people', label: 'People and conversation' },
    { id: 'status', label: 'Your status' },
    { id: 'messages', label: 'Messages' },
];

export class CommandError extends Error {}

const fail = (message) => {
    throw new CommandError(message);
};
const usageOf = (c) => `/${c.name}${c.args ? ` ${c.args}` : ''}`;
const ok = (value) => ({ value });
const bad = (command, message) => ({ error: message ? `${message} Usage: ${usageOf(command)}` : `Usage: ${usageOf(command)}` });

/** "@ana @ben.k" in `text` → { people, unknown, text without them }. */
export function takePeople(text, people = []) {
    const byName = new Map((people || []).filter((p) => p?.username).map((p) => [String(p.username).toLowerCase(), p]));
    const found = [];
    const unknown = [];
    const rest = String(text || '').replace(/(^|\s)@([\w.-]+)/g, (all, space, handle) => {
        const h = handle.replace(/[.-]+$/, '');
        const p = byName.get(h.toLowerCase());
        if (p) {
            if (!found.some((x) => String(x.id) === String(p.id))) found.push(p);
        } else unknown.push(h);
        return space;
    });
    return { people: found, unknown, text: rest.replace(/\s+/g, ' ').trim() };
}

/** "Question" "A" "B" (straight or curly quotes), or Question | A | B. */
export function splitQuoted(text) {
    const s = String(text || '').trim();
    const quoted = [...s.matchAll(/["“”]([^"“”]*)["“”]/g)].map((m) => m[1].trim()).filter(Boolean);
    if (quoted.length) return quoted;
    if (s.includes('|')) return s.split('|').map((x) => x.trim()).filter(Boolean);
    return s ? [s] : [];
}

const isEmoji = (t) => /^(:[a-z0-9_+-]+:|(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator})[\p{Emoji}‍️\p{Emoji_Modifier}]*)$/u.test(t || '');

// The markdown-escaped shrug: shows as ¯\_(ツ)_/¯ on the web and on the phone.
export const SHRUG = '¯\\\\\\_(ツ)\\_/¯';

const def = (c) => ({ where: WHERE_ALL, permission: null, posts: false, ...c });

export const COMMANDS = [
    def({
        name: 'task', category: 'create', emoji: '✅',
        args: '<title> [@person] [due tomorrow|friday|2026-11-02]',
        description: 'Create a task linked to this conversation',
        posts: true, needs: ['createTask'],
        example: '/task Fix login @sandeep tomorrow',
        parse(argsText, ctx) {
            const { people, unknown, text } = takePeople(argsText, ctx.people);
            if (unknown.length) return bad(this, `No one called @${unknown[0]} in this workspace.`);
            const due = parseTrailingWhen(text, { now: ctx.now || new Date(), defaultHour: 17 });
            const title = (due ? due.before : text).replace(/\s+(due|by)$/i, '').trim();
            if (!title) return bad(this, 'Give the task a title.');
            return ok({ title, assignees: people, due: due ? due.at : null, dueHasTime: due ? due.hasTime : false });
        },
        async exec(ctx, { title, assignees, due, dueHasTime }) {
            const now = ctx.now || new Date();
            const who = assignees.length ? ` · for ${assignees.map((p) => `@${p.username}`).join(', ')}` : '';
            const when = due ? ` · due ${whenText(due, { now, hasTime: dueHasTime })}` : '';
            const line = await notice(ctx, `✅ Task created: **${escapeMd(title)}**${who}${when}`);
            try {
                const task = await ctx.createTask({
                    title,
                    assigneeIds: assignees.map((p) => String(p.id)),
                    dueDate: due ? due.toISOString() : null,
                    dueDay: due ? isoDay(due) : null,
                    linkedMessageId: line?.id || null,
                });
                ctx.toast?.(`Task created${task?.issueKey ? ` (${task.issueKey})` : ''}`, 'success');
                return task;
            } catch (err) {
                if (line?.id) await Promise.resolve(ctx.unsend?.(line.id)).catch(() => {});
                throw err;
            }
        },
    }),
    def({
        name: 'remind', category: 'create', emoji: '⏰',
        args: '[me|@person] <when> <what>',
        description: 'Set a reminder for you or someone here',
        needs: ['remind'],
        example: '/remind me in 1 hour check the build',
        parse(argsText, ctx) {
            const words = String(argsText || '').trim().split(/\s+/).filter(Boolean);
            let target = null;
            if (words[0]?.toLowerCase() === 'me') words.shift();
            else if (words[0]?.startsWith('@')) {
                const { people, unknown } = takePeople(words[0], ctx.people);
                if (unknown.length) return bad(this, `No one called @${unknown[0]} in this workspace.`);
                target = people[0];
                words.shift();
                if (target && ctx.me && String(target.id) === String(ctx.me.id)) target = null;
            }
            const rest = words.join(' ');
            const now = ctx.now || new Date();
            const lead = parseWhen(rest, { now });
            let when = lead ? { at: lead.at, hasTime: lead.hasTime } : null;
            let what = lead ? lead.rest : '';
            if (!lead) {
                const trail = parseTrailingWhen(rest, { now, lead: ['at', 'on', 'in'] });
                if (trail) {
                    when = { at: trail.at, hasTime: trail.hasTime };
                    what = trail.before;
                }
            }
            what = what.replace(/^(to|that|about)\s+/i, '').trim();
            if (!when) return bad(this, 'When? Try "in 2 hours", "tomorrow 9am" or "friday".');
            if (when.at <= now) return bad(this, 'That time has passed.');
            if (!what) return bad(this, 'What should the reminder say?');
            return ok({ target, at: when.at, what });
        },
        async exec(ctx, { target, at, what }) {
            const now = ctx.now || new Date();
            const time = whenText(at, { now });
            if (!target) {
                // My own reminder: on the newest message here, without posting anything.
                let messageId = await ctx.lastMessageId?.();
                if (!messageId) messageId = (await notice(ctx, `⏰ Reminder: ${escapeMd(what)}`))?.id;
                if (!messageId) fail('Send a message here first, then set the reminder.');
                await ctx.remind({ messageId, at, note: what, forUserId: null });
                ctx.toast?.(`I'll remind you ${time}`, 'success');
                return;
            }
            const line = await notice(ctx, `⏰ Reminder for @${target.username} ${time}: ${escapeMd(what)}`);
            if (!line?.id) fail('Could not post the reminder here.');
            try {
                await ctx.remind({ messageId: line.id, at, note: what, forUserId: String(target.id) });
            } catch (err) {
                await Promise.resolve(ctx.unsend?.(line.id)).catch(() => {});
                throw err;
            }
            ctx.toast?.(`Reminder set for @${target.username}`, 'success');
        },
    }),
    def({
        name: 'poll', category: 'create', emoji: '📊',
        args: '"Question" "Option 1" "Option 2"',
        description: 'Create a poll',
        where: CONVERSATIONS, posts: true, needs: ['createPoll'],
        parse(argsText) {
            const parts = splitQuoted(argsText);
            if (!parts.length) return bad(this);
            const [question, ...options] = parts;
            if (options.length < 2) return bad(this, 'Add at least two options.');
            if (options.length > 10) return bad(this, 'Ten options at most.');
            if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return bad(this, 'Options must be different.');
            return ok({ question, options });
        },
        exec: (ctx, args) => ctx.createPoll(args),
    }),
    def({
        name: 'checklist', category: 'create', emoji: '☑️',
        args: 'item; item; item',
        description: 'Post a checklist',
        where: CONVERSATIONS, posts: true, needs: ['createChecklist'],
        parse(argsText) {
            let text = String(argsText || '').trim();
            let title = 'Checklist';
            const titled = text.match(/^([^;:]{1,80}):\s*(.+)$/);
            if (titled && titled[2].includes(';')) {
                title = titled[1].trim();
                text = titled[2];
            }
            const items = text.split(/;|\n/).map((x) => x.trim()).filter(Boolean);
            if (!items.length) return bad(this, 'Add the items, separated by ;');
            if (items.length > 50) return bad(this, 'Fifty items at most.');
            return ok({ title, items });
        },
        exec: (ctx, args) => ctx.createChecklist(args),
    }),
    def({
        name: 'huddle', category: 'calls', emoji: '🎧',
        args: '', description: 'Start a call in this conversation (or join the one running)',
        needs: ['startCall'],
        parse: (argsText) => ok({}),
        exec: (ctx) => ctx.startCall({ video: false }),
    }),
    def({
        name: 'call', category: 'calls', emoji: '📞',
        args: '@person', description: 'Call someone (or start a call here)',
        needs: ['startCall'],
        parse(argsText, ctx) {
            const { people, unknown } = takePeople(argsText, ctx.people);
            if (unknown.length) return bad(this, `No one called @${unknown[0]} in this workspace.`);
            if (people.length > 1) return bad(this, 'One person at a time.');
            if (!people.length && String(argsText || '').trim()) return bad(this);
            return ok({ person: people[0] || null });
        },
        exec(ctx, { person }) {
            if (!person) return ctx.startCall({ video: false });
            if (!ctx.callPerson) fail('Open a chat with them to call.');
            return ctx.callPerson(person);
        },
    }),
    def({
        name: 'video', category: 'calls', emoji: '🎥',
        args: '', description: 'Start a video call here',
        needs: ['startCall'],
        parse: () => ok({}),
        exec: (ctx) => ctx.startCall({ video: true }),
    }),
    def({
        name: 'ai', category: 'ai', emoji: '✨',
        args: '<question>', description: 'Ask Oruinwan AI (same as @ai)',
        needs: ['askAi'],
        parse(argsText) {
            const q = String(argsText || '').trim();
            return q ? ok({ question: q }) : bad(this, 'What do you want to ask?');
        },
        exec: (ctx, { question }) => ctx.askAi(question),
    }),
    def({
        name: 'summarize', category: 'ai', emoji: '📝',
        args: '', description: 'Summarize this conversation or thread',
        needs: ['summarize'],
        parse: () => ok({}),
        exec: (ctx) => ctx.summarize(),
    }),
    def({
        name: 'later', category: 'messages', emoji: '🕒',
        args: '<when> <message>', description: 'Send a message later',
        where: CONVERSATIONS, posts: true, needs: ['scheduleMessage'],
        example: '/later tomorrow 9am Standup notes are in the doc',
        parse(argsText, ctx) {
            const now = ctx.now || new Date();
            const lead = parseWhen(argsText, { now });
            if (!lead) return bad(this, 'When? Try "in 2 hours", "tomorrow 9am" or "friday".');
            if (lead.at <= now) return bad(this, 'That time has passed.');
            if (!lead.rest.trim()) return bad(this, 'Type the message after the time.');
            return ok({ at: lead.at, text: lead.rest.trim() });
        },
        async exec(ctx, { at, text }) {
            await ctx.scheduleMessage(text, at);
            ctx.toast?.(`Scheduled for ${whenText(at, { now: ctx.now || new Date() })}`, 'success');
        },
    }),
    def({
        name: 'invite', category: 'people', emoji: '➕',
        args: '@person [@person…]', description: 'Add people here (in a 1:1 chat: start a group)',
        where: CONVERSATIONS, needs: ['invite'],
        parse(argsText, ctx) {
            const { people, unknown } = takePeople(argsText, ctx.people);
            if (unknown.length) return bad(this, `No one called @${unknown[0]} in this workspace.`);
            const others = people.filter((p) => !ctx.me || String(p.id) !== String(ctx.me.id));
            return others.length ? ok({ people: others }) : bad(this, 'Who should join?');
        },
        exec: (ctx, { people }) => ctx.invite(people),
    }),
    def({
        name: 'leave', category: 'people', emoji: '🚪',
        args: '', description: 'Leave this channel or group',
        where: ['channel', 'group'], needs: ['leave'],
        parse: () => ok({}),
        exec: (ctx) => ctx.leave(),
    }),
    def({
        name: 'mute', category: 'people', emoji: '🔕',
        args: '', description: 'Mute notifications from this conversation',
        where: CONVERSATIONS, needs: ['setMuted'],
        parse: () => ok({}),
        async exec(ctx) {
            await ctx.setMuted(true);
            ctx.toast?.('Muted', 'success');
        },
    }),
    def({
        name: 'unmute', category: 'people', emoji: '🔔',
        args: '', description: 'Turn notifications back on here',
        where: CONVERSATIONS, needs: ['setMuted'],
        parse: () => ok({}),
        async exec(ctx) {
            await ctx.setMuted(false);
            ctx.toast?.('Unmuted', 'success');
        },
    }),
    def({
        name: 'topic', category: 'people', emoji: '🏷️',
        args: '<text>', description: 'Set the channel topic',
        where: ['channel'], permission: 'channelAdmin', needs: ['setTopic'],
        parse(argsText) {
            const t = String(argsText || '').trim();
            if (!t) return bad(this, 'Type the new topic.');
            if (t.length > 250) return bad(this, '250 characters at most.');
            return ok({ topic: t });
        },
        async exec(ctx, { topic }) {
            await ctx.setTopic(topic);
            ctx.toast?.('Topic updated', 'success');
        },
    }),
    def({
        name: 'status', category: 'status', emoji: '💬',
        args: '<emoji> <text>', description: 'Set your status (empty clears it)',
        needs: ['setStatus'],
        example: '/status 🌴 On holiday until Monday',
        parse(argsText) {
            const words = String(argsText || '').trim().split(/\s+/).filter(Boolean);
            if (!words.length) return ok({ status: null });
            const emoji = isEmoji(words[0]) ? words.shift() : '';
            const text = words.join(' ');
            if (text.length > 100) return bad(this, '100 characters at most.');
            return ok({ status: { emoji, text } });
        },
        async exec(ctx, { status }) {
            await ctx.setStatus(status);
            ctx.toast?.(status ? `Status: ${[status.emoji, status.text].filter(Boolean).join(' ')}` : 'Status cleared', 'success');
        },
    }),
    def({
        name: 'away', category: 'status', emoji: '🌙',
        args: '', description: 'Show yourself as away',
        needs: ['setPresence'],
        parse: () => ok({}),
        async exec(ctx) {
            await ctx.setPresence('away');
            ctx.toast?.("You're away", 'success');
        },
    }),
    def({
        name: 'back', category: 'status', emoji: '☀️',
        args: '', description: 'Show yourself as active again',
        needs: ['setPresence'],
        parse: () => ok({}),
        async exec(ctx) {
            await ctx.setPresence('active');
            ctx.toast?.("You're active", 'success');
        },
    }),
    def({
        name: 'shrug', category: 'messages', emoji: '🤷',
        args: '[message]', description: 'Send a message with ¯\\_(ツ)_/¯',
        posts: true, needs: ['send'],
        parse: (argsText) => ok({ text: String(argsText || '').trim() }),
        exec: (ctx, { text }) => ctx.send(`${text ? `${text} ` : ''}${SHRUG}`),
    }),
    def({
        name: 'me', category: 'messages', emoji: '💭',
        args: '<text>', description: 'Send an action, in italics: /me is on it',
        posts: true, needs: ['send'],
        parse(argsText) {
            const t = String(argsText || '').trim().replace(/_/g, '\\_');
            return t ? ok({ text: t }) : bad(this, 'Type what you are doing.');
        },
        exec: (ctx, { text }) => ctx.send(`_${text}_`),
    }),
    def({
        name: 'code', category: 'messages', emoji: '💻',
        args: '[language]', description: 'Start a code block',
        needs: ['insert'],
        parse: (argsText) => ok({ lang: String(argsText || '').trim().split(/\s+/)[0] || '' }),
        exec: (ctx, { lang }) => ctx.insert('```' + lang + '\n\n```'),
        keepsText: true,
    }),
    def({
        name: 'search', category: 'messages', emoji: '🔍',
        args: '<words>', description: 'Search this conversation',
        needs: ['openSearch'],
        parse(argsText) {
            const q = String(argsText || '').trim();
            return ok({ words: q });
        },
        exec: (ctx, { words }) => ctx.openSearch(words),
    }),
    def({
        name: 'help', category: 'messages', emoji: '❓',
        args: '', description: 'List all commands',
        needs: ['showHelp'],
        parse: () => ok({}),
        exec: (ctx) => ctx.showHelp(),
    }),
];

const BY_NAME = new Map(COMMANDS.map((c) => [c.name, c]));

/** The command named `name` (no slash), or null. */
export const findCommand = (name) => BY_NAME.get(String(name || '').replace(/^\//, '').toLowerCase()) || null;

/** True when a command needs nothing after its name (picking it from the list runs it straight away). */
export const runsWithoutArgs = (command) => !command.args || command.args.startsWith('[');

/** The usage line: "/task <title> [@person] …". */
export const usage = (command) => usageOf(command);

/** Why `command` can't run in ctx, or null. */
export function unavailableReason(command, ctx = {}) {
    const where = ctx.where || 'channel';
    if (!command.where.includes(where)) {
        const places = { channel: 'channels', dm: 'direct messages', group: 'groups', thread: 'threads' };
        return `/${command.name} works in ${command.where.map((w) => places[w]).join(', ')}, not in ${places[where] || 'here'}.`;
    }
    if (command.permission === 'channelAdmin' && !ctx.isChannelAdmin) return `Only channel admins can use /${command.name}.`;
    if (command.posts && ctx.canPost === false) return 'Only admins can post here.';
    const missing = (command.needs || []).find((n) => typeof ctx[n] !== 'function');
    if (missing) return `/${command.name} isn't available here.`;
    return null;
}

/** The commands offered in ctx (where they work and I'm allowed), in list order. */
export function commandsFor(ctx = {}) {
    return COMMANDS.filter((c) => !unavailableReason(c, ctx));
}

/** Commands matching what's typed after "/": names first, then descriptions. */
export function filterCommands(query, ctx = {}) {
    const list = commandsFor(ctx);
    const q = String(query || '').replace(/^\//, '').split(/\s+/)[0].toLowerCase();
    if (!q) return list;
    const byName = list.filter((c) => c.name.startsWith(q));
    const byText = list.filter((c) => !c.name.startsWith(q) && matchesText(c, q));
    return [...byName, ...byText];
}

/** From three letters on, a word of the description can match too ("/sched" finds /later). */
export function matchesText(command, q) {
    if (q.length < 3) return false;
    return command.name.includes(q) || command.description.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.startsWith(q));
}

/** "/task fix it" → { name: 'task', argsText: 'fix it' }; null when the text isn't shaped like a command. */
export function parseCommandLine(text) {
    const m = String(text || '').trim().match(/^\/([a-z][a-z0-9_-]*)(?:\s+([\s\S]*))?$/i);
    if (!m) return null;
    return { name: m[1].toLowerCase(), argsText: (m[2] || '').trim() };
}

/**
 * What sending `text` would do:
 *   { status: 'none' }                              not a command: send it as a message
 *   { status: 'unknown', name }                     /xyz: ask "Send as text?"
 *   { status: 'unavailable', command, message }     not here / not allowed
 *   { status: 'invalid', command, message }         bad arguments: inline help
 *   { status: 'ready', command, args }              run it
 */
export function prepareCommand(text, ctx = {}) {
    const line = parseCommandLine(text);
    if (!line) return { status: 'none' };
    const command = findCommand(line.name);
    if (!command) return { status: 'unknown', name: line.name };
    const reason = unavailableReason(command, ctx);
    if (reason) return { status: 'unavailable', command, message: reason };
    const parsed = command.parse.call(command, line.argsText, ctx);
    if (parsed.error) return { status: 'invalid', command, message: parsed.error };
    return { status: 'ready', command, args: parsed.value };
}

/** Runs a prepared command. Rejects with a message to show (a CommandError or the action's error). */
export async function runPrepared(prepared, ctx) {
    if (prepared?.status !== 'ready') throw new CommandError(prepared?.message || 'That is not a command.');
    return prepared.command.exec.call(prepared.command, ctx, prepared.args);
}

/** Every command can also be run directly: run(ctx, argsText). */
for (const c of COMMANDS) {
    c.run = (ctx, argsText) => runPrepared(prepareCommand(`/${c.name}${argsText ? ` ${argsText}` : ''}`, ctx), ctx);
}

/** One line per command for /help: { name, usage, description, available }. */
export function helpLines(ctx = {}) {
    return COMMANDS.map((c) => ({ name: c.name, usage: usageOf(c), description: c.description, example: c.example || null, available: !unavailableReason(c, ctx) }));
}

/** The hint shown while typing a command's arguments. */
export function typingHint(text, ctx = {}) {
    const line = parseCommandLine(text);
    if (!line) return null;
    const command = findCommand(line.name);
    if (!command) return null;
    return { command, usage: usageOf(command), description: command.description, unavailable: unavailableReason(command, ctx) };
}

function notice(ctx, text) {
    const post = ctx.notice || ctx.send;
    return post ? post(text) : null;
}

function escapeMd(s) {
    return String(s || '').replace(/([*_`~[\]])/g, '\\$1');
}
