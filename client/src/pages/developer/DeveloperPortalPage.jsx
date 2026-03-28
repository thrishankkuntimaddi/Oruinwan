// client/src/pages/developer/DeveloperPortalPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../services/api';
import './DeveloperPortalPage.css';

const API = import.meta.env?.VITE_API_URL || '';

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'api-keys', label: 'API Keys', icon: '🔑' },
  { id: 'webhooks', label: 'Webhooks', icon: '🔗' },
  { id: 'bots',     label: 'Bots',     icon: '🤖' },
  { id: 'apps',     label: 'App Market', icon: '📦' },
  { id: 'docs',     label: 'Docs',     icon: '📄' },
];

// ── Helper ─────────────────────────────────────────────────────────────────────
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="dp-copy-btn" onClick={copy} title="Copy to clipboard">
      {copied ? '✅' : '📋'}
    </button>
  );
}

function Badge({ label, color = 'blue' }) {
  return <span className={`dp-badge dp-badge-${color}`}>{label}</span>;
}

// ── API Keys Tab ───────────────────────────────────────────────────────────────
function ApiKeysTab({ workspaceId }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);
  const [creating, setCreating] = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/developer/api-keys?workspaceId=${workspaceId}`);
      setKeys(res.data.keys || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post(`/api/developer/api-keys`, { workspaceId, name: newKeyName });
      setGeneratedKey(res.data.rawKey);
      setNewKeyName('');
      loadKeys();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id) => {
    if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await api.delete(`/api/developer/api-keys/${id}`);
      loadKeys();
    } catch {
      alert('Failed to revoke key');
    }
  };

  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>API Keys</h2>
          <p>Use API keys to authenticate requests to the Chttrix Public API.</p>
        </div>
        <button className="dp-btn dp-btn-primary" onClick={() => setShowCreate(true)}>+ Create Key</button>
      </div>

      {generatedKey && (
        <div className="dp-alert dp-alert-success">
          <strong>🔐 Save this key — it won't be shown again!</strong>
          <div className="dp-key-reveal">
            <code>{generatedKey}</code>
            <CopyButton value={generatedKey} />
          </div>
          <button className="dp-btn dp-btn-ghost" onClick={() => setGeneratedKey(null)}>Dismiss</button>
        </div>
      )}

      {showCreate && (
        <form className="dp-form-inline" onSubmit={createKey}>
          <input
            className="dp-input"
            placeholder="Key name (e.g. Production, CI/CD)"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            autoFocus
          />
          <button className="dp-btn dp-btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button className="dp-btn dp-btn-ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
        </form>
      )}

      {loading ? (
        <div className="dp-skeleton-list">{[1,2,3].map(i => <div key={i} className="dp-skeleton" />)}</div>
      ) : keys.length === 0 ? (
        <div className="dp-empty">No API keys yet. Create one to get started.</div>
      ) : (
        <div className="dp-card-list">
          {keys.map(k => (
            <div key={k._id} className="dp-card">
              <div className="dp-card-info">
                <span className="dp-card-title">{k.name}</span>
                <code className="dp-prefix">{k.keyPrefix}••••••••</code>
                <div className="dp-card-meta">
                  {k.permissions?.slice(0,3).map(p => <Badge key={p} label={p} color="indigo" />)}
                  {k.permissions?.length > 3 && <Badge label={`+${k.permissions.length - 3}`} color="gray" />}
                </div>
                <span className="dp-card-sub">
                  Created {new Date(k.createdAt).toLocaleDateString()} · Used {k.usageCount || 0} times
                </span>
              </div>
              <button className="dp-btn dp-btn-danger-ghost" onClick={() => revokeKey(k._id)}>Revoke</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Webhooks Tab ───────────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = ['message.sent','task.created','task.updated','task.completed','file.uploaded','meeting.completed','meeting.started','*'];

function WebhooksTab({ workspaceId }) {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', events: ['message.sent'] });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v2/integrations/webhooks?workspaceId=${workspaceId}`);
      setHooks(res.data.webhooks || res.data || []);
    } catch {
      setHooks([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const toggleEvent = (ev) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev]
    }));
  };

  const createHook = async (e) => {
    e.preventDefault();
    if (!form.url || !form.events.length) return;
    setCreating(true);
    try {
      await api.post(`/api/v2/integrations/webhooks`, { workspaceId, ...form });
      setShowCreate(false);
      setForm({ url: '', events: ['message.sent'] });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const deleteHook = async (id) => {
    if (!window.confirm('Delete this webhook?')) return;
    try {
      await api.delete(`/api/v2/integrations/webhooks/${id}`);
      load();
    } catch {
      alert('Failed to delete webhook');
    }
  };

  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>Webhooks</h2>
          <p>Subscribe to workspace events and receive HTTP POSTs to your endpoint.</p>
        </div>
        <button className="dp-btn dp-btn-primary" onClick={() => setShowCreate(v => !v)}>+ Subscribe</button>
      </div>

      {showCreate && (
        <form className="dp-card dp-form-block" onSubmit={createHook}>
          <label className="dp-label">Endpoint URL</label>
          <input className="dp-input" placeholder="https://your-server.com/webhook" value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} required />
          <label className="dp-label" style={{marginTop:12}}>Events to subscribe</label>
          <div className="dp-events-grid">
            {WEBHOOK_EVENTS.map(ev => (
              <label key={ev} className="dp-event-check">
                <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                <code>{ev}</code>
              </label>
            ))}
          </div>
          <div className="dp-form-actions">
            <button className="dp-btn dp-btn-primary" disabled={creating}>{creating ? 'Saving…' : 'Create Webhook'}</button>
            <button className="dp-btn dp-btn-ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="dp-skeleton-list">{[1,2].map(i => <div key={i} className="dp-skeleton" />)}</div>
      ) : hooks.length === 0 ? (
        <div className="dp-empty">No webhooks configured.</div>
      ) : (
        <div className="dp-card-list">
          {hooks.map(h => (
            <div key={h._id} className="dp-card">
              <div className="dp-card-info">
                <span className="dp-card-title" style={{wordBreak:'break-all'}}>{h.url}</span>
                <div className="dp-card-meta">
                  <Badge label={h.event} color="violet" />
                  <Badge label={h.isActive ? 'Active' : 'Inactive'} color={h.isActive ? 'green' : 'red'} />
                </div>
                {h.lastTriggeredAt && (
                  <span className="dp-card-sub">Last triggered: {new Date(h.lastTriggeredAt).toLocaleString()}</span>
                )}
              </div>
              <button className="dp-btn dp-btn-danger-ghost" onClick={() => deleteHook(h._id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Bots Tab ───────────────────────────────────────────────────────────────────
function BotsTab({ workspaceId }) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [generatedToken, setGeneratedToken] = useState(null);
  const [creating, setCreating] = useState(false);
  const [testMsg, setTestMsg] = useState({ botId: null, text: '', channelId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/developer/bots?workspaceId=${workspaceId}`);
      setBots(res.data.bots || []);
    } catch { setBots([]); } finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const createBot = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post(`/api/developer/bots`, { workspaceId, ...form });
      setGeneratedToken(res.data.rawToken);
      setShowCreate(false);
      setForm({ name: '', description: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create bot');
    } finally { setCreating(false); }
  };

  const sendTestMsg = async (botId) => {
    if (!testMsg.text || !testMsg.channelId) return alert('Enter text and channel ID');
    try {
      await api.post(`/api/developer/bots/${botId}/message`, { channelId: testMsg.channelId, text: testMsg.text });
      setTestMsg({ botId: null, text: '', channelId: '' });
      alert('Message sent!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message');
    }
  };

  const deleteBot = async (id) => {
    if (!window.confirm('Deactivate this bot?')) return;
    try {
      await api.delete(`/api/developer/bots/${id}`);
      load();
    } catch { alert('Failed to deactivate bot'); }
  };

  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>Bots</h2>
          <p>Create bots that can read and send messages in your workspace channels.</p>
        </div>
        <button className="dp-btn dp-btn-primary" onClick={() => setShowCreate(v => !v)}>+ Create Bot</button>
      </div>

      {generatedToken && (
        <div className="dp-alert dp-alert-success">
          <strong>🤖 Bot token — save it now, won't be shown again!</strong>
          <div className="dp-key-reveal">
            <code>{generatedToken}</code>
            <CopyButton value={generatedToken} />
          </div>
          <button className="dp-btn dp-btn-ghost" onClick={() => setGeneratedToken(null)}>Dismiss</button>
        </div>
      )}

      {showCreate && (
        <form className="dp-card dp-form-block" onSubmit={createBot}>
          <label className="dp-label">Bot Name</label>
          <input className="dp-input" placeholder="e.g. DeployBot" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
          <label className="dp-label" style={{marginTop:12}}>Description</label>
          <input className="dp-input" placeholder="What does this bot do?" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
          <div className="dp-form-actions">
            <button className="dp-btn dp-btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create Bot'}</button>
            <button className="dp-btn dp-btn-ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="dp-skeleton-list">{[1,2].map(i => <div key={i} className="dp-skeleton" />)}</div>
      ) : bots.length === 0 ? (
        <div className="dp-empty">No bots yet.</div>
      ) : (
        <div className="dp-card-list">
          {bots.map(bot => (
            <div key={bot._id} className="dp-card">
              <div className="dp-bot-avatar">🤖</div>
              <div className="dp-card-info">
                <span className="dp-card-title">{bot.name}</span>
                {bot.description && <span className="dp-card-sub">{bot.description}</span>}
                <code className="dp-prefix">{bot.tokenPrefix}••••••••</code>
                <div className="dp-card-meta">
                  {bot.permissions?.map(p => <Badge key={p} label={p} color="indigo" />)}
                </div>
                <span className="dp-card-sub">{bot.messageCount || 0} messages sent</span>
              </div>
              <div className="dp-card-actions">
                <button
                  className="dp-btn dp-btn-ghost"
                  onClick={() => setTestMsg(t => ({...t, botId: t.botId === bot._id ? null : bot._id}))}
                >
                  {testMsg.botId === bot._id ? 'Cancel' : 'Test'}
                </button>
                <button className="dp-btn dp-btn-danger-ghost" onClick={() => deleteBot(bot._id)}>Remove</button>
              </div>
              {testMsg.botId === bot._id && (
                <div className="dp-test-msg-row">
                  <input className="dp-input" placeholder="Channel ID" value={testMsg.channelId} onChange={e => setTestMsg(t => ({...t, channelId: e.target.value}))} />
                  <input className="dp-input" placeholder="Message text" value={testMsg.text} onChange={e => setTestMsg(t => ({...t, text: e.target.value}))} />
                  <button className="dp-btn dp-btn-primary" onClick={() => sendTestMsg(bot._id)}>Send</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Apps Tab ───────────────────────────────────────────────────────────────────
const CATEGORY_ICONS = { productivity: '⚡', communication: '💬', developer: '🛠️', automation: '🔄', analytics: '📊' };

function AppsTab({ workspaceId }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/developer/apps?workspaceId=${workspaceId}`);
      setApps(res.data.apps || []);
    } catch { setApps([]); } finally { setLoading(false); }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (app) => {
    setActionLoading(l => ({...l, [app._id]: true}));
    try {
      if (app.installed) {
        await api.delete(`/api/developer/apps/${app._id}/uninstall`, { data: { workspaceId } });
      } else {
        await api.post(`/api/developer/apps/${app._id}/install`, { workspaceId });
      }
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(l => ({...l, [app._id]: false}));
    }
  };

  const categories = ['all', ...[...new Set(apps.map(a => a.category))]];
  const filtered = filter === 'all' ? apps : apps.filter(a => a.category === filter);

  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>App Marketplace</h2>
          <p>Install apps to extend your workspace capabilities.</p>
        </div>
      </div>

      <div className="dp-filter-tabs">
        {categories.map(c => (
          <button key={c} className={`dp-filter-tab${filter === c ? ' active' : ''}`} onClick={() => setFilter(c)}>
            {c === 'all' ? 'All' : `${CATEGORY_ICONS[c] || ''} ${c}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="dp-apps-grid">
          {[1,2,3,4].map(i => <div key={i} className="dp-app-card dp-skeleton" style={{height:180}} />)}
        </div>
      ) : (
        <div className="dp-apps-grid">
          {filtered.map(app => (
            <div key={app._id} className={`dp-app-card${app.installed ? ' dp-app-installed' : ''}`}>
              <div className="dp-app-icon">{CATEGORY_ICONS[app.category] || '📦'}</div>
              <div className="dp-app-info">
                <span className="dp-app-name">{app.name}</span>
                <span className="dp-app-dev">by {app.developer} · v{app.version}</span>
                <p className="dp-app-desc">{app.description}</p>
              </div>
              <button
                className={`dp-btn ${app.installed ? 'dp-btn-danger-ghost' : 'dp-btn-primary'}`}
                onClick={() => toggle(app)}
                disabled={actionLoading[app._id]}
              >
                {actionLoading[app._id] ? '…' : app.installed ? 'Uninstall' : 'Install'}
              </button>
              {app.installed && <span className="dp-app-installed-badge">✓ Installed</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Docs Tab ───────────────────────────────────────────────────────────────────
function DocsTab() {
  const [activeSection, setActiveSection] = useState('quickstart');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-chttrix-instance.com';

  const sections = {
    quickstart: {
      title: 'Quick Start',
      content: (
        <div>
          <p>Get started with the Chttrix Public API in 2 minutes.</p>
          <h4>1. Create an API Key</h4>
          <p>Go to the <strong>API Keys</strong> tab and create a key for your workspace.</p>
          <h4>2. Make your first request</h4>
          <pre><code>{`curl -H "X-Api-Key: chx_your_key_here" \\
  "${baseUrl}/api/public/messages?workspaceId=YOUR_WORKSPACE_ID"`}</code></pre>
          <h4>3. Use the SDK</h4>
          <pre><code>{`// Node.js / Browser
const ChttrixSDK = require('./chttrix-sdk');
const client = new ChttrixSDK({
  apiKey: 'chx_your_key_here',
  baseUrl: '${baseUrl}'
});

const { messages } = await client.messages.list({ limit: 20 });
const { task } = await client.tasks.create({ title: 'New task' });`}</code></pre>
        </div>
      )
    },
    authentication: {
      title: 'Authentication',
      content: (
        <div>
          <p>All public API requests require an <code>X-Api-Key</code> header.</p>
          <pre><code>{`X-Api-Key: chx_your_api_key_here`}</code></pre>
          <p>API keys are workspace-scoped. All requests automatically operate within the key's workspace.</p>
          <h4>Permissions</h4>
          <table className="dp-docs-table">
            <thead><tr><th>Permission</th><th>Access</th></tr></thead>
            <tbody>
              {[
                ['messages:read','Read messages'],
                ['tasks:read','Read tasks'],
                ['tasks:write','Create/update tasks'],
                ['files:read','Read files'],
                ['users:read','Read workspace members'],
                ['channels:read','Read channels'],
                ['webhooks:read','List webhooks'],
                ['webhooks:write','Create/delete webhooks'],
                ['*','Full access'],
              ].map(([p, d]) => (
                <tr key={p}><td><code>{p}</code></td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
    endpoints: {
      title: 'API Reference',
      content: (
        <div>
          {[
            { method:'GET', path:'/api/public/messages', desc:'List recent messages', params:'limit, channelId' },
            { method:'GET', path:'/api/public/tasks', desc:'List tasks', params:'limit, status' },
            { method:'POST', path:'/api/public/tasks', desc:'Create a task', params:'title, description, priority, dueDate, assigneeId' },
            { method:'GET', path:'/api/public/files', desc:'List files', params:'limit' },
            { method:'GET', path:'/api/public/users', desc:'List workspace members', params:'-' },
            { method:'GET', path:'/api/public/channels', desc:'List channels', params:'-' },
          ].map(ep => (
            <div key={ep.path} className="dp-endpoint">
              <span className={`dp-method dp-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
              <code className="dp-endpoint-path">{ep.path}</code>
              <p>{ep.desc}</p>
              {ep.params !== '-' && <p className="dp-endpoint-params">Query params: <code>{ep.params}</code></p>}
            </div>
          ))}
          <h4 style={{marginTop:24}}>Rate Limits</h4>
          <p>Public API: <strong>100 requests / minute</strong> per API key.</p>
        </div>
      )
    },
    webhooks: {
      title: 'Webhook Events',
      content: (
        <div>
          <p>When an event occurs, Chttrix POSTs a JSON payload to your endpoint with these headers:</p>
          <pre><code>{`X-Chttrix-Event: message.sent
X-Chttrix-Signature: sha256=<hmac>
X-Chttrix-Delivery: <webhook-id>`}</code></pre>
          <h4>Payload shape</h4>
          <pre><code>{`{
  "event": "message.sent",
  "workspaceId": "...",
  "data": { /* event-specific data */ },
  "timestamp": "2026-03-27T14:00:00.000Z"
}`}</code></pre>
          <h4>Available Events</h4>
          <table className="dp-docs-table">
            <thead><tr><th>Event</th><th>Triggered when</th></tr></thead>
            <tbody>
              {[
                ['message.sent','A message is sent in any channel'],
                ['task.created','A new task is created'],
                ['task.updated','A task is updated'],
                ['task.completed','A task is marked complete'],
                ['file.uploaded','A file is uploaded'],
                ['meeting.started','A meeting starts'],
                ['meeting.completed','A meeting ends'],
                ['*','All of the above'],
              ].map(([e,d]) => (
                <tr key={e}><td><code>{e}</code></td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    },
    sdk: {
      title: 'SDK Reference',
      content: (
        <div>
          <h4>Installation</h4>
          <pre><code>{`# Copy sdk/js/chttrix-sdk.js into your project
# or serve it as a static file`}</code></pre>
          <h4>Initialization</h4>
          <pre><code>{`const client = new ChttrixSDK({
  apiKey: 'chx_...',
  baseUrl: '${baseUrl}'
});`}</code></pre>
          <h4>Messages</h4>
          <pre><code>{`await client.messages.list({ limit: 50, channelId: '...' });`}</code></pre>
          <h4>Tasks</h4>
          <pre><code>{`await client.tasks.list({ status: 'todo' });
await client.tasks.create({
  title: 'Deploy to staging',
  priority: 'high',
  dueDate: '2026-04-01'
});`}</code></pre>
          <h4>Webhooks</h4>
          <pre><code>{`await client.webhooks.subscribe({
  workspaceId: '...',
  url: 'https://your-server.com/hook',
  events: ['message.sent', 'task.created']
});
await client.webhooks.list('workspaceId');
await client.webhooks.unsubscribe('webhookId');`}</code></pre>
        </div>
      )
    }
  };

  return (
    <div className="dp-docs-layout">
      <nav className="dp-docs-nav">
        {Object.entries(sections).map(([id, sec]) => (
          <button
            key={id}
            className={`dp-docs-nav-item${activeSection === id ? ' active' : ''}`}
            onClick={() => setActiveSection(id)}
          >
            {sec.title}
          </button>
        ))}
      </nav>
      <div className="dp-docs-content">
        <h2>{sections[activeSection].title}</h2>
        {sections[activeSection].content}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DeveloperPortalPage({ workspaceId }) {
  const [activeTab, setActiveTab] = useState('api-keys');

  // Allow workspaceId from URL params if not passed as prop
  const wsId = workspaceId || new URLSearchParams(window.location.search).get('workspaceId') || '';

  return (
    <div className="dp-root">
      {/* Header */}
      <div className="dp-header">
        <div className="dp-header-content">
          <div className="dp-header-icon">⚡</div>
          <div>
            <h1>Developer Platform</h1>
            <p>Build integrations, automate workflows, and extend Chttrix for your team.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dp-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`dp-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="dp-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="dp-body">
        {activeTab === 'api-keys' && <ApiKeysTab workspaceId={wsId} />}
        {activeTab === 'webhooks' && <WebhooksTab workspaceId={wsId} />}
        {activeTab === 'bots'     && <BotsTab     workspaceId={wsId} />}
        {activeTab === 'apps'     && <AppsTab     workspaceId={wsId} />}
        {activeTab === 'docs'     && <DocsTab />}
      </div>
    </div>
  );
}
