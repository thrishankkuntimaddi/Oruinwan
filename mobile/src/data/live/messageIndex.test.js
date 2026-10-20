import { beforeEach, describe, expect, it } from 'vitest';
import { clearMessageIndex, indexMessages, nameConversation, searchIndex, unloaded } from './messageIndex.js';

const msg = (id, text, at, extra = {}) => ({ id, text, authorId: 'u1', at, state: 'ok', ...extra });

beforeEach(() => clearMessageIndex());

describe('phone message index', () => {
  it('finds messages by every word, newest first, with the conversation name', () => {
    nameConversation('c1', { kind: 'channel', name: '#general', ws: 'ws1' });
    indexMessages({ id: 'c1', kind: 'channel' }, [
      msg('m1', 'Launch plan for Friday', '2026-10-18T10:00:00Z'),
      msg('m2', 'Friday launch moved', '2026-10-19T10:00:00Z'),
      msg('m3', 'lunch?', '2026-10-19T11:00:00Z'),
    ]);
    const hits = searchIndex('ws1', 'friday launch');
    expect(hits.map((h) => h.id)).toEqual(['m2', 'm1']);
    expect(hits[0]).toMatchObject({ convId: 'c1', convKind: 'channel', convName: '#general' });
  });

  it('skips messages that could not be decrypted and other workspaces', () => {
    nameConversation('c1', { kind: 'channel', name: '#a', ws: 'ws1' });
    nameConversation('c2', { kind: 'channel', name: '#b', ws: 'ws2' });
    indexMessages({ id: 'c1', kind: 'channel' }, [msg('m1', 'secret', 'x', { state: 'locked' })]);
    indexMessages({ id: 'c2', kind: 'channel' }, [msg('m2', 'secret', '2026-10-19T10:00:00Z')]);
    expect(searchIndex('ws1', 'secret')).toEqual([]);
  });

  it('knows which conversations still need fetching', () => {
    indexMessages({ id: 'c1', kind: 'channel' }, [], { complete: true });
    expect(unloaded('ws1', [{ id: 'c1' }, { id: 'c2' }]).map((c) => c.id)).toEqual(['c2']);
  });
});
