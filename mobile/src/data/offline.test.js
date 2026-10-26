import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPersister, selectPersistable } from './persist.js';
import { getQueryData, hydrateQueries, clearQueries, setQueryData, snapshotQueries } from './query.js';
import { clearOutbox, enqueue, flush, persistable, sendItem, useOutbox } from './outbox.js';

function memoryStore() {
  const m = new Map();
  return {
    get: async (k) => m.get(k),
    set: async (k, v) => void m.set(k, v),
    del: async (k) => void m.delete(k),
    clear: async () => m.clear(),
    raw: m,
  };
}

describe('query cache on disk', () => {
  afterEach(() => clearQueries());

  it('keeps known lists and recent conversations, without unconfirmed messages', () => {
    const snap = [
      ['channels:w', { data: [1], updatedAt: 5 }],
      ['search:x', { data: [2], updatedAt: 5 }],
      ['messages:a', { data: { items: [{ id: 'm1' }, { id: 't', pending: true }, { id: 'q', queued: true }] }, updatedAt: 3 }],
      ['messages:b', { data: { items: [] }, updatedAt: 9 }],
      ['thread:c', { data: { items: [] }, updatedAt: 1 }],
    ];
    const out = selectPersistable(snap, { maxConversations: 2 });
    expect(out.map(([k]) => k)).toEqual(['channels:w', 'messages:b', 'messages:a']);
    expect(out[2][1].data.items).toEqual([{ id: 'm1' }]);
  });

  it('drops the oldest conversations to stay under the size budget', () => {
    const big = { items: Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, text: 'x'.repeat(100) })) };
    const snap = [
      ['tasks:w', { data: [1], updatedAt: 1 }],
      ['messages:new', { data: big, updatedAt: 9 }],
      ['messages:old', { data: big, updatedAt: 1 }],
    ];
    const out = selectPersistable(snap, { maxBytes: 8000 });
    expect(out.map(([k]) => k)).toEqual(['tasks:w', 'messages:new']);
  });

  it('encrypts snapshots, scopes them per account and reads them back', async () => {
    const store = memoryStore();
    const p = createPersister(store);
    expect(p.enabled()).toBe(true);
    await p.save('srv|u1', [['tasks:w', { data: [{ id: 't1', title: 'Secret plan' }], updatedAt: 7 }]]);
    const rec = store.raw.get('snap:srv|u1');
    expect(new TextDecoder().decode(new Uint8Array(rec.data))).not.toContain('Secret plan');
    expect(await p.load('srv|u1')).toEqual([['tasks:w', { data: [{ id: 't1', title: 'Secret plan' }], updatedAt: 7 }]]);
    expect(await p.load('srv|u2')).toBeNull();
    await p.clear();
    expect(await p.load('srv|u1')).toBeNull();
  });

  it('hydrates without overwriting fresher data', () => {
    setQueryData('tasks:w', ['fresh']);
    hydrateQueries([
      ['tasks:w', { data: ['old'], updatedAt: 1 }],
      ['notes:w', { data: ['saved'], updatedAt: 2 }],
    ]);
    expect(getQueryData('tasks:w')).toEqual(['fresh']);
    expect(getQueryData('notes:w')).toEqual(['saved']);
    expect(snapshotQueries().map(([k]) => k).sort()).toEqual(['notes:w', 'tasks:w']);
  });
});

describe('offline message queue', () => {
  const conv = { kind: 'channel', id: 'c1' };
  beforeEach(() => {
    clearOutbox();
    useOutbox.setState({ online: false, flushing: false });
  });

  it('queues while offline and sends in order when back', async () => {
    await enqueue({ conv, key: 'messages:c1', text: 'one' });
    await enqueue({ conv, key: 'messages:c1', text: 'two' });
    const items = useOutbox.getState().items;
    expect(items.map((i) => i.status)).toEqual(['queued', 'queued']);
    expect(items[0].id).not.toBe(items[1].id);
    const sent = [];
    useOutbox.setState({ online: true });
    await flush({ send: async (i) => sent.push(i.id) });
    expect(sent).toEqual(items.map((i) => i.id));
    expect(useOutbox.getState().items).toEqual([]);
  });

  it('stops at a connection failure and keeps the rest queued', async () => {
    await enqueue({ conv, key: 'messages:c1', text: 'one' });
    await enqueue({ conv, key: 'messages:c1', text: 'two' });
    useOutbox.setState({ online: true });
    const send = vi.fn(async () => {
      throw Object.assign(new Error('offline'), { network: true });
    });
    await flush({ send });
    expect(send).toHaveBeenCalledTimes(1);
    expect(useOutbox.getState().items.map((i) => i.status)).toEqual(['queued', 'queued']);
    expect(useOutbox.getState().online).toBe(false);
  });

  it('marks a refused message failed and continues', async () => {
    await enqueue({ conv, key: 'messages:c1', text: 'bad' });
    await enqueue({ conv, key: 'messages:c1', text: 'good' });
    const [bad] = useOutbox.getState().items;
    await flush({ send: async (i) => {
      if (i.id === bad.id) throw Object.assign(new Error('Too long'), { status: 400 });
    } });
    expect(useOutbox.getState().items).toMatchObject([{ id: bad.id, status: 'failed', error: 'Too long' }]);
  });

  it('saves only encrypted items, never their text', () => {
    const saved = persistable([
      { id: 'a', key: 'k', conv, prepared: { path: '/p', body: { ciphertext: 'zz' } }, status: 'sending', text: 'hello' },
      { id: 'b', key: 'k', conv, prepared: null, status: 'queued' },
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe('queued');
    expect(JSON.stringify(saved)).not.toContain('hello');
  });
});

describe('a queued message after the conversation key changed', () => {
  const conv = { kind: 'dm', id: 'g1' };
  const rotated = () => Object.assign(new Error('key changed'), { status: 409, code: 'KEY_ROTATED' });

  it('is encrypted again with the new key (text read back from the queued ciphertext) and sent once more', async () => {
    const sent = [];
    const a = {
      readPrepared: vi.fn(async () => 'hello'),
      prepareMessage: vi.fn(async (c, text) => ({ path: '/v2/messages/direct', body: { ciphertext: `v2(${text})`, keyVersion: 2 } })),
      sendPrepared: vi.fn(async (p) => {
        sent.push(p.body);
        if (p.body.keyVersion !== 2) throw rotated();
        return { _id: 'm1' };
      }),
    };
    const item = { id: 'q1', conv, prepared: { path: '/v2/messages/direct', body: { ciphertext: 'v1', keyVersion: 1 } } };
    await expect(sendItem(item, a)).resolves.toEqual({ _id: 'm1' });
    expect(sent).toEqual([{ ciphertext: 'v1', keyVersion: 1 }, { ciphertext: 'v2(hello)', keyVersion: 2 }]);
    expect(a.prepareMessage).toHaveBeenCalledWith(conv, 'hello', expect.objectContaining({ clientMessageId: 'q1' }));
  });

  it('other refusals are not retried', async () => {
    const a = { prepareMessage: vi.fn(), sendPrepared: vi.fn(async () => { throw Object.assign(new Error('no'), { status: 403 }); }) };
    await expect(sendItem({ id: 'q2', conv, prepared: { path: '/p', body: {} } }, a)).rejects.toMatchObject({ status: 403 });
    expect(a.prepareMessage).not.toHaveBeenCalled();
  });
});
