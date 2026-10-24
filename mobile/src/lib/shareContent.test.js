import { describe, expect, it } from 'vitest';
import {
  messageLink, messageShareText, parseConversationLink, shareableBody, threadLink, threadTitle, threadTranscript,
} from './shareContent.js';

const base = 'https://chat.example.com';

describe('links', () => {
  it('links a message, a thread reply and a thread', () => {
    expect(messageLink({ base, workspaceId: 'w', kind: 'channel', conversationId: 'c', message: { id: 'm' } })).toBe(`${base}/workspace/w/channel/c?message=m`);
    expect(messageLink({ base, workspaceId: 'w', kind: 'dm', conversationId: 'd', message: { id: 'r', parentId: 'p' } })).toBe(`${base}/workspace/w/dm/d?message=r&thread=p`);
    expect(threadLink({ base: `${base}/`, workspaceId: 'w', kind: 'channel', conversationId: 'c', parentId: 'p' })).toBe(`${base}/workspace/w/channel/c?thread=p`);
    expect(threadLink({ base, workspaceId: null, kind: 'channel', conversationId: 'c', parentId: 'p' })).toBeNull();
  });

  it('reads the links back (https and oruinwan://)', () => {
    expect(parseConversationLink(`${base}/workspace/w/dm/d?message=r&thread=p`)).toEqual({ workspaceId: 'w', kind: 'dm', id: 'd', messageId: 'r', threadId: 'p' });
    expect(parseConversationLink('oruinwan://workspace/w/channel/c?thread=p')).toEqual({ workspaceId: 'w', kind: 'channel', id: 'c', messageId: null, threadId: 'p' });
    expect(parseConversationLink(`${base}/workspace/w/home/channel/c`)).toMatchObject({ kind: 'channel', id: 'c' });
  });

  it('ignores other links', () => {
    expect(parseConversationLink(`${base}/join-workspace?token=abc`)).toBeNull();
    expect(parseConversationLink(`${base}/workspace/w/agents`)).toBeNull();
    expect(parseConversationLink('not a url')).toBeNull();
  });
});

describe('shared text', () => {
  it('is "sender: text" plus the link, with attachment names', () => {
    const m = { id: 'm', state: 'ok', text: 'Here', attachments: [{ name: 'plan.pdf', url: '/api/v2/uploads/file?path=x' }] };
    expect(messageShareText({ sender: 'Ana', body: shareableBody(m), link: 'L' })).toBe('Ana: Here\n📎 plan.pdf\n\nL');
  });

  it("doesn't share a message that couldn't be decrypted", () => {
    expect(shareableBody({ state: 'locked', text: 'x' })).toBe('');
    expect(messageShareText({ sender: 'Ana', body: '', link: 'L' })).toBe('L');
  });
});

describe('threadTranscript', () => {
  it('lists the parent and replies as "[time] sender: text" under a title, then the link', () => {
    const out = threadTranscript({
      title: threadTitle('dm', 'Ana'),
      messages: [
        { sender: 'Ana', text: 'Lunch?', at: '2026-10-24T12:00:00Z' },
        { sender: 'Me', text: 'Sure', at: '2026-10-24T12:05:00Z' },
        { sender: 'Ana', text: '' },
      ],
      link: 'L',
      stamp: (at) => new Date(at).toISOString().slice(11, 16),
    });
    expect(out).toBe('Thread with Ana\n[12:00] Ana: Lunch?\n[12:05] Me: Sure\n\nL');
  });

  it('titles channel threads', () => {
    expect(threadTitle('channel', '#general')).toBe('Thread in #general');
    expect(threadTitle('channel', '')).toBe('Thread');
  });
});
