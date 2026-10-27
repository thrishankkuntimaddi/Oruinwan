import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineSquareCropTests } from '../../../../platform/media/squareCrop.cases.js';

const store = vi.hoisted(() => new Map());
vi.mock('../../native/storage.js', () => ({ prefs: { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v) } }));
const { quickJumpItems, togglePin, useQuickJump, setQuickJump, MAX_PINS } = await import('./quickJump.js');

defineSquareCropTests({ describe, it, expect });

const recent = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ kind: 'dm', item: { id } }));

describe('Quick jump', () => {
  beforeEach(() => setQuickJump(null));

  it('shows more than five recent chats, pins first', () => {
    expect(quickJumpItems(null, recent).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    togglePin({ kind: 'dm', id: 'f' });
    togglePin({ kind: 'channel', id: 'ch1' });
    const row = quickJumpItems(useQuickJump.getState().items, recent);
    expect(row.slice(0, 2)).toEqual([{ kind: 'dm', id: 'f', pinned: true }, { kind: 'channel', id: 'ch1', pinned: true }]);
    expect(row.filter((x) => x.id === 'f')).toHaveLength(1);
  });

  it('long-press again unpins; pins are capped', () => {
    expect(togglePin({ kind: 'dm', id: 'a' })).toBe('pinned');
    expect(togglePin({ kind: 'dm', id: 'a' })).toBe('unpinned');
    for (let i = 0; i < MAX_PINS; i += 1) togglePin({ kind: 'dm', id: `p${i}` });
    expect(togglePin({ kind: 'dm', id: 'one-more' })).toBe('full');
  });
});
