// Release flags of the Oruinwan server the app talks to (GET /api/flags,
// server/src/shared/featureFlags). They hide whole areas the server has switched
// off (planning, design reviews, company sign-up). Unlike config/flags.js these
// come from the server, not from the app build or Firebase.
import { create } from 'zustand';
import { prefs } from '../native/storage.js';

const CACHE_KEY = 'flags.server';

function sanitize(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input)) if (typeof v === 'boolean') out[k] = v;
  return out;
}

export const useServerFlags = create((set) => ({
  // Last known values, so a cold start shows the right tabs before the network answers.
  flags: sanitize(prefs.get(CACHE_KEY)),
  setFlags(next) {
    const clean = sanitize(next);
    prefs.set(CACHE_KEY, clean);
    set({ flags: clean });
  },
}));

/** True only when the server reports the flag on (unknown or not loaded yet → off). */
export const useServerFlag = (name) => useServerFlags((s) => s.flags[name] === true);

/** Fetches the flags from `baseUrl` and stores them. Failures keep the cached values. */
export async function refreshServerFlags(baseUrl, fetchImpl = globalThis.fetch) {
  if (!baseUrl || typeof fetchImpl !== 'function') return null;
  try {
    const res = await fetchImpl(`${baseUrl}/api/flags`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.flags) return null;
    useServerFlags.getState().setFlags(data.flags);
    return useServerFlags.getState().flags;
  } catch {
    return null;
  }
}
