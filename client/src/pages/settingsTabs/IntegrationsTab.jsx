// client/src/pages/settingsTabs/IntegrationsTab.jsx
// Integrations Settings Tab — connect/disconnect providers, manage webhooks, AI provider switching
import React, { useState, useEffect, useCallback } from 'react';
import {
  Github, Cloud, MessageSquare, Zap, Bot, Link2, Plus, Trash2,
  CheckCircle, XCircle, RefreshCw, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getIntegrations, connectIntegration, disconnectIntegration,
  getWebhooks, createWebhook, deleteWebhook,
  getAIProviders, connectAIProvider, switchAIProvider, disconnectAIProvider
} from '../../services/integrations.service';

// ── Provider metadata catalogue ───────────────────────────────────────────────
const PROVIDER_CATALOGUE = [
  {
    category: 'Developer',
    color: 'from-gray-700 to-gray-900',
    accent: '#374151',
    providers: [
      { type: 'github', label: 'GitHub', icon: '🐙', desc: 'Sync issues → tasks, PRs → activity', fields: [{ key: 'token', label: 'Personal Access Token', type: 'password' }] },
      { type: 'gitlab', label: 'GitLab', icon: '🦊', desc: 'Webhook for issues & merge requests', fields: [{ key: 'token', label: 'Access Token', type: 'password' }, { key: 'webhookSecret', label: 'Webhook Secret', type: 'password' }] },
      { type: 'bitbucket', label: 'Bitbucket', icon: '🪣', desc: 'Push events & issue creation', fields: [{ key: 'appPassword', label: 'App Password', type: 'password' }] },
      { type: 'linear', label: 'Linear', icon: '◑', desc: 'Sync Linear issues as tasks', fields: [{ key: 'apiKey', label: 'API Key', type: 'password' }] },
      { type: 'jira', label: 'Jira', icon: '🔷', desc: 'Sync Jira issues, project tracking', fields: [{ key: 'token', label: 'API Token', type: 'password' }, { key: 'baseUrl', label: 'Base URL', type: 'text' }] },
      { type: 'cicd', label: 'CI/CD Pipeline', icon: '⚙️', desc: 'Generic CI/CD webhook (GH Actions, Jenkins)', fields: [{ key: 'webhookSecret', label: 'Webhook Secret (optional)', type: 'password' }] },
    ]
  },
  {
    category: 'Productivity',
    color: 'from-blue-600 to-indigo-700',
    accent: '#4F46E5',
    providers: [
      { type: 'google_drive', label: 'Google Drive', icon: '📁', desc: 'Attach Drive files to workspace', fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
      { type: 'onedrive', label: 'OneDrive', icon: '☁️', desc: 'Attach OneDrive files', fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
      { type: 'dropbox', label: 'Dropbox', icon: '📦', desc: 'Attach Dropbox files', fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
      { type: 'notion', label: 'Notion', icon: '📝', desc: 'Attach Notion pages to workspace', fields: [{ key: 'token', label: 'Integration Token', type: 'password' }] },
      { type: 'confluence', label: 'Confluence', icon: '📚', desc: 'Attach Confluence pages', fields: [{ key: 'token', label: 'API Token', type: 'password' }, { key: 'baseUrl', label: 'Base URL', type: 'text' }] },
    ]
  },
  {
    category: 'Communication',
    color: 'from-purple-600 to-pink-600',
    accent: '#9333EA',
    providers: [
      { type: 'slack', label: 'Slack', icon: '💬', desc: 'Bridge messages between Slack ↔ Chttrix', fields: [{ key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text' }] },
      { type: 'zoom', label: 'Zoom', icon: '📹', desc: 'Create Zoom meetings from Chttrix', fields: [{ key: 'apiKey', label: 'API Key', type: 'password' }, { key: 'apiSecret', label: 'API Secret', type: 'password' }] },
      { type: 'google_meet', label: 'Google Meet', icon: '🎥', desc: 'Create Meet links from Chttrix', fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
      { type: 'teams', label: 'Microsoft Teams', icon: '💼', desc: 'Bridge messages via Teams webhooks', fields: [{ key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text' }] },
    ]
  },
  {
    category: 'Automation',
    color: 'from-amber-500 to-orange-600',
    accent: '#F59E0B',
    providers: [
      { type: 'zapier', label: 'Zapier', icon: '⚡', desc: 'Trigger Zapier zaps from Chttrix events', fields: [{ key: 'webhookUrl', label: 'Zapier Webhook URL', type: 'text' }] },
      { type: 'make', label: 'Make (Integromat)', icon: '🔗', desc: 'Connect Make.com scenarios', fields: [{ key: 'webhookUrl', label: 'Make Webhook URL', type: 'text' }] },
      { type: 'n8n', label: 'n8n', icon: '🔄', desc: 'Trigger n8n workflows', fields: [{ key: 'webhookUrl', label: 'n8n Webhook URL', type: 'text' }] },
    ]
  }
];

const WEBHOOK_EVENTS = [
  'task.created', 'task.updated', 'task.completed',
  'message.sent', 'file.uploaded',
  'meeting.started', 'meeting.completed',
  'integration.connected', 'integration.disconnected', '*'
];

const AI_PROVIDERS = [
  { id: 'gemini', label: 'Gemini', icon: '✨', desc: 'Google Gemini (default for Chttrix)' },
  { id: 'openai', label: 'ChatGPT', icon: '🤖', desc: 'OpenAI GPT-4 / GPT-3.5' },
  { id: 'claude', label: 'Claude', icon: '🎭', desc: 'Anthropic Claude 3' },
  { id: 'local_llm', label: 'Local LLM', icon: '🖥️', desc: 'Ollama or custom endpoint' },
];

const STATUS_BADGE = {
  connected: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle, label: 'Connected' },
  disconnected: { color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', icon: XCircle, label: 'Disconnected' },
  error: { color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle, label: 'Error' },
};

// ─── Sub-component: Integration Card ─────────────────────────────────────────
function IntegrationCard({ provider, integration, workspaceId, onRefresh }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState({});
  const [showFields, setShowFields] = useState({});

  const isConnected = integration?.status === 'connected';
  const statusInfo = STATUS_BADGE[integration?.status || 'disconnected'];
  const StatusIcon = statusInfo.icon;

  // Webhook URL for this integration type
  const webhookEndpoint = `${window.location.protocol}//${window.location.hostname}:5000/api/v2/integrations/webhook/${provider.type}?workspaceId=${workspaceId}`;

  const handleConnect = async () => {
    const missingRequired = provider.fields.filter(f => !f.label.includes('optional') && !fields[f.key]);
    if (missingRequired.length > 0) {
      showToast(`Please fill in: ${missingRequired.map(f => f.label).join(', ')}`, 'error');
      return;
    }
    setLoading(true);
    try {
      await connectIntegration({ workspaceId, type: provider.type, config: fields, label: provider.label });
      showToast(`${provider.label} connected`, 'success');
      onRefresh();
      setOpen(false);
      setFields({});
    } catch (err) {
      showToast(err.response?.data?.message || `Failed to connect ${provider.label}`, 'error');
    } finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await disconnectIntegration(workspaceId, provider.type);
      showToast(`${provider.label} disconnected`, 'success');
      onRefresh();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to disconnect', 'error');
    } finally { setLoading(false); }
  };

  return (
    <div className={`rounded-xl border transition-all ${isConnected
      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10'
      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}
    >
      <div className="flex items-center gap-3 p-4">
        <span className="text-2xl">{provider.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">{provider.label}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusInfo.color}`}>
              <StatusIcon size={10} />
              {statusInfo.label}
            </span>
          </div>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{provider.desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="px-3 py-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
            >
              {loading ? <RefreshCw size={12} className="animate-spin" /> : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={() => setOpen(o => !o)}
              className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Connect
            </button>
          )}
          {isConnected && (
            <button onClick={() => setOpen(o => !o)} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable config / webhook panel */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3">
          {!isConnected && provider.fields.map(field => (
            <div key={field.key}>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">{field.label}</label>
              <div className="relative">
                <input
                  type={field.type === 'password' && !showFields[field.key] ? 'password' : 'text'}
                  value={fields[field.key] || ''}
                  onChange={e => setFields(f => ({ ...f, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 pr-9 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                  placeholder={`Enter ${field.label}`}
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowFields(f => ({ ...f, [field.key]: !f[field.key] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showFields[field.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {!isConnected && (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-2 text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <><RefreshCw size={13} className="animate-spin" /> Connecting…</> : `Connect ${provider.label}`}
            </button>
          )}

          {isConnected && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Incoming Webhook URL</p>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                <code className="flex-1 text-[11px] text-blue-600 dark:text-blue-400 break-all font-mono">{webhookEndpoint}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(webhookEndpoint); showToast('Copied!', 'success'); }}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0"
                  title="Copy URL"
                >
                  <Link2 size={13} />
                </button>
              </div>
              <p className="text-[11px] text-gray-400">Configure this URL in your {provider.label} webhook settings.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Webhook Manager ──────────────────────────────────────────
function WebhookManager({ workspaceId }) {
  const { showToast } = useToast();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ event: 'task.created', url: '' });

  const load = useCallback(async () => {
    try { setWebhooks(await getWebhooks(workspaceId)); } catch { /* empty */ }
  }, [workspaceId]);

  useEffect(() => { if (workspaceId) load(); }, [workspaceId, load]);

  const handleCreate = async () => {
    if (!form.url) { showToast('URL is required', 'error'); return; }
    setLoading(true);
    try {
      await createWebhook({ workspaceId, event: form.event, url: form.url });
      showToast('Webhook created', 'success');
      setForm({ event: 'task.created', url: '' });
      setShowForm(false);
      load();
    } catch (err) { showToast(err.response?.data?.message || 'Failed to create webhook', 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { await deleteWebhook(id); showToast('Webhook deleted', 'success'); load(); }
    catch { showToast('Failed to delete', 'error'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Outgoing Webhooks</h3>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">POST to your URL when workspace events occur</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus size={13} /> Add Webhook
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">Event</label>
            <select
              value={form.event}
              onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-gray-100"
            >
              {WEBHOOK_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint URL</label>
            <input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com/webhook"
              className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={loading}
              className="flex-1 py-2 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
              {loading ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />} Create
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 text-[12px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-[13px]">
          <Zap size={28} className="mx-auto mb-2 opacity-30" />
          No webhooks configured yet
        </div>
      ) : (
        <div className="space-y-2">
          {webhooks.map(wh => (
            <div key={wh._id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
              <span className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded-md ${wh.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-400'}`}>
                {wh.event}
              </span>
              <code className="flex-1 text-[11px] text-blue-600 dark:text-blue-400 truncate font-mono">{wh.url}</code>
              {wh.lastStatusCode && (
                <span className={`text-[11px] font-medium ${wh.lastStatusCode < 300 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {wh.lastStatusCode}
                </span>
              )}
              <button onClick={() => handleDelete(wh._id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: AI Provider Panel ────────────────────────────────────────
function AIProvidersPanel({ workspaceId }) {
  const { showToast } = useToast();
  const [providers, setProviders] = useState([]);
  const [connecting, setConnecting] = useState(null);
  const [fields, setFields] = useState({});
  const [openForm, setOpenForm] = useState(null);

  const load = useCallback(async () => {
    try { setProviders(await getAIProviders(workspaceId)); } catch { /* empty */ }
  }, [workspaceId]);

  useEffect(() => { if (workspaceId) load(); }, [workspaceId, load]);

  const getRecord = (id) => providers.find(p => p.provider === id);

  const handleConnect = async (providerId) => {
    const apiKey = fields[`${providerId}_apiKey`];
    if (!apiKey) { showToast('API Key is required', 'error'); return; }
    setConnecting(providerId);
    try {
      const config = {};
      if (fields[`${providerId}_endpoint`]) config.endpoint = fields[`${providerId}_endpoint`];
      await connectAIProvider({ workspaceId, provider: providerId, apiKey, config });
      showToast(`${providerId} connected`, 'success');
      setOpenForm(null);
      setFields({});
      load();
    } catch (err) { showToast(err.response?.data?.message || 'Failed to connect', 'error'); }
    finally { setConnecting(null); }
  };

  const handleSwitch = async (providerId) => {
    setConnecting(providerId);
    try {
      await switchAIProvider(workspaceId, providerId);
      showToast(`Switched to ${providerId}`, 'success');
      load();
    } catch (err) { showToast(err.response?.data?.message || 'Failed to switch', 'error'); }
    finally { setConnecting(null); }
  };

  const handleDisconnect = async (providerId) => {
    setConnecting(providerId);
    try {
      await disconnectAIProvider(workspaceId, providerId);
      showToast(`${providerId} disconnected`, 'success');
      load();
    } catch (err) { showToast('Failed to disconnect', 'error'); }
    finally { setConnecting(null); }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Providers</h3>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">Connect and switch AI providers dynamically — Chttrix will fallback through the chain automatically</p>
      </div>
      <div className="grid gap-3">
        {AI_PROVIDERS.map(p => {
          const record = getRecord(p.id);
          const isConnected = record?.status === 'active';
          const isDefault = record?.isDefault;
          const isLoading = connecting === p.id;
          const isFormOpen = openForm === p.id;

          return (
            <div key={p.id} className={`rounded-xl border transition-all ${isDefault ? 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10' : isConnected ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
              <div className="flex items-center gap-3 p-4">
                <span className="text-2xl">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.label}</span>
                    {isDefault && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-violet-600 text-white rounded-full">Active</span>}
                    {isConnected && !isDefault && <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full">Connected</span>}
                  </div>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{p.desc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isConnected ? (
                    <button onClick={() => setOpenForm(isFormOpen ? null : p.id)}
                      className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                      Connect
                    </button>
                  ) : (
                    <>
                      {!isDefault && (
                        <button onClick={() => handleSwitch(p.id)} disabled={isLoading}
                          className="px-3 py-1.5 text-[12px] font-medium text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50">
                          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : 'Set Active'}
                        </button>
                      )}
                      <button onClick={() => handleDisconnect(p.id)} disabled={isLoading}
                        className="px-3 py-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                        {isLoading ? <RefreshCw size={12} className="animate-spin" /> : 'Disconnect'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isFormOpen && !isConnected && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                    <input type="password"
                      value={fields[`${p.id}_apiKey`] || ''}
                      onChange={e => setFields(f => ({ ...f, [`${p.id}_apiKey`]: e.target.value }))}
                      placeholder={`Enter ${p.label} API key`}
                      className="w-full px-3 py-2 text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                    />
                  </div>
                  {p.id === 'local_llm' && (
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">Endpoint URL</label>
                      <input type="text"
                        value={fields[`${p.id}_endpoint`] || ''}
                        onChange={e => setFields(f => ({ ...f, [`${p.id}_endpoint`]: e.target.value }))}
                        placeholder="http://localhost:11434/api"
                        className="w-full px-3 py-2 text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleConnect(p.id)} disabled={isLoading}
                      className="flex-1 py-2 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1">
                      {isLoading ? <><RefreshCw size={12} className="animate-spin" /> Connecting…</> : `Connect ${p.label}`}
                    </button>
                    <button onClick={() => setOpenForm(null)}
                      className="px-4 py-2 text-[12px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main IntegrationsTab ─────────────────────────────────────────────────────
const IntegrationsTab = ({ workspaceId }) => {
  const [integrations, setIntegrations] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Developer');

  const loadIntegrations = useCallback(async () => {
    if (!workspaceId) return;
    try { setIntegrations(await getIntegrations(workspaceId)); }
    catch { /* ignore — workspace may not be selected */ }
  }, [workspaceId]);

  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  const getIntegration = (type) => integrations.find(i => i.type === type);

  const currentCatalogue = PROVIDER_CATALOGUE.find(c => c.category === activeCategory);

  if (!workspaceId) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Cloud size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-[13px]">Select a workspace to manage integrations</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Integration Ecosystem</h2>
        <p className="text-[13px] text-gray-500 dark:text-gray-400">
          Connect Chttrix to your favourite tools. All integrations are workspace-level and event-driven.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {PROVIDER_CATALOGUE.map(cat => (
          <button
            key={cat.category}
            onClick={() => setActiveCategory(cat.category)}
            className={`px-4 py-2 rounded-xl text-[12.5px] font-semibold transition-all ${activeCategory === cat.category
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            {cat.category}
          </button>
        ))}
        <button
          onClick={() => setActiveCategory('Webhooks')}
          className={`px-4 py-2 rounded-xl text-[12.5px] font-semibold transition-all flex items-center gap-1.5 ${activeCategory === 'Webhooks'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        >
          <Zap size={12} /> Webhooks
        </button>
        <button
          onClick={() => setActiveCategory('AI')}
          className={`px-4 py-2 rounded-xl text-[12.5px] font-semibold transition-all flex items-center gap-1.5 ${activeCategory === 'AI'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
        >
          <Bot size={12} /> AI Providers
        </button>
      </div>

      {/* Content panels */}
      {activeCategory === 'Webhooks' ? (
        <WebhookManager workspaceId={workspaceId} />
      ) : activeCategory === 'AI' ? (
        <AIProvidersPanel workspaceId={workspaceId} />
      ) : currentCatalogue ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {currentCatalogue.category} Integrations
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full">
              {currentCatalogue.providers.length} providers
            </span>
          </div>
          {currentCatalogue.providers.map(provider => (
            <IntegrationCard
              key={provider.type}
              provider={provider}
              integration={getIntegration(provider.type)}
              workspaceId={workspaceId}
              onRefresh={loadIntegrations}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default IntegrationsTab;
