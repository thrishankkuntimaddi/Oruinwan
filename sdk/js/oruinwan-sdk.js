/**
 * Oruinwan SDK — JavaScript client for the Oruinwan API.
 *
 * Works in Node 18+ and modern browsers (uses global fetch). No dependencies.
 * Realtime is optional: pass a socket.io-client `io` function to enable it.
 *
 *   const { OruinwanSDK } = require('@oruinwan/sdk');           // CommonJS
 *   import { OruinwanSDK } from '@oruinwan/sdk';                 // ESM (via bundler)
 *   <script src="oruinwan-sdk.js"></script> → window.OruinwanSDK // Browser
 *
 *   ChttrixSDK / ChttrixError (and window.ChttrixSDK) remain as deprecated aliases.
 *   Requests carry the legacy-named `X-Chttrix-SDK` header (wire contract, unchanged).
 *
 *   // Server-to-server with an API key (Developer Portal → API keys)
 *   const oruinwan = new OruinwanSDK({ baseUrl: 'https://api.example.com', apiKey: 'chx_...' });
 *   const { tasks } = await oruinwan.tasks.list({ status: 'todo' });
 *
 *   // On behalf of a user with a JWT
 *   const oruinwan = new OruinwanSDK({ baseUrl, accessToken });
 *   await oruinwan.webhooks.subscribe({ workspaceId, event: 'task.created', url });
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
    module.exports.default = module.exports.OruinwanSDK;
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const api = factory();
    root.OruinwanSDK = api.OruinwanSDK;
    /** @deprecated use window.OruinwanSDK */
    root.ChttrixSDK = api.OruinwanSDK;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

  class OruinwanError extends Error {
    constructor(message, { status = 0, code, response, request } = {}) {
      super(message);
      this.name = 'OruinwanError';
      this.status = status;
      this.code = code;
      this.response = response;
      this.request = request;
    }
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function buildQuery(params) {
    if (!params) return '';
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!entries.length) return '';
    return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  }

  class OruinwanSDK {
    /**
     * @param {object} options
     * @param {string} [options.baseUrl]       Origin of the Oruinwan API (no trailing slash). Defaults to window.location.origin in browsers.
     * @param {string} [options.apiKey]        Public API key (chx_...). Used for /api/public/* resources.
     * @param {string} [options.accessToken]   User JWT for user-scoped endpoints.
     * @param {string} [options.refreshToken]  Refresh token (native/SDK clients only).
     * @param {Function} [options.fetch]       Custom fetch implementation.
     * @param {number} [options.timeoutMs]     Per-request timeout (default 15000).
     * @param {number} [options.retries]       Retries for 429/5xx (default 2).
     * @param {Function} [options.io]          socket.io-client `io` for realtime.
     * @param {string} [options.platform]      Value for the x-client-platform header.
     * @param {Function} [options.onTokens]    Called with { accessToken, refreshToken } whenever tokens change.
     */
    constructor(options = {}) {
      const {
        baseUrl, apiKey, accessToken, refreshToken, fetch: fetchImpl, timeoutMs = 15000,
        retries = 2, io, platform, onTokens,
      } = options;

      const defaultOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
      this.baseUrl = String(baseUrl || defaultOrigin).replace(/\/+$/, '');
      if (!this.baseUrl) throw new OruinwanError('OruinwanSDK: baseUrl is required outside a browser');

      this.apiKey = apiKey || null;
      this.accessToken = accessToken || null;
      this.refreshToken = refreshToken || null;
      this.platform = platform || null;
      this.timeoutMs = timeoutMs;
      this.retries = retries;
      this.onTokens = typeof onTokens === 'function' ? onTokens : null;
      this._fetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
      if (!this._fetch) throw new OruinwanError('OruinwanSDK: no fetch available; pass options.fetch');
      this._io = io || null;
      this._socket = null;
      this._refreshing = null;

      this.auth = this._authResource();
      this.messages = this._publicResource('messages');
      this.tasks = this._publicResource('tasks', { create: true });
      this.files = this._publicResource('files');
      this.users = this._publicResource('users');
      this.channels = this._publicResource('channels');
      this.webhooks = this._webhooksResource();
      this.ai = this._aiResource();
      this.realtime = this._realtimeResource();
    }

    static get version() { return VERSION; }
    static create(options) { return new OruinwanSDK(options); }

    // ── Core request ──────────────────────────────────────────────────────────

    /**
     * Perform an HTTP request against the API.
     * @param {string} path  Path starting with /api/...
     * @param {object} [opts]
     * @param {string} [opts.method]
     * @param {object} [opts.body]
     * @param {object} [opts.params]
     * @param {'auto'|'apiKey'|'bearer'|'none'} [opts.auth]
     * @param {object} [opts.headers]
     * @param {boolean} [opts.raw]  Return the Response instead of parsed JSON.
     */
    async request(path, opts = {}) {
      const { method = 'GET', body, params, auth = 'auto', headers = {}, raw = false, _retried = false } = opts;
      const url = `${this.baseUrl}${path}${buildQuery(params)}`;

      const reqHeaders = { Accept: 'application/json', 'X-Chttrix-SDK': `js/${VERSION}`, ...headers };
      if (body !== undefined && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
        reqHeaders['Content-Type'] = 'application/json';
      }
      if (this.platform) reqHeaders['x-client-platform'] = this.platform;

      const mode = auth === 'auto' ? (path.startsWith('/api/public/') && this.apiKey ? 'apiKey' : this.accessToken ? 'bearer' : this.apiKey ? 'apiKey' : 'none') : auth;
      if (mode === 'apiKey') {
        if (!this.apiKey) throw new OruinwanError('OruinwanSDK: apiKey is required for this call', { code: 'NO_API_KEY' });
        reqHeaders['X-Api-Key'] = this.apiKey;
      } else if (mode === 'bearer') {
        if (!this.accessToken) throw new OruinwanError('OruinwanSDK: accessToken is required for this call', { code: 'NO_ACCESS_TOKEN' });
        reqHeaders.Authorization = `Bearer ${this.accessToken}`;
      }

      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
        let res;
        try {
          res = await this._fetch(url, {
            method,
            headers: reqHeaders,
            body: body === undefined ? undefined : reqHeaders['Content-Type'] === 'application/json' ? JSON.stringify(body) : body,
            signal: controller ? controller.signal : undefined,
            credentials: 'include',
          });
        } catch (err) {
          if (timer) clearTimeout(timer);
          const timedOut = err && err.name === 'AbortError';
          if (attempt < this.retries) { attempt += 1; await sleep(250 * 2 ** attempt); continue; }
          throw new OruinwanError(timedOut ? `Request timed out after ${this.timeoutMs}ms` : `Network error: ${err.message}`, {
            code: timedOut ? 'TIMEOUT' : 'NETWORK', request: { method, url },
          });
        }
        if (timer) clearTimeout(timer);

        // Silent refresh header from the server middleware.
        const rotated = res.headers && typeof res.headers.get === 'function' ? res.headers.get('x-access-token') : null;
        if (rotated) this._setTokens({ accessToken: rotated });

        if (res.status === 401 && mode === 'bearer' && this.refreshToken && !_retried) {
          await this.auth.refresh();
          return this.request(path, { ...opts, _retried: true });
        }

        if (RETRYABLE.has(res.status) && attempt < this.retries && method === 'GET') {
          attempt += 1;
          const retryAfter = Number(res.headers && res.headers.get && res.headers.get('retry-after')) || 0;
          await sleep(retryAfter ? retryAfter * 1000 : 250 * 2 ** attempt);
          continue;
        }

        if (raw) return res;
        const data = await parseBody(res);
        if (!res.ok) {
          const message = (data && (data.message || data.error)) || res.statusText || `HTTP ${res.status}`;
          throw new OruinwanError(message, { status: res.status, code: data && data.code, response: data, request: { method, url } });
        }
        return data;
      }
    }

    _setTokens({ accessToken, refreshToken }) {
      if (accessToken !== undefined) this.accessToken = accessToken;
      if (refreshToken !== undefined) this.refreshToken = refreshToken;
      if (this._socket && this._socket.auth) this._socket.auth.token = this.accessToken;
      if (this.onTokens) this.onTokens({ accessToken: this.accessToken, refreshToken: this.refreshToken });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    _authResource() {
      const sdk = this;
      return {
        /** Log in with email and password. Stores the returned tokens on the client. */
        async login(email, password) {
          const data = await sdk.request('/api/auth/login', { method: 'POST', body: { email, password }, auth: 'none' });
          sdk._setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken || sdk.refreshToken });
          return data;
        },
        /** Rotate the access token. Uses the stored refresh token when the server issued one, else the cookie. */
        async refresh() {
          if (!sdk._refreshing) {
            sdk._refreshing = sdk.request('/api/auth/refresh', {
              method: 'POST', auth: 'none', body: sdk.refreshToken ? { refreshToken: sdk.refreshToken } : undefined,
            }).then((data) => {
              sdk._setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken || sdk.refreshToken });
              return data;
            }).finally(() => { sdk._refreshing = null; });
          }
          return sdk._refreshing;
        },
        me: () => sdk.request('/api/auth/me', { auth: 'bearer' }),
        async logout() {
          try { await sdk.request('/api/auth/logout', { method: 'POST', auth: 'bearer' }); } finally {
            sdk._setTokens({ accessToken: null, refreshToken: null });
            sdk.realtime.disconnect();
          }
        },
        setAccessToken: (token) => sdk._setTokens({ accessToken: token }),
        setApiKey: (key) => { sdk.apiKey = key; },
      };
    }

    // ── Public API resources (API key) ───────────────────────────────────────

    _publicResource(resource, { create = false } = {}) {
      const sdk = this;
      const api = {
        /** @param {object} [params] Query params such as limit, status, channelId. */
        list: (params = {}) => sdk.request(`/api/public/${resource}`, { params }),
      };
      if (create) {
        api.create = (data = {}) => sdk.request(`/api/public/${resource}`, { method: 'POST', body: data });
      }
      return api;
    }

    // ── Webhooks (user token) ────────────────────────────────────────────────

    _webhooksResource() {
      const sdk = this;
      const base = '/api/v2/integrations/webhooks';
      return {
        list: (workspaceId) => sdk.request(base, { params: { workspaceId }, auth: 'bearer' }),
        /**
         * Subscribe a URL to one event. Pass `events` to create one subscription per event.
         * @param {{ workspaceId: string, url: string, event?: string, events?: string[] }} opts
         */
        async subscribe({ workspaceId, url, event, events }) {
          const list = events && events.length ? events : [event];
          if (!list[0]) throw new OruinwanError('webhooks.subscribe: event is required', { code: 'BAD_REQUEST' });
          const created = [];
          for (const ev of list) {
            const out = await sdk.request(base, { method: 'POST', body: { workspaceId, url, event: ev }, auth: 'bearer' });
            created.push(out.webhook || out);
          }
          return events && events.length ? created : created[0];
        },
        unsubscribe: (webhookId) => sdk.request(`${base}/${encodeURIComponent(webhookId)}`, { method: 'DELETE', auth: 'bearer' }),
      };
    }

    // ── AI (user token) ──────────────────────────────────────────────────────

    _aiResource() {
      const sdk = this;
      return {
        chat: ({ message, history, workspaceId, context }) => sdk.request('/api/ai/chat', { method: 'POST', body: { message, history, workspaceId, context }, auth: 'bearer' }),
        summarize: ({ text, workspaceId, style, title }) => sdk.request('/api/ai/summarize', { method: 'POST', body: { text, workspaceId, style, title }, auth: 'bearer' }),
        generateTask: ({ context, workspaceId }) => sdk.request('/api/ai/generate-task', { method: 'POST', body: { context, workspaceId }, auth: 'bearer' }),
        smartReplies: ({ messages, workspaceId, tone }) => sdk.request('/api/ai/smart-replies', { method: 'POST', body: { messages, workspaceId, tone }, auth: 'bearer' }),
        translate: ({ text, targetLang, workspaceId }) => sdk.request('/api/ai/translate', { method: 'POST', body: { text, targetLang, workspaceId }, auth: 'bearer' }),
        draft: ({ instruction, messages, tone, replyTo, existing, workspaceId }) => sdk.request('/api/ai/draft', { method: 'POST', body: { instruction, messages, tone, replyTo, existing, workspaceId }, auth: 'bearer' }),
        conversation: ({ messages, mode, question, title, workspaceId }) => sdk.request('/api/ai/conversation', { method: 'POST', body: { messages, mode, question, title, workspaceId }, auth: 'bearer' }),
        extractTasks: ({ text, max, create, workspaceId }) => sdk.request('/api/ai/extract-tasks', { method: 'POST', body: { text, max, create, workspaceId }, auth: 'bearer' }),
        noteAssist: ({ action, text, title, instruction, workspaceId }) => sdk.request('/api/ai/notes/assist', { method: 'POST', body: { action, text, title, instruction, workspaceId }, auth: 'bearer' }),
        taskAssist: ({ action, task, instruction, workspaceId }) => sdk.request('/api/ai/tasks/assist', { method: 'POST', body: { action, task, instruction, workspaceId }, auth: 'bearer' }),
        capabilities: () => sdk.request('/api/ai/capabilities', { auth: 'bearer' }),
        settings: ({ workspaceId }) => sdk.request(`/api/ai/settings?workspaceId=${encodeURIComponent(workspaceId)}`, { auth: 'bearer' }),
        usage: ({ workspaceId, days = 30 }) => sdk.request(`/api/ai/usage?workspaceId=${encodeURIComponent(workspaceId)}&days=${days}`, { auth: 'bearer' }),
      };
    }

    // ── Realtime (socket.io) ─────────────────────────────────────────────────

    _realtimeResource() {
      const sdk = this;
      return {
        /**
         * Connect a Socket.IO client authenticated with the access token.
         * @param {{ io?: Function, url?: string, transports?: string[] }} [opts]
         */
        connect(opts = {}) {
          const io = opts.io || sdk._io;
          if (!io) throw new OruinwanError('realtime.connect: pass socket.io-client\'s io() via options.io', { code: 'NO_IO' });
          if (!sdk.accessToken) throw new OruinwanError('realtime.connect: accessToken is required', { code: 'NO_ACCESS_TOKEN' });
          if (sdk._socket) return sdk._socket;
          sdk._socket = io(opts.url || sdk.baseUrl, {
            auth: { token: sdk.accessToken },
            transports: opts.transports || ['websocket'],
            reconnection: true,
          });
          return sdk._socket;
        },
        get socket() { return sdk._socket; },
        on(event, handler) { if (sdk._socket) sdk._socket.on(event, handler); return () => sdk._socket && sdk._socket.off(event, handler); },
        off(event, handler) { if (sdk._socket) sdk._socket.off(event, handler); },
        emit(event, payload, ack) { if (sdk._socket) sdk._socket.emit(event, payload, ack); },
        joinWorkspace(workspaceId) { this.emit('join-workspace', { workspaceId }); },
        joinChannel(channelId) {
          return new Promise((resolve) => this.emit('chat:join', channelId, (ack) => resolve(ack || { success: true })));
        },
        joinDm(dmSessionId) { this.emit('join-dm', { dmSessionId }); },
        disconnect() { if (sdk._socket) { sdk._socket.removeAllListeners(); sdk._socket.disconnect(); sdk._socket = null; } },
      };
    }
  }

  async function parseBody(res) {
    const type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
    if (type.includes('application/json')) {
      try { return await res.json(); } catch { return null; }
    }
    try { const text = await res.text(); return text ? { message: text } : null; } catch { return null; }
  }

  return {
    OruinwanSDK,
    OruinwanError,
    VERSION,
    /** @deprecated use OruinwanSDK */
    ChttrixSDK: OruinwanSDK,
    /** @deprecated use OruinwanError */
    ChttrixError: OruinwanError,
  };
}));
