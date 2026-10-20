import { describe, expect, it } from 'vitest';
import { indexConversation, searchLocalMessages, clearLocalMessageIndex } from '../utils/localMessageIndex';
import { lastReplyLabel } from '../features/messaging/chatWindowComp/messages/ThreadSummaryLink';

describe('thread replies', () => {
    it('are found by search and point back to their thread', () => {
        clearLocalMessageIndex();
        indexConversation({ id: 'c1', type: 'channel', name: 'general', workspaceId: 'w1' }, [
            { id: 'r1', parentId: 'p1', decryptedContent: 'the launch moves to Friday', createdAt: '2026-10-20T10:00:00Z' },
            { id: 'm1', decryptedContent: 'launch checklist', createdAt: '2026-10-20T09:00:00Z' },
        ]);
        const hits = searchLocalMessages('launch', 'w1');
        expect(hits.map((h) => [h.id, h.threadParentId || null])).toEqual([['r1', 'p1'], ['m1', null]]);
        expect(hits[0]).toMatchObject({ channelId: 'c1', channelName: 'general' });
    });

    it('say when the last reply was, not always "today"', () => {
        const now = new Date();
        expect(lastReplyLabel(now.toISOString())).toMatch(/^today at /);
        const yesterday = new Date(now.getTime() - 24 * 3600e3);
        expect(lastReplyLabel(yesterday.toISOString())).toMatch(/^yesterday at /);
        const older = new Date(now.getTime() - 10 * 24 * 3600e3);
        expect(lastReplyLabel(older.toISOString())).not.toMatch(/today|yesterday/);
        expect(lastReplyLabel(null)).toBe('');
    });
});
