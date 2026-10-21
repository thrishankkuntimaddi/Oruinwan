import { describe, it, expect, beforeEach, vi } from 'vitest';

const emitted = [];
vi.mock('./realtime.js', () => ({ socketEmit: (event, payload) => emitted.push({ event, payload }) }));
vi.mock('../../native/index.js', () => ({ onAppState: () => Promise.resolve(() => {}) }));

const { currentViewing, pushViewing, _resetViewing } = await import('./viewing.js');

describe('what the phone tells the server it shows', () => {
  beforeEach(() => {
    _resetViewing();
    emitted.length = 0;
  });

  it('the open conversation, then the thread over it, then back', () => {
    const leaveChat = pushViewing({ kind: 'dm', id: 'd1' });
    expect(currentViewing()).toMatchObject({ conversationType: 'dm', conversationId: 'd1', threadId: null, client: 'mobile', visible: true });
    const leaveThread = pushViewing({ kind: 'dm', id: 'd1', threadId: 'p1' });
    // The thread screen covers the conversation.
    expect(currentViewing()).toMatchObject({ conversationId: null, threadId: 'p1' });
    leaveThread();
    expect(currentViewing()).toMatchObject({ conversationId: 'd1', threadId: null });
    leaveChat();
    expect(currentViewing()).toMatchObject({ conversationId: null, threadId: null });
    expect(emitted.every((e) => e.event === 'presence:viewing')).toBe(true);
    expect(emitted).toHaveLength(4);
  });
});
