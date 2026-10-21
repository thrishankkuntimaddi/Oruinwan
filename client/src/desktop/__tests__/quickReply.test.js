import { describe, it, expect, vi } from 'vitest';
import { normalizeReply, sendQuickReply, installQuickReply } from '../quickReply';

const encrypted = { ciphertext: 'Y2lwaGVy', messageIv: 'aXY=', isEncrypted: true };

function deps() {
    return {
        encrypt: vi.fn().mockResolvedValue(encrypted),
        post: vi.fn().mockResolvedValue({ data: { message: { _id: 'm1' } } }),
    };
}

function fakeElectron() {
    let listener = null;
    return {
        onQuickReply: vi.fn((cb) => { listener = cb; return () => { listener = null; }; }),
        quickReplyFailed: vi.fn(),
        emit: (reply) => listener && listener(reply),
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('normalizeReply', () => {
    it('accepts a channel or DM reply and trims the text', () => {
        expect(normalizeReply({ workspaceId: 'w1', channelId: 'c1', text: '  hi  ' }))
            .toEqual({ workspaceId: 'w1', channelId: 'c1', text: 'hi' });
        expect(normalizeReply({ workspaceId: 'w1', dmSessionId: 'd1', text: 'yo' }))
            .toEqual({ workspaceId: 'w1', dmSessionId: 'd1', text: 'yo' });
    });

    it('rejects unsafe ids, blank text and missing conversations', () => {
        expect(normalizeReply({ workspaceId: '../x', channelId: 'c1', text: 'hi' })).toBeNull();
        expect(normalizeReply({ workspaceId: 'w1', channelId: 'c/1', text: 'hi' })).toBeNull();
        expect(normalizeReply({ workspaceId: 'w1', channelId: 'c1', text: '   ' })).toBeNull();
        expect(normalizeReply({ workspaceId: 'w1', text: 'hi' })).toBeNull();
        expect(normalizeReply(null)).toBeNull();
    });

    it('caps the text length', () => {
        expect(normalizeReply({ workspaceId: 'w1', channelId: 'c1', text: 'a'.repeat(5000) }).text).toHaveLength(4000);
    });
});

describe('sendQuickReply', () => {
    it('encrypts a channel reply and posts only ciphertext', async () => {
        const d = deps();
        await expect(sendQuickReply({ workspaceId: 'w1', channelId: 'c1', text: 'secret words' }, d)).resolves.toBe(true);
        expect(d.encrypt).toHaveBeenCalledWith('secret words', 'c1', 'channel', null);
        const [url, body] = d.post.mock.calls[0];
        expect(url).toBe('/api/v2/messages/channel');
        expect(body).toMatchObject({ channelId: 'c1', ciphertext: 'Y2lwaGVy', messageIv: 'aXY=', isEncrypted: true });
        expect(JSON.stringify(body)).not.toContain('secret words');
    });

    it('encrypts a DM reply for the dm conversation', async () => {
        const d = deps();
        await sendQuickReply({ workspaceId: 'w1', dmSessionId: 'd1', text: 'hey' }, d);
        expect(d.encrypt).toHaveBeenCalledWith('hey', 'd1', 'dm', null);
        expect(d.post).toHaveBeenCalledWith('/api/v2/messages/direct',
            expect.objectContaining({ dmSessionId: 'd1', workspaceId: 'w1', isEncrypted: true }));
    });

    it('never posts when encryption fails', async () => {
        const d = deps();
        d.encrypt.mockRejectedValue(new Error('not initialized'));
        await expect(sendQuickReply({ workspaceId: 'w1', channelId: 'c1', text: 'hi' }, d)).rejects.toThrow();
        expect(d.post).not.toHaveBeenCalled();
    });

    it('never posts an empty ciphertext', async () => {
        const d = deps();
        d.encrypt.mockResolvedValue({});
        await expect(sendQuickReply({ workspaceId: 'w1', channelId: 'c1', text: 'hi' }, d)).rejects.toThrow();
        expect(d.post).not.toHaveBeenCalled();
    });
});

describe('installQuickReply', () => {
    it('does nothing outside the desktop app', () => {
        expect(installQuickReply(undefined)).toBeNull();
        expect(installQuickReply({})).toBeNull();
    });

    it('sends replies from the desktop app', async () => {
        const d = deps();
        const electron = fakeElectron();
        installQuickReply(electron, d);
        electron.emit({ workspaceId: 'w1', channelId: 'c1', text: 'one' });
        electron.emit({ workspaceId: 'w1', channelId: 'c1', text: 'two' });
        await flush();
        await flush();
        expect(d.encrypt.mock.calls.map((c) => c[0])).toEqual(['one', 'two']);
        expect(electron.quickReplyFailed).not.toHaveBeenCalled();
    });

    it('opens the conversation when a reply cannot be sent', async () => {
        const d = deps();
        d.encrypt.mockRejectedValue(new Error('locked'));
        const electron = fakeElectron();
        installQuickReply(electron, d);
        const reply = { workspaceId: 'w1', dmSessionId: 'd1', text: 'hi' };
        electron.emit(reply);
        await flush();
        expect(electron.quickReplyFailed).toHaveBeenCalledWith(reply);
    });
});
