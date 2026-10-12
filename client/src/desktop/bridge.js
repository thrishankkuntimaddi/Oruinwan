/**
 * Oruinwan Desktop bridge.
 *
 * Runs only inside the Electron desktop app (window.electronAPI is exposed by
 * desktop/electron/preload.js). In a normal browser this module is a no-op.
 *
 * Exposes:
 *   window.chttrixDesktop.notify(payload)
 *     payload: { type: 'message'|'mention'|'task'|'system', title?, body?,
 *                senderName?, preview?, channelName?, taskTitle?, dueDate?,
 *                workspaceId?, channelId?, dmSessionId? }
 *   window.chttrixDesktop.setUnreadCount(n)
 *
 * Also listens for the DOM event `chttrix:notification` (detail = payload),
 * so code that cannot reach window.chttrixDesktop can simply do:
 *   document.dispatchEvent(new CustomEvent('chttrix:notification', { detail }))
 *
 * Handles:
 *   - notification clicks → navigate to the channel / DM
 *   - chttrix:// deep links → navigate to the validated in-app route
 */

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function navigate(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return;
  if (window.location.pathname === path) return;
  // Client-side navigation: React Router follows popstate. A full reload would lock the
  // encryption keys again and ask for the password.
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Work out the current workspace from the URL (/workspace/:workspaceId/...). */
function currentWorkspaceId() {
  const m = window.location.pathname.match(/^\/workspace\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function routeForNotification({ workspaceId, channelId, dmSessionId } = {}) {
  const ws = workspaceId || currentWorkspaceId();
  if (!ws || !SAFE_ID.test(ws)) return null;
  if (channelId && SAFE_ID.test(channelId)) return `/workspace/${ws}/channel/${channelId}`;
  if (dmSessionId && SAFE_ID.test(dmSessionId)) return `/workspace/${ws}/dm/${dmSessionId}`;
  return `/workspace/${ws}/home`;
}

function toStr(v, max) {
  if (v === undefined || v === null) return undefined;
  return String(v).slice(0, max);
}

function install() {
  if (typeof window === 'undefined') return;
  const api = window.electronAPI;
  if (!api || !api.isDesktop || window.chttrixDesktop) return;

  const notify = (payload = {}) => {
    try {
      if (!payload || typeof payload !== 'object') return;
      const type = ['message', 'mention', 'task', 'system'].includes(payload.type)
        ? payload.type
        : 'system';
      api.notify({
        type,
        title: toStr(payload.title, 200),
        body: toStr(payload.body, 500),
        senderName: toStr(payload.senderName, 100),
        preview: toStr(payload.preview, 500),
        channelName: toStr(payload.channelName, 100),
        taskTitle: toStr(payload.taskTitle, 200),
        dueDate: toStr(payload.dueDate, 64),
        workspaceId: toStr(payload.workspaceId || currentWorkspaceId(), 64),
        channelId: toStr(payload.channelId, 64),
        dmSessionId: toStr(payload.dmSessionId, 64),
      });
    } catch {
      /* never let desktop plumbing break the web app */
    }
  };

  const setUnreadCount = (n) => {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    try { api.setUnreadCount(count); } catch { /* ignore */ }
  };

  window.chttrixDesktop = Object.freeze({
    isDesktop: true,
    platform: api.platform,
    notify,
    setUnreadCount,
  });

  document.addEventListener('chttrix:notification', (e) => notify(e && e.detail));
  document.addEventListener('chttrix:unread-count', (e) => setUnreadCount(e && e.detail));

  if (typeof api.onNotificationClicked === 'function') {
    api.onNotificationClicked((payload) => {
      const path = routeForNotification(payload || {});
      if (path) navigate(path);
    });
  }

  if (typeof api.onDeepLink === 'function') {
    api.onDeepLink((link) => {
      if (link && typeof link.path === 'string') navigate(link.path);
    });
  }
}

install();

export {};
