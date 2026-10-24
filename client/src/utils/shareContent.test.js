import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    conversationLink, messageLink, threadLink, shareableBody, senderOf, messageShareText,
    threadTranscript, threadTitle, webBase, shareOrCopy,
} from './shareContent';

const base = 'https://chat.example.com';

describe('links', () => {
    it('links a channel message with ?message=', () => {
        expect(messageLink({ base, workspaceId: 'w1', kind: 'channel', conversationId: 'c1', message: { _id: 'm1' } }))
            .toBe('https://chat.example.com/workspace/w1/channel/c1?message=m1');
    });

    it('links a DM message and a thread reply (opens its thread too)', () => {
        expect(messageLink({ base, workspaceId: 'w1', kind: 'dm', conversationId: 'd1', message: { id: 'r1', parentId: 'p1' } }))
            .toBe('https://chat.example.com/workspace/w1/dm/d1?message=r1&thread=p1');
    });

    it('links a thread with ?thread=', () => {
        expect(threadLink({ base: `${base}/`, workspaceId: 'w1', kind: 'channel', conversationId: 'c1', parentId: 'p1' }))
            .toBe('https://chat.example.com/workspace/w1/channel/c1?thread=p1');
    });

    it('needs a workspace and a conversation', () => {
        expect(conversationLink({ base, workspaceId: null, kind: 'dm', conversationId: 'd1' })).toBeNull();
        expect(conversationLink({ base, workspaceId: 'w', kind: 'dm', conversationId: '' })).toBeNull();
    });

    it('uses the page origin in a browser and the configured server in the desktop app', () => {
        expect(webBase({ location: { protocol: 'https:', origin: 'https://web.example' }, appMode: false })).toBe('https://web.example');
        const app = webBase({ location: { protocol: 'app:', origin: 'app://oruinwan' }, appMode: true });
        expect(app).toMatch(/^https?:\/\//);
        expect(app).not.toContain('app://');
    });
});

describe('shared text', () => {
    it('is "sender: text" plus the link', () => {
        const msg = { senderName: 'Ana', decryptedContent: 'Ship it' };
        expect(messageShareText({ sender: senderOf(msg), body: shareableBody(msg), link: 'L' })).toBe('Ana: Ship it\n\nL');
    });

    it('names attachments instead of sharing their (private) addresses', () => {
        const body = shareableBody({ text: 'See this', attachments: [{ name: 'report.pdf', url: '/api/v2/uploads/file?path=x' }] });
        expect(body).toBe('See this\n📎 report.pdf');
        expect(body).not.toContain('/api/');
        expect(shareableBody({ payload: { attachments: [{ fileName: 'a.png' }] } })).toBe('📎 a.png');
    });

    it('falls back to "Someone" for an unknown sender', () => {
        expect(senderOf({})).toBe('Someone');
        expect(senderOf({ sender: { username: 'ben' } })).toBe('ben');
    });
});

describe('threadTranscript', () => {
    const stamp = (at) => `T${new Date(at).getUTCHours()}`;

    it('has a title, the parent and every reply with time and sender, then the link', () => {
        const out = threadTranscript({
            title: threadTitle('channel', 'general'),
            messages: [
                { sender: 'Ana', text: 'Release today?', at: '2026-10-24T09:00:00Z' },
                { sender: 'Ben', text: 'Yes\nafter lunch', at: '2026-10-24T10:00:00Z' },
                { sender: 'Cy', text: '', at: '2026-10-24T11:00:00Z' },
            ],
            link: 'https://x/workspace/w/channel/c?thread=p',
            stamp,
        });
        expect(out).toBe([
            'Thread in #general',
            '[T9] Ana: Release today?',
            '[T10] Ben: Yes\n    after lunch',
            '',
            'https://x/workspace/w/channel/c?thread=p',
        ].join('\n'));
    });

    it('titles DMs by the person', () => {
        expect(threadTitle('dm', 'Ana')).toBe('Thread with Ana');
        expect(threadTitle('channel', '#ops')).toBe('Thread in #ops');
        expect(threadTitle('dm', '')).toBe('Thread');
    });
});

describe('shareOrCopy', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('uses the share sheet when there is one', async () => {
        const share = vi.fn().mockResolvedValue();
        vi.stubGlobal('navigator', { share });
        expect(await shareOrCopy({ title: 't', text: 'hello', url: 'L' })).toBe('shared');
        expect(share).toHaveBeenCalledWith({ title: 't', text: 'hello\n\nL' });
    });

    it('copies when there is no share sheet', async () => {
        const writeText = vi.fn().mockResolvedValue();
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        expect(await shareOrCopy({ title: 't', text: 'hello', url: 'L' })).toBe('copied');
        expect(writeText).toHaveBeenCalledWith('hello\n\nL');
    });

    it('reports a cancelled share sheet', async () => {
        vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
        expect(await shareOrCopy({ text: 'a' })).toBe('cancelled');
    });
});
