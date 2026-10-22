// The web app's address, for links that open a web page (change password, docs, support).
// The API can live on its own domain (api.example.com) that serves no web pages, so the app
// asks the server (/api/health → webUrl, its FRONTEND_URL) and remembers the answer.
import { useEffect } from 'react';
import { create } from 'zustand';
import { prefs } from '../../native/storage.js';
import { probeServer } from './server.js';

/** Best guess before the server answers: "https://api.x.com" → "https://x.com". */
export function guessWebUrl(server) {
  if (!server) return '';
  try {
    const u = new URL(server);
    if (u.hostname.startsWith('api.')) u.hostname = u.hostname.slice(4);
    return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return server;
  }
}

const cacheKey = (server) => `web.url:${server}`;
const asked = new Set();

export const useWebUrlStore = create(() => ({ byServer: {} }));

function remember(server, url) {
  useWebUrlStore.setState((s) => ({ byServer: { ...s.byServer, [server]: url } }));
}

/** Ask the server once per launch; keeps the cached or guessed address if it can't answer. */
export async function loadWebUrl(server, probe = probeServer) {
  if (!server || asked.has(server)) return;
  asked.add(server);
  try {
    const cached = prefs.get(cacheKey(server));
    if (typeof cached === 'string' && cached) remember(server, cached);
  } catch { /* storage not ready */ }
  const result = await probe(server).catch(() => null);
  const url = result?.state === 'ok' && typeof result.info?.webUrl === 'string' ? result.info.webUrl.replace(/\/+$/, '') : '';
  if (/^https?:\/\//.test(url)) {
    remember(server, url);
    try { prefs.set(cacheKey(server), url); } catch { /* ignore */ }
  }
}

/** The web app address for a server: what the server said, else a guess. */
export function webUrlFor(server) {
  return useWebUrlStore.getState().byServer[server] || guessWebUrl(server);
}

export function useWebUrl(server) {
  const known = useWebUrlStore((s) => s.byServer[server]);
  useEffect(() => { loadWebUrl(server); }, [server]);
  return known || guessWebUrl(server);
}

export function resetWebUrlCache() {
  asked.clear();
  useWebUrlStore.setState({ byServer: {} });
}
