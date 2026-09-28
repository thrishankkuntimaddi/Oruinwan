// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('../services/api', () => ({ default: apiMock }));

import { runIntegrationCommand } from '../features/integrations/slashActions';
import { clearConnectionCache } from '../features/integrations/integrationsApi';
import { CODE_REVIEW_EVENT } from '../features/integrations/codeReviewBus';

const ctx = (over = {}) => ({ workspaceId: 'ws1', conversationId: 'c1', conversationType: 'channel', send: vi.fn(), notify: vi.fn(), ...over });

describe('integration slash commands', () => {
    beforeEach(() => { vi.clearAllMocks(); clearConnectionCache(); });

    it('explains when GitHub is not connected', async () => {
        apiMock.get.mockResolvedValue({ data: { connected: false, config: {} } });
        const c = ctx();
        await expect(runIntegrationCommand('github', 'issue Login broken', c)).rejects.toThrow(/GitHub isn't connected.*Settings → Integrations/);
        expect(c.send).not.toHaveBeenCalled();
    });

    it('creates an issue in the repo routed to this channel and posts it', async () => {
        apiMock.get.mockResolvedValue({ data: { connected: true, config: { routes: [{ repo: 'acme/web', channelId: 'c1' }] } } });
        apiMock.post.mockResolvedValue({ data: { issue: { number: 7, url: 'https://github.com/acme/web/issues/7', title: 'Login broken' } } });
        const c = ctx();
        await runIntegrationCommand('github', 'issue Login broken', c);
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/integrations/github/issue', { workspaceId: 'ws1', repo: 'acme/web', title: 'Login broken', body: '' });
        expect(c.send.mock.calls[0][0]).toContain('[acme/web#7](https://github.com/acme/web/issues/7)');
    });

    it('/review asks the conversation window for the panel', async () => {
        const seen = [];
        const onOpen = (e) => { seen.push(e.detail); e.detail.handled = true; };
        window.addEventListener(CODE_REVIEW_EVENT, onOpen);
        await runIntegrationCommand('review', 'https://github.com/acme/web/pull/128', ctx());
        window.removeEventListener(CODE_REVIEW_EVENT, onOpen);
        expect(seen[0]).toMatchObject({ repo: 'acme/web', number: 128, workspaceId: 'ws1' });
        await expect(runIntegrationCommand('review', 'nonsense', ctx())).rejects.toThrow(/Usage/);
    });

    it('/jira and /zoom post their links; /task creates a channel task', async () => {
        apiMock.get.mockResolvedValue({ data: { connected: true, config: {} } });
        apiMock.post.mockImplementation(async (url) => {
            if (url.endsWith('/jira/issue')) return { data: { key: 'WEB-9', url: 'https://acme.atlassian.net/browse/WEB-9' } };
            if (url.endsWith('/zoom/meeting')) return { data: { joinUrl: 'https://zoom.us/j/1', topic: 'Sync' } };
            return { data: { task: { title: 'Ship it', issueKey: 'T-3' } } };
        });
        const c = ctx();
        await runIntegrationCommand('jira', 'web Fix redirect', c);
        await runIntegrationCommand('zoom', 'Sync', c);
        await runIntegrationCommand('task', 'Ship it', c);
        expect(c.send.mock.calls.map((x) => x[0]).join('\n')).toMatch(/\[WEB-9\]\(https:\/\/acme.atlassian.net\/browse\/WEB-9\)[\s\S]*zoom\.us\/j\/1[\s\S]*T-3/);
        expect(apiMock.post).toHaveBeenCalledWith('/api/v2/tasks', expect.objectContaining({ assignmentType: 'channel', channelId: 'c1', title: 'Ship it' }));
    });
});
