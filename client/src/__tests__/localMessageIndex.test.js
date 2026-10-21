import { describe, it, expect, beforeEach } from 'vitest';
import { indexConversation, searchLocalMessages, clearLocalMessageIndex } from '../utils/localMessageIndex';

describe('local message index', () => {
    beforeEach(() => clearLocalMessageIndex());

    it('finds decrypted messages by text, scoped to the workspace, newest first', () => {
        indexConversation({ id: 'c1', type: 'channel', name: 'general', workspaceId: 'w1' }, [
            { id: 'm1', decryptedContent: 'Quarterly budget draft', sender: { _id: 'u1', username: 'alice' }, createdAt: '2026-01-01' },
            { id: 'm2', decryptedContent: 'Budget approved!', sender: { _id: 'u2', username: 'bob' }, createdAt: '2026-02-01' },
            { id: 'm3', decryptedContent: '🔒 Encrypted message', createdAt: '2026-03-01' },
        ]);
        indexConversation({ id: 'd1', type: 'dm', name: 'bob', workspaceId: 'w2' }, [
            { id: 'm4', decryptedContent: 'budget in the other workspace', createdAt: '2026-04-01' },
        ]);
        const hits = searchLocalMessages('budget', 'w1');
        expect(hits.map(h => h._id)).toEqual(['m2', 'm1']);
        expect(hits[0]).toMatchObject({ type: 'message', channelId: 'c1', channelName: 'general', _local: true });
        expect(searchLocalMessages('encrypted', 'w1')).toEqual([]); // placeholders are not indexed
    });

    it('links DM results to the DM and drops deleted or temporary messages', () => {
        indexConversation({ id: 'd1', type: 'dm', name: 'alice', workspaceId: 'w1' }, [
            { id: 'temp_1', decryptedContent: 'lunch?' },
            { id: 'm5', decryptedContent: 'lunch at noon' },
        ]);
        expect(searchLocalMessages('lunch', 'w1')).toEqual([expect.objectContaining({ _id: 'm5', dmId: 'd1', dmName: 'alice' })]);
        indexConversation({ id: 'd1', type: 'dm' }, [{ id: 'm5', decryptedContent: 'lunch at noon', isDeleted: true }]);
        expect(searchLocalMessages('lunch', 'w1')).toEqual([]);
    });

    it('answers operator queries: from:, in:, dates, has:, is:', () => {
        indexConversation({ id: 'c1', type: 'channel', name: 'general', workspaceId: 'w1' }, [
            { id: 'a', decryptedContent: 'see https://x.io', sender: { _id: 'u1', username: 'alice' }, createdAt: '2026-01-05T12:00:00' },
            { id: 'b', payload: { decryptedContent: 'pinned note', isPinned: true, replyCount: 2 }, sender: { _id: 'u2', username: 'bob' }, createdAt: '2026-02-05T12:00:00' },
            { id: 'c', decryptedContent: '', payload: { attachments: [{ name: 'shot.png', mimeType: 'image/png' }] }, sender: { _id: 'u2', username: 'bob' }, createdAt: '2026-03-05T12:00:00' },
        ]);
        indexConversation({ id: 'c2', type: 'channel', name: 'random', workspaceId: 'w1' }, [
            { id: 'd', decryptedContent: 'note from random', sender: { _id: 'u1', username: 'alice' }, createdAt: '2026-02-06T12:00:00' },
        ]);
        const ids = (q) => searchLocalMessages(q, 'w1').map(h => h._id);
        expect(ids('from:@alice')).toEqual(['d', 'a']);
        expect(ids('note in:#general')).toEqual(['b']);
        expect(ids('after:2026-01-31 before:2026-03-01')).toEqual(['d', 'b']);
        expect(ids('on:2026-01-05')).toEqual(['a']);
        expect(ids('has:link')).toEqual(['a']);
        expect(ids('has:image')).toEqual(['c']);
        expect(ids('shot')).toEqual(['c']);
        expect(ids('is:pinned')).toEqual(['b']);
        expect(ids('is:thread from:@bob')).toEqual(['b']);
        expect(ids('type:task note')).toEqual([]);
        expect(ids('type:message')).toEqual([]); // no criteria besides the type
    });
});
