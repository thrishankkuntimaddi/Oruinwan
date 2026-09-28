import api from '../../services/api';
import { parseGithubArgs, parseJiraArgs, parsePrRef, defaultRepoForChannel } from './prRefs';
import {
    isConnected, notConnectedMessage, createGithubIssue, getPullRequest, createJiraIssue, createZoomMeeting,
} from './integrationsApi';
import { openCodeReview } from './codeReviewBus';

// Slash commands that talk to integrations (and /task). The composer calls
// runIntegrationCommand() and shows `error` if it throws.

export const INTEGRATION_COMMANDS = new Set(['github', 'jira', 'zoom', 'review', 'task']);

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

        default:
            fail('Unknown command.');
    }
}
