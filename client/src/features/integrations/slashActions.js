import api from '../../services/api';
import { parseGithubArgs, parseJiraArgs, parsePrRef, defaultRepoForChannel } from './prRefs';
import {
    isConnected, notConnectedMessage, createGithubIssue, getPullRequest, createJiraIssue, createZoomMeeting, connectorAction,
} from './integrationsApi';
import { openCloudPicker, itemMarkdown, PICKER_TYPES } from './CloudPicker';
import { openCodeReview } from './codeReviewBus';

// Slash commands that talk to integrations (and /task). The composer calls
// runIntegrationCommand() and shows `error` if it throws.

// /drive etc. map to their connector type.
const PICKER_COMMANDS = { drive: 'google_drive', onedrive: 'onedrive', dropbox: 'dropbox', notion: 'notion', confluence: 'confluence' };
const ISSUE_COMMANDS = {
    gitlab: { label: 'GitLab', field: 'project', re: /^[\w.-]+(\/[\w.-]+)+$/, usage: '/gitlab issue group/project <title>' },
    bitbucket: { label: 'Bitbucket', field: 'repo', re: /^[\w.-]+\/[\w.-]+$/, usage: '/bitbucket issue workspace/repo <title>' },
    linear: { label: 'Linear', field: 'team', re: /^[A-Za-z][A-Za-z0-9]{0,9}$/, usage: '/linear issue TEAM <title>' },
};
const MEET_LINK = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(\?\S*)?$/;

export const INTEGRATION_COMMANDS = new Set(['github', 'jira', 'zoom', 'review', 'task', 'gmeet', ...Object.keys(PICKER_COMMANDS), ...Object.keys(ISSUE_COMMANDS)]);

/** "issue group/project Fix login" → { target, title }. */
export function parseIssueArgs(name, args) {
    const spec = ISSUE_COMMANDS[name];
    const words = String(args || '').trim().split(/\s+/).filter(Boolean);
    if (words[0]?.toLowerCase() === 'issue') words.shift();
    const [target, ...rest] = words;
    const title = rest.join(' ').trim();
    if (!target || !title || !spec.re.test(target)) return { error: `Usage: ${spec.usage}` };
    return { target: name === 'linear' ? target.toUpperCase() : target, title };
}

const esc = (s) => String(s || '').replace(/([[\]])/g, '\\$1');

class CommandError extends Error {}
const fail = (msg) => { throw new CommandError(msg); };

async function requireConnected(type, workspaceId) {
    if (!workspaceId) fail('Open a workspace first.');
    const status = await isConnected(type, workspaceId);
    if (!status.connected) fail(notConnectedMessage(type));
    return status.config || {};
}

/**
 * ctx: { workspaceId, conversationId, conversationType, send(markdown), notify(msg, tone) }
 * Resolves when done; rejects with a user-facing message.
 */
