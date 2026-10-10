// Server address handling for self-hosted installs.

const IP_OR_LOCAL = /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?(\/|$)/i;

/**
 * "chat.example.com"        → "https://chat.example.com"
 * "100.70.1.2:8080"         → "http://100.70.1.2:8080"   (LAN/Tailscale addresses rarely have TLS)
 * "https://x.com/api/"      → "https://x.com"
 */
export function normalizeServerUrl(input) {
  let v = String(input || '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `${IP_OR_LOCAL.test(v) ? 'http' : 'https'}://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname) return '';
    let path = u.pathname.replace(/\/+$/, '');
    if (path.endsWith('/api')) path = path.slice(0, -4);
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return '';
  }
}

export async function probeServer(base, { timeoutMs = 6000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/health`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON */
    }
    if (res.ok && body && (body.status === 'healthy' || body.status === 'ok' || body.mongodb !== undefined)) {
      return { state: 'ok', insecure: base.startsWith('http://'), info: body };
    }
    if (res.status === 503) return { state: 'error', message: 'The server is up but not healthy right now.' };
    return { state: 'error', message: "That address doesn't look like an Oruinwan server." };
  } catch (err) {
    return {
      state: 'error',
      message: err?.name === 'AbortError' ? 'The server took too long to answer.' : "Can't reach that address. Check it and your connection.",
    };
  } finally {
    clearTimeout(timer);
  }
}
