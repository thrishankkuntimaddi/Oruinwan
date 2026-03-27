/**
 * Chttrix SDK — Minimal JavaScript Client
 * Usage (Node): const ChttrixSDK = require('./chttrix-sdk');
 * Usage (Browser): <script src="chttrix-sdk.js"></script> → window.ChttrixSDK
 *
 * const client = new ChttrixSDK({ apiKey: 'chx_...', baseUrl: 'https://your-chttrix-instance.com' });
 * await client.messages.list();
 * await client.tasks.create({ title: 'Fix bug', priority: 'high' });
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();            // CommonJS / Node
  } else if (typeof define === 'function' && define.amd) {
    define(factory);                       // AMD
  } else {
    root.ChttrixSDK = factory();           // Browser global
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class ChttrixSDK {
    /**
     * @param {Object} options
     * @param {string} options.apiKey  - Your Chttrix API key (chx_...)
     * @param {string} [options.baseUrl] - Base URL of your Chttrix instance (default: window.location.origin)
     */
    constructor({ apiKey, baseUrl } = {}) {
      if (!apiKey) throw new Error('ChttrixSDK: apiKey is required');
      this._apiKey = apiKey;
      this._baseUrl = (baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

      // Bind resource namespaces
      this.messages  = this._makeResource('messages');
      this.tasks     = this._makeResource('tasks');
      this.files     = this._makeResource('files');
      this.users     = this._makeResource('users');
      this.channels  = this._makeResource('channels');
      this.webhooks  = this._webhooksResource();
    }

    // ── Internal fetch wrapper ────────────────────────────────────────────────
    async _fetch(path, { method = 'GET', body, params } = {}) {
      let url = `${this._baseUrl}${path}`;

      if (params && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
        ).toString();
        url += `?${qs}`;
      }

      const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': this._apiKey
      };

      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, response: err });
      }

      return res.json();
    }

    // ── Resource factory ──────────────────────────────────────────────────────
    _makeResource(resource) {
      return {
        /**
         * List resources.
         * @param {Object} [params] - Query params (limit, status, channelId, etc.)
         */
        list: (params = {}) =>
          this._fetch(`/api/public/${resource}`, { params }),

        /**
         * Create a resource (tasks only).
         * @param {Object} data - Task data (title, description, priority, dueDate, assigneeId)
         */
        create: (data = {}) =>
          this._fetch(`/api/public/${resource}`, { method: 'POST', body: data })
      };
    }

    // ── Webhooks resource ─────────────────────────────────────────────────────
    _webhooksResource() {
      const self = this;
      return {
        /**
         * List webhook subscriptions for a workspace.
         * @param {string} workspaceId
         */
        list: (workspaceId) =>
          self._fetch(`/api/v2/integrations/webhooks`, { params: { workspaceId } }),

        /**
         * Subscribe to events.
         * @param {Object} opts
         * @param {string}   opts.workspaceId
         * @param {string}   opts.url           - Destination URL
         * @param {string[]} opts.events         - e.g. ['message.sent', 'task.created']
         */
        subscribe: ({ workspaceId, url, events }) =>
          self._fetch(`/api/v2/integrations/webhooks`, {
            method: 'POST',
            body: { workspaceId, url, events }
          }),

        /**
         * Unsubscribe / delete a webhook.
         * @param {string} webhookId
         */
        unsubscribe: (webhookId) =>
          self._fetch(`/api/v2/integrations/webhooks/${webhookId}`, { method: 'DELETE' })
      };
    }
  }

  // Convenience factory
  ChttrixSDK.create = (options) => new ChttrixSDK(options);

  return ChttrixSDK;
}));
