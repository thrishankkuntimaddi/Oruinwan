// A realtime refresh that arrives while a fetch is running must not be lost: the running fetch
// may have been answered before the change, and its result would overwrite newer data.
import { vi, it, expect } from 'vitest';
import { fetchQuery, getQueryData, invalidate, setQueryData } from './query.js';

it('fetches again when invalidated during a fetch', async () => {
  let n = 0;
  const releases = [];
  const fetcher = vi.fn(() => new Promise((r) => releases.push(() => r(++n))));
  const first = fetchQuery('k', fetcher);
  setQueryData('k', 'optimistic');
  invalidate('k'); // during the fetch
  await vi.waitFor(() => expect(releases).toHaveLength(1));
  releases[0]();
  await first;
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(releases).toHaveLength(2));
  releases[1]();
  await vi.waitFor(() => expect(getQueryData('k')).toBe(2));
});