export async function runIntegrationCommand(name, args, ctx) {
    const { workspaceId, conversationId, conversationType, send, notify } = ctx;
    const channelId = conversationType === 'channel' ? conversationId : null;

    switch (name) {
        case 'review': {
            const ref = parsePrRef(args);
            if (!ref) fail('Usage: /review owner/repo#12 (or paste the pull request link)');
            if (!openCodeReview({ ...ref, workspaceId })) fail('Open a channel or DM to view the changes.');
            return;
        }

        case 'github': {
            const cmd = parseGithubArgs(args);
            if (cmd.sub === 'help') fail('Usage: /github issue [owner/repo] <title>  ·  /github pr owner/repo#12');
            if (cmd.sub === 'invalid') fail(cmd.error);
            const config = await requireConnected('github', workspaceId);
            if (cmd.sub === 'pr') {
                const data = await getPullRequest(workspaceId, cmd.ref.repo, cmd.ref.number);
                const pr = data?.pr || {};
                await send(`[${cmd.ref.repo}#${cmd.ref.number}${pr.title ? ` — ${esc(pr.title)}` : ''}](${pr.url || cmd.ref.url})`);
                return;
            }
            const repo = cmd.repo || defaultRepoForChannel(config.routes, channelId);
            if (!repo) fail('Which repository? Use /github issue owner/repo <title>, or route a repository to this channel in Settings → Integrations.');
            const res = await createGithubIssue({ workspaceId, repo, title: cmd.title, body: '' });
            const issue = res?.issue || res || {};
            const num = issue.number ? `#${issue.number}` : '';
            const link = issue.url || issue.html_url;
            await send(`🐙 Opened GitHub issue ${link ? `[${repo}${num}](${link})` : `${repo}${num}`}: **${esc(issue.title || cmd.title)}**`);
            notify?.(`Issue ${repo}${num} created`, 'success');
            return;
        }

        case 'jira': {
            const cmd = parseJiraArgs(args);
            if (cmd.error) fail(cmd.error);
            await requireConnected('jira', workspaceId);
            const res = await createJiraIssue({ workspaceId, projectKey: cmd.projectKey, summary: cmd.summary, description: '' });
            const issue = res?.issue || res || {};
            const key = issue.key || cmd.projectKey;
            await send(`🎫 Created Jira issue ${issue.url ? `[${key}](${issue.url})` : key}: **${esc(issue.summary || cmd.summary)}**`);
            notify?.(`${key} created`, 'success');
            return;
        }

        case 'zoom': {
            await requireConnected('zoom', workspaceId);
            const topic = args || 'Quick sync';
            const res = await createZoomMeeting({ workspaceId, topic });
            const m = res?.meeting || res || {};
            const joinUrl = m.joinUrl || m.join_url;
            if (!joinUrl) fail('Zoom did not return a join link.');
            await send(`📹 **Zoom meeting — ${esc(m.topic || topic)}**\n[Join the meeting](${joinUrl})`);
            return;
        }

        case 'task': {
            const title = String(args || '').trim();
            if (!title) fail('Usage: /task <title>');
            if (!workspaceId) fail('Open a workspace first.');
            const payload = channelId
                ? { title, workspaceId, assignmentType: 'channel', channelId, visibility: 'channel', status: 'todo', priority: 'medium' }
                : { title, workspaceId, assignmentType: 'self', status: 'todo', priority: 'medium' };
            let task;
            try {
                const { data } = await api.post('/api/v2/tasks', payload);
                task = data?.task || data?.tasks?.[0] || {};
            } catch (err) {
                fail(err?.response?.data?.message || 'Could not create the task.');
            }
            if (channelId) await send(`📋 New task${task.issueKey ? ` **${task.issueKey}**` : ''}: ${esc(task.title || title)}`);
            notify?.(`Task created${task.issueKey ? ` (${task.issueKey})` : ''}`, 'success');
            return;
        }

        case 'gmeet': {
            const link = String(args || '').trim();
            // A pasted Meet link is checked and shared as is; otherwise a real one is created.
            if (/^https?:\/\//.test(link)) {
                if (!MEET_LINK.test(link)) fail('That is not a Google Meet link (https://meet.google.com/abc-defg-hij).');
                await send(`🎥 **Google Meet**\n[Join the meeting](${link})`);
                return;
            }
            if (!workspaceId) fail('Open a workspace first.');
            const status = await isConnected('google_meet', workspaceId);
            if (!status.connected) fail('Google Meet isn’t connected, so Oruinwan can’t create a link. Paste one instead: /gmeet https://meet.google.com/abc-defg-hij');
            const res = await connectorAction('google_meet', 'meeting', workspaceId, { title: link || 'Quick sync' }, 'POST');
            const m = res?.meeting || {};
            if (!m.joinUrl) fail('Google did not return a Meet link.');
            await send(`🎥 **Google Meet — ${esc(m.title || link || 'Quick sync')}**\n[Join the meeting](${m.joinUrl})`);
            return;
        }

        case 'gitlab':
        case 'bitbucket':
        case 'linear': {
            const spec = ISSUE_COMMANDS[name];
            const cmd = parseIssueArgs(name, args);
            if (cmd.error) fail(cmd.error);
            await requireConnected(name, workspaceId);
            const res = await connectorAction(name, 'issue', workspaceId, { [spec.field]: cmd.target, title: cmd.title }, 'POST');
            const issue = res?.issue || {};
            const ref = issue.key || `${issue.repo || cmd.target}${issue.number ? `#${issue.number}` : ''}`;
            await send(`🎫 Opened ${spec.label} issue ${issue.url ? `[${ref}](${issue.url})` : ref}: **${esc(issue.title || cmd.title)}**`);
            notify?.(`${ref} created`, 'success');
            return;
        }

        default: {
            const type = PICKER_COMMANDS[name];
            if (!type || !PICKER_TYPES.includes(type)) fail('Unknown command.');
            await requireConnected(type, workspaceId);
            const item = await openCloudPicker({ type, workspaceId, initialQuery: String(args || '').trim(), mode: 'message' });
            if (!item) return;
            if (!item.url) fail('That item has no link to share.');
            await send(itemMarkdown(type, item));
            return;
        }
    }
}
