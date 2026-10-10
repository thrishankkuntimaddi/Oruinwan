import { demoAdapter } from './adapter.js';

describe('demo adapter', () => {
  beforeEach(async () => {
    localStorage.clear();
    await demoAdapter.resetDemo();
  });

  it('lists a workspace with channels and DMs', async () => {
    const ws = (await demoAdapter.workspaces())[0];
    const channels = await demoAdapter.channels(ws.id);
    const dms = await demoAdapter.dms(ws.id);
    expect(channels.length).toBeGreaterThan(3);
    expect(dms.every((d) => d.user && d.user.id !== 'me')).toBe(true);
  });

  it('enforces the server task workflow', async () => {
    // t5 is done; done → review is not an allowed move.
    await expect(demoAdapter.updateTask('t5', { status: 'review' })).rejects.toThrow(/can't move/);
    const t = await demoAdapter.updateTask('t5', { status: 'in_progress' });
    expect(t.status).toBe('in_progress');
  });

  it('sends a message and clears unread on read', async () => {
    const conv = { kind: 'channel', id: 'c-eng' };
    const sent = await demoAdapter.sendMessage(conv, 'hello');
    const { items } = await demoAdapter.messages(conv);
    expect(items.at(-1).id).toBe(sent.id);
    await demoAdapter.markRead(conv);
    const ch = await demoAdapter.channel('c-eng');
    expect(ch.unread).toBe(0);
  });

  it('maps notification actors to user ids', async () => {
    const list = await demoAdapter.notifications('ws-product');
    expect(list[0].actorId).toBeTruthy();
    expect(list[0].actor).toBeUndefined();
  });
});
