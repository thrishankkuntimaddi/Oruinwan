// A small stale-while-revalidate cache. Screens call useQuery(key, fetcher); mutations
// patch data optimistically with setQueryData and refresh with invalidate.
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

const entries = new Map();
const listeners = new Map();
const EMPTY = Object.freeze({ status: 'idle', data: undefined, error: null, updatedAt: 0 });

function read(key) {
  return entries.get(key) || EMPTY;
}

function write(key, patch) {
  const next = { ...read(key), ...patch };
  entries.set(key, next);
  listeners.get(key)?.forEach((fn) => fn());
  return next;
}

const inflight = new Map();
const fetchers = new Map();

export function fetchQuery(key, fetcher) {
  if (fetcher) fetchers.set(key, fetcher);
  const fn = fetchers.get(key);
  if (!fn) return Promise.resolve(read(key).data);
  if (inflight.has(key)) return inflight.get(key);
  const hasData = read(key).data !== undefined;
  write(key, { status: hasData ? 'refreshing' : 'loading', error: null });
  const p = Promise.resolve()
    .then(fn)
    .then(
      (data) => {
        write(key, { data, status: 'success', updatedAt: Date.now(), error: null });
        return data;
      },
      (error) => {
        write(key, { status: 'error', error });
        return read(key).data;
      },
    )
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function useQuery(key, fetcher, { staleMs = 20_000, enabled = true } = {}) {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const subscribe = useCallback(
    (cb) => {
      if (!key) return () => {};
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(cb);
      return () => listeners.get(key)?.delete(cb);
    },
    [key],
  );
  const snap = useSyncExternalStore(subscribe, () => (key ? read(key) : EMPTY));

  useEffect(() => {
    if (!key || !enabled) return;
    fetchers.set(key, () => fetcherRef.current());
    const e = read(key);
    if (e.data === undefined || Date.now() - e.updatedAt > staleMs) fetchQuery(key);
  }, [key, enabled, staleMs]);

  const refetch = useCallback(() => (key ? fetchQuery(key, () => fetcherRef.current()) : Promise.resolve()), [key]);

  return {
    data: snap.data,
    error: snap.error,
    status: snap.status,
    loading: snap.status === 'loading' && snap.data === undefined,
    refreshing: snap.status === 'refreshing',
    refetch,
  };
}

/** Optimistically replace cached data. updater receives the current value. */
export function setQueryData(key, updater) {
  const current = read(key).data;
  const data = typeof updater === 'function' ? updater(current) : updater;
  write(key, { data, updatedAt: Date.now() });
  return current;
}

export function getQueryData(key) {
  return read(key).data;
}

/** Refetch every cached query whose key starts with one of the prefixes. */
export function invalidate(...prefixes) {
  for (const key of entries.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) {
      if (listeners.get(key)?.size) fetchQuery(key);
      else write(key, { updatedAt: 0 });
    }
  }
}

export function clearQueries() {
  entries.clear();
  inflight.clear();
  fetchers.clear();
  for (const set of listeners.values()) set.forEach((fn) => fn());
}
