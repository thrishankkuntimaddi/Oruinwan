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
});
