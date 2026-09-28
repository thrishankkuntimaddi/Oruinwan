import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KeyRound, Webhook, Bot, ShoppingBag, FileText, Terminal, Copy, Check, Plus,
  AlertTriangle, Lock, Send, Trash2, RefreshCw, ExternalLink, ShieldAlert
} from 'lucide-react';
import api from '@services/api';
import MarketplacePanel from '../../components/apps/MarketplacePanel';
import useIsWorkspaceAdmin from '../../components/apps/useIsWorkspaceAdmin';
import './DeveloperPortalPage.css';

const TABS = [
  { id: 'api-keys', label: 'API Keys', Icon: KeyRound },
  { id: 'webhooks', label: 'Webhooks', Icon: Webhook },
  { id: 'bots',     label: 'Bots',     Icon: Bot },
  { id: 'apps',     label: 'App Market', Icon: ShoppingBag },
  { id: 'docs',     label: 'Docs',     Icon: FileText },
];

// Keys are issued by the server as `<scheme>_<hex>`; the list only returns the first 12 chars.
const DEFAULT_KEY_SCHEME = 'chx_';
const schemeOf = (prefix) => {
  const m = /^([a-z0-9]+_)/i.exec(prefix || '');
  return m ? m[1] : null;
};

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.response?.data?.error || fallback;

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={copy} title="Copy to clipboard">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function Badge({ label, color = 'accent' }) {
  return <span className={`dp-badge dp-badge-${color}`}>{label}</span>;
}

function ErrorBox({ message, onRetry }) {
  return (
    <div className="dp-alert dp-alert-danger" role="alert">
      <div className="dp-alert-row"><AlertTriangle size={14} /><span>{message}</span></div>
      {onRetry && <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={onRetry}><RefreshCw size={12} />Retry</button>}
    </div>
  );
}

function ReadOnlyNotice({ children }) {
  return (
    <div className="dp-notice">
      <Lock size={14} />
      <span>{children}</span>
    </div>
  );
}

function SecretReveal({ title, value, onDismiss }) {
  return (
    <div className="dp-alert dp-alert-success">
      <div className="dp-alert-row"><ShieldAlert size={14} /><strong>{title}</strong></div>
      <p className="dp-alert-text">Save it now — it won’t be shown again.</p>
      <div className="dp-key-reveal">
        <code>{value}</code>
        <CopyButton value={value} />
      </div>
      <div><button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={onDismiss}>I’ve saved it</button></div>
    </div>
  );
}

function Skeleton({ rows = 2 }) {
  return <div className="dp-skeleton-list">{Array.from({ length: rows }).map((_, i) => <div key={i} className="dp-skeleton" />)}</div>;
}

/* ── API keys ───────────────────────────────────────────────────────────────── */

function ApiKeysTab({ workspaceId, isAdmin, onKeysChange }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  const loadKeys = useCallback(async () => {
    if (!isAdmin || !workspaceId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/api/developer/api-keys', { params: { workspaceId } });
      const list = res.data.keys || [];
      setKeys(list);
      onKeysChange?.(list);
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load API keys'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isAdmin, onKeysChange]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const createKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setActionError(null);
    try {
      const res = await api.post('/api/developer/api-keys', { workspaceId, name: newKeyName.trim() });
      setGeneratedKey(res.data.rawKey);
      setNewKeyName('');
      setShowCreate(false);
      loadKeys();
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to create key'));
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id) => {
    setActionError(null);
    try {
      await api.delete(`/api/developer/api-keys/${id}`);
      setConfirmRevoke(null);
      setGeneratedKey(null);
      setShowCreate(false);
      loadKeys();
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to revoke key'));
    }
  };

  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>API Keys</h2>
          <p>Use API keys to authenticate requests to the Oruinwan Public API.</p>
        </div>
        {isAdmin && !showCreate && (
          <button className="dp-btn dp-btn-primary" onClick={() => { setShowCreate(true); setGeneratedKey(null); }}>
            <Plus size={14} />Create Key
          </button>
        )}
      </div>

      {!isAdmin ? (
        <ReadOnlyNotice>API keys are managed by workspace owners and admins. Ask one of them if you need a key.</ReadOnlyNotice>
      ) : (
        <>
          {generatedKey && (
            <SecretReveal title="Your new API key" value={generatedKey} onDismiss={() => setGeneratedKey(null)} />
          )}

          {showCreate && (
            <form className="dp-form-inline" onSubmit={createKey}>
              <input
                className="dp-input"
                placeholder="Key name (e.g. Production, CI/CD)"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                maxLength={100}
                autoFocus
              />
              <button className="dp-btn dp-btn-primary" type="submit" disabled={creating || !newKeyName.trim()}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button className="dp-btn dp-btn-ghost" type="button" onClick={() => { setShowCreate(false); setNewKeyName(''); }}>Cancel</button>
            </form>
          )}

          {actionError && <ErrorBox message={actionError} />}

          {loading ? (
            <Skeleton rows={3} />
          ) : loadError ? (
            <ErrorBox message={loadError} onRetry={loadKeys} />
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
                      {k.permissions?.slice(0, 3).map(p => <Badge key={p} label={p} />)}
                      {k.permissions?.length > 3 && <Badge label={`+${k.permissions.length - 3}`} color="muted" />}
                    </div>
                    <span className="dp-card-sub">
                      Created {new Date(k.createdAt).toLocaleDateString()} · Used {k.usageCount || 0} times
                      {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleString()}` : ''}
                    </span>
                  </div>
                  {confirmRevoke === k._id ? (
                    <div className="dp-card-actions">
                      <span className="dp-card-sub">Revoke permanently?</span>
                      <button className="dp-btn dp-btn-danger" onClick={() => revokeKey(k._id)}>Revoke</button>
                      <button className="dp-btn dp-btn-ghost" onClick={() => setConfirmRevoke(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="dp-btn dp-btn-danger-ghost" onClick={() => setConfirmRevoke(k._id)}>Revoke</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Webhooks ───────────────────────────────────────────────────────────────── */

function WebhooksTab({ workspaceId, isAdmin, events, eventsError }) {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', events: [] });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [newSecret, setNewSecret] = useState(null);
  const [busy, setBusy] = useState({});
  const [testResults, setTestResults] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/api/v2/integrations/webhooks', { params: { workspaceId } });
      setHooks(res.data.webhooks || []);
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load webhooks'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const allSelected = form.events.includes('*');
  const toggleEvent = (ev) => {
    setForm(f => {
      if (ev === '*') return { ...f, events: f.events.includes('*') ? [] : ['*'] };
      const rest = f.events.filter(e => e !== '*');
      return { ...f, events: rest.includes(ev) ? rest.filter(e => e !== ev) : [...rest, ev] };
    });
  };

  const createHook = async (e) => {
    e.preventDefault();
    if (!form.url.trim()) return setFormError('Enter an endpoint URL');
    if (!form.events.length) return setFormError('Choose at least one event');
    setCreating(true);
    setFormError(null);
    try {
      const res = await api.post('/api/v2/integrations/webhooks', { workspaceId, url: form.url.trim(), events: form.events });
      setNewSecret(res.data.webhook?.secret || null);
      setShowCreate(false);
      setForm({ url: '', events: [] });
      load();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to create webhook'));
    } finally {
      setCreating(false);
    }
  };

  const setHookBusy = (id, v) => setBusy(b => ({ ...b, [id]: v }));

  const toggleActive = async (hook) => {
    setHookBusy(hook._id, 'toggle');
    setActionError(null);
    try {
      const res = await api.patch(`/api/v2/integrations/webhooks/${hook._id}`, { active: !hook.isActive });
      const updated = res.data.webhook;
      setHooks(prev => prev.map(h => (h._id === hook._id ? { ...h, ...updated } : h)));
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to update webhook'));
    } finally {
      setHookBusy(hook._id, null);
    }
  };

  const sendTest = async (hook) => {
    setHookBusy(hook._id, 'test');
    setActionError(null);
    try {
      const res = await api.post(`/api/v2/integrations/webhooks/${hook._id}/test`);
      setTestResults(r => ({ ...r, [hook._id]: { ...res.data, at: Date.now() } }));
      load();
    } catch (err) {
      setTestResults(r => ({ ...r, [hook._id]: { ok: false, error: errorMessage(err, 'Test failed'), at: Date.now() } }));
    } finally {
      setHookBusy(hook._id, null);
    }
  };

  const deleteHook = async (id) => {
    setActionError(null);
    try {
      await api.delete(`/api/v2/integrations/webhooks/${id}`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to delete webhook'));
    }
  };

  const describeTest = (r) => {
    if (r.error) return r.error;
    if (r.ok) return `Delivered — endpoint answered ${r.status}`;
    return r.status ? `Failed — endpoint answered ${r.status}` : 'Failed — endpoint unreachable';
  };

  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>Webhooks</h2>
          <p>Subscribe to workspace events and receive signed HTTP POSTs at your endpoint.</p>
        </div>
        {isAdmin && !showCreate && (
          <button className="dp-btn dp-btn-primary" onClick={() => { setShowCreate(true); setFormError(null); setNewSecret(null); }}>
            <Plus size={14} />Add Webhook
          </button>
        )}
      </div>

      {!isAdmin && (
        <ReadOnlyNotice>Only workspace owners and admins can add, test or change webhooks. You can see which endpoints are subscribed.</ReadOnlyNotice>
      )}

      {newSecret && (
        <SecretReveal title="Webhook signing secret" value={newSecret} onDismiss={() => setNewSecret(null)} />
      )}

      {isAdmin && showCreate && (
        <form className="dp-card dp-form-block" onSubmit={createHook}>
          <label className="dp-label" htmlFor="dp-webhook-url">Endpoint URL</label>
          <input id="dp-webhook-url" className="dp-input" placeholder="https://your-server.com/webhook" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} autoFocus />
          <span className="dp-label" style={{ marginTop: 12 }}>Events to subscribe</span>
          {eventsError ? (
            <ErrorBox message={eventsError} />
          ) : !events ? (
            <span className="dp-card-sub">Loading events…</span>
          ) : (
            <div className="dp-events-grid">
              <label className="dp-event-check">
                <input type="checkbox" checked={allSelected} onChange={() => toggleEvent('*')} />
                <span><code>*</code><span className="dp-event-desc">All events, including ones added later</span></span>
              </label>
              {events.map(({ event, description }) => (
                <label key={event} className={`dp-event-check${allSelected ? ' disabled' : ''}`}>
                  <input type="checkbox" disabled={allSelected} checked={allSelected || form.events.includes(event)} onChange={() => toggleEvent(event)} />
                  <span><code>{event}</code><span className="dp-event-desc">{description}</span></span>
                </label>
              ))}
            </div>
          )}
          {formError && <ErrorBox message={formError} />}
          <div className="dp-form-actions">
            <button className="dp-btn dp-btn-primary" type="submit" disabled={creating}>{creating ? 'Saving…' : 'Create Webhook'}</button>
            <button className="dp-btn dp-btn-ghost" type="button" onClick={() => { setShowCreate(false); setFormError(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {actionError && <ErrorBox message={actionError} />}

      {loading ? (
        <Skeleton rows={2} />
      ) : loadError ? (
        <ErrorBox message={loadError} onRetry={load} />
      ) : hooks.length === 0 ? (
        <div className="dp-empty">No webhooks configured.</div>
      ) : (
        <div className="dp-card-list">
          {hooks.map(h => {
            const result = testResults[h._id];
            const hookEvents = Array.isArray(h.events) ? h.events : (h.event ? [h.event] : []);
            return (
              <div key={h._id} className="dp-card" data-testid="webhook-card">
                <div className="dp-card-info">
                  <span className="dp-card-title dp-break">{h.url || 'Hidden endpoint'}</span>
                  <div className="dp-card-meta">
                    {hookEvents.map(ev => <Badge key={ev} label={ev === '*' ? 'all events' : ev} />)}
                    <Badge label={h.isActive ? 'Active' : 'Paused'} color={h.isActive ? 'success' : 'muted'} />
                  </div>
                  {(h.lastTriggeredAt || h.lastStatusCode !== undefined) && (
                    <span className="dp-card-sub">
                      {h.lastTriggeredAt ? `Last delivery ${new Date(h.lastTriggeredAt).toLocaleString()}` : ''}
                      {h.lastStatusCode !== undefined && h.lastStatusCode !== null ? ` · status ${h.lastStatusCode || 'unreachable'}` : ''}
                    </span>
                  )}
                  {result && (
                    <span className={`dp-test-result ${result.ok ? 'ok' : 'fail'}`} role="status">
                      {result.ok ? <Check size={12} /> : <AlertTriangle size={12} />}
                      {describeTest(result)}
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <div className="dp-card-actions">
                    <label className="dp-switch" title={h.isActive ? 'Pause deliveries' : 'Resume deliveries'}>
                      <input type="checkbox" checked={!!h.isActive} disabled={!!busy[h._id]} onChange={() => toggleActive(h)} aria-label="Active" />
                      <span className="dp-switch-track" />
                      <span className="dp-switch-label">{h.isActive ? 'On' : 'Off'}</span>
                    </label>
                    <button className="dp-btn dp-btn-ghost" onClick={() => sendTest(h)} disabled={!!busy[h._id]}>
                      <Send size={13} />{busy[h._id] === 'test' ? 'Sending…' : 'Send test'}
                    </button>
                    {confirmDelete === h._id ? (
                      <>
                        <button className="dp-btn dp-btn-danger" onClick={() => deleteHook(h._id)}>Delete</button>
                        <button className="dp-btn dp-btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="dp-btn dp-btn-danger-ghost" onClick={() => setConfirmDelete(h._id)} title="Delete webhook"><Trash2 size={13} />Delete</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Bots ───────────────────────────────────────────────────────────────────── */

function BotsTab({ workspaceId, isAdmin }) {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [generatedToken, setGeneratedToken] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [channels, setChannels] = useState(null);
  const [testMsg, setTestMsg] = useState({ botId: null, text: '', channelId: '' });
  const [testState, setTestState] = useState(null); // { botId, sending?, ok?, message }
  const [confirmRemove, setConfirmRemove] = useState(null);

  const load = useCallback(async () => {
    if (!isAdmin || !workspaceId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/api/developer/bots', { params: { workspaceId } });
      setBots(res.data.bots || []);
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to load bots'));
    } finally { setLoading(false); }
  }, [workspaceId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const loadChannels = useCallback(async () => {
    if (channels) return;
    try {
      const res = await api.get('/api/channels/my', { params: { workspaceId } });
      setChannels((res.data.channels || []).filter(c => !c.isArchived && !c.isDM));
    } catch {
      setChannels([]);
    }
  }, [channels, workspaceId]);

  const createBot = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    setActionError(null);
    try {
      const res = await api.post('/api/developer/bots', { workspaceId, name: form.name.trim(), description: form.description.trim() });
      setGeneratedToken(res.data.rawToken);
      setShowCreate(false);
      setForm({ name: '', description: '' });
      load();
    } catch (err) {
      setActionError(errorMessage(err, 'Failed to create bot'));
    } finally { setCreating(false); }
  };

  const openTest = (botId) => {
    setTestState(null);
    setTestMsg(t => (t.botId === botId ? { botId: null, text: '', channelId: '' } : { botId, text: 'Hello from the Developer Platform', channelId: t.channelId }));
    loadChannels();
  };

  const sendTestMsg = async (botId) => {
    if (!testMsg.channelId || !testMsg.text.trim()) {
      setTestState({ botId, ok: false, message: 'Choose a channel and enter a message' });
      return;
    }
    setTestState({ botId, sending: true });
    try {
      await api.post(`/api/developer/bots/${botId}/message`, { channelId: testMsg.channelId, text: testMsg.text.trim() });
      const ch = (channels || []).find(c => c._id === testMsg.channelId);
      setTestState({ botId, ok: true, message: `Message sent to #${ch?.name || 'channel'}` });
      load();
    } catch (err) {
      setTestState({ botId, ok: false, message: errorMessage(err, 'Failed to send message') });
    }
  };

  const deleteBot = async (id) => {
    setActionError(null);
    try {
      await api.delete(`/api/developer/bots/${id}`);
      setConfirmRemove(null);
      load();
    } catch (err) { setActionError(errorMessage(err, 'Failed to deactivate bot')); }
  };

  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>Bots</h2>
          <p>Create bots that can read and send messages in your workspace channels.</p>
        </div>
        {isAdmin && !showCreate && (
          <button className="dp-btn dp-btn-primary" onClick={() => { setShowCreate(true); setGeneratedToken(null); }}><Plus size={14} />Create Bot</button>
        )}
      </div>

      {!isAdmin ? (
        <ReadOnlyNotice>Bots are managed by workspace owners and admins.</ReadOnlyNotice>
      ) : (
        <>
          {generatedToken && (
            <SecretReveal title="Your new bot token" value={generatedToken} onDismiss={() => setGeneratedToken(null)} />
          )}

          {showCreate && (
            <form className="dp-card dp-form-block" onSubmit={createBot}>
              <label className="dp-label" htmlFor="dp-bot-name">Bot Name</label>
              <input id="dp-bot-name" className="dp-input" placeholder="e.g. DeployBot" value={form.name} maxLength={80} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
              <label className="dp-label" htmlFor="dp-bot-desc" style={{ marginTop: 12 }}>Description</label>
              <input id="dp-bot-desc" className="dp-input" placeholder="What does this bot do?" value={form.description} maxLength={300} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div className="dp-form-actions">
                <button className="dp-btn dp-btn-primary" type="submit" disabled={creating || !form.name.trim()}>{creating ? 'Creating…' : 'Create Bot'}</button>
                <button className="dp-btn dp-btn-ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          )}

          {actionError && <ErrorBox message={actionError} />}

          {loading ? (
            <Skeleton rows={2} />
          ) : loadError ? (
            <ErrorBox message={loadError} onRetry={load} />
          ) : bots.length === 0 ? (
            <div className="dp-empty">No bots yet.</div>
          ) : (
            <div className="dp-card-list">
              {bots.map(bot => {
                const canWrite = (bot.permissions || []).some(p => p === 'messages:write' || p === '*');
                const state = testState?.botId === bot._id ? testState : null;
                return (
                  <div key={bot._id} className="dp-card">
                    <div className="dp-bot-avatar"><Bot size={18} /></div>
                    <div className="dp-card-info">
                      <span className="dp-card-title">{bot.name}</span>
                      {bot.description && <span className="dp-card-sub">{bot.description}</span>}
                      <code className="dp-prefix">{bot.tokenPrefix}••••••••</code>
                      <div className="dp-card-meta">
                        {bot.permissions?.map(p => <Badge key={p} label={p} />)}
                      </div>
                      <span className="dp-card-sub">{bot.messageCount || 0} message{bot.messageCount === 1 ? '' : 's'} sent</span>
                    </div>
                    <div className="dp-card-actions">
                      <button className="dp-btn dp-btn-ghost" onClick={() => openTest(bot._id)} disabled={!canWrite}
                        title={canWrite ? 'Post a test message as this bot' : 'This bot does not have the messages:write permission'}>
                        {testMsg.botId === bot._id ? 'Cancel' : 'Test'}
                      </button>
                      {confirmRemove === bot._id ? (
                        <>
                          <button className="dp-btn dp-btn-danger" onClick={() => deleteBot(bot._id)}>Remove</button>
                          <button className="dp-btn dp-btn-ghost" onClick={() => setConfirmRemove(null)}>Keep</button>
                        </>
                      ) : (
                        <button className="dp-btn dp-btn-danger-ghost" onClick={() => setConfirmRemove(bot._id)}>Remove</button>
                      )}
                    </div>
                    {testMsg.botId === bot._id && (
                      <div className="dp-test-msg-row">
                        <select className="dp-input" aria-label="Channel" value={testMsg.channelId} onChange={e => setTestMsg(t => ({ ...t, channelId: e.target.value }))}>
                          <option value="">{channels ? (channels.length ? 'Choose a channel…' : 'No channels available') : 'Loading channels…'}</option>
                          {(channels || []).map(c => <option key={c._id} value={c._id}>#{c.name}</option>)}
                        </select>
                        <input className="dp-input" placeholder="Message text" aria-label="Message text" value={testMsg.text} maxLength={4000} onChange={e => setTestMsg(t => ({ ...t, text: e.target.value }))} />
                        <button className="dp-btn dp-btn-primary" onClick={() => sendTestMsg(bot._id)} disabled={state?.sending}>
                          <Send size={13} />{state?.sending ? 'Sending…' : 'Send'}
                        </button>
                        <span className="dp-card-sub dp-full">Posts a real message in the channel, sent by you and labelled with the bot’s name.</span>
                        {state && !state.sending && (
                          <span className={`dp-test-result ${state.ok ? 'ok' : 'fail'}`} role="status">
                            {state.ok ? <Check size={12} /> : <AlertTriangle size={12} />}{state.message}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── App market (same component as the Apps page) ──────────────────────────── */

function AppsTab({ workspaceId, isAdmin }) {
  const navigate = useNavigate();
  return (
    <div className="dp-tab-content">
      <div className="dp-section-header">
        <div>
          <h2>App Marketplace</h2>
          <p>The same marketplace as the workspace Apps page.</p>
        </div>
        <button className="dp-btn dp-btn-ghost" onClick={() => navigate(`/workspace/${workspaceId}/apps`)}>
          <ExternalLink size={13} />Open Apps page
        </button>
      </div>
      <MarketplacePanel workspaceId={workspaceId} canManage={isAdmin} />
    </div>
  );
}

/* ── Docs ───────────────────────────────────────────────────────────────────── */

function DocsTab({ keyScheme, samplePrefix, events }) {
  const [activeSection, setActiveSection] = useState('quickstart');
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-oruinwan-instance.com';
  const exampleKey = `${keyScheme}your_key_here`;
  const eventRows = events && events.length
    ? events.map(e => [e.event, e.description])
    : [['task.created', 'A task was created'], ['task.updated', 'A task was updated'], ['task.completed', 'A task was marked done'], ['message.sent', 'A message was posted in a public channel']];

  const sections = {
    quickstart: {
      title: 'Quick Start',
      content: (
        <div>
          <p>Get started with the Oruinwan Public API in 2 minutes.</p>
          <h4>1. Create an API key</h4>
          <p>
            A workspace owner or admin creates a key in the <strong>API Keys</strong> tab. Keys are issued with the
            prefix <code>{keyScheme}</code>{samplePrefix ? <> (for example <code>{samplePrefix}••••</code>)</> : null} and are shown in full only once.
          </p>
          <h4>2. Make your first request</h4>
          <p>The key already belongs to one workspace, so no workspace id is needed.</p>
          <pre><code>{`curl -H "X-Api-Key: ${exampleKey}" \\
  "${baseUrl}/api/public/channels"`}</code></pre>
          <h4>3. Use the SDK</h4>
          <pre><code>{`// Node.js / Browser
const OruinwanSDK = require('./oruinwan-sdk');
const client = new OruinwanSDK({
  apiKey: '${exampleKey}',
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
          <pre><code>{`X-Api-Key: ${exampleKey}`}</code></pre>
          <p>API keys are workspace-scoped: every request operates within the key’s workspace.</p>
          <h4>Permissions</h4>
          <table className="dp-docs-table">
            <thead><tr><th>Permission</th><th>Access</th></tr></thead>
            <tbody>
              {[
                ['messages:read', 'Read message metadata (content is end-to-end encrypted)'],
                ['tasks:read', 'Read tasks'],
                ['tasks:write', 'Create tasks'],
                ['files:read', 'Read files'],
                ['users:read', 'Read workspace members'],
                ['channels:read', 'Read public channels'],
                ['*', 'Full access'],
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
            { method: 'GET', path: '/api/public/messages', desc: 'List recent message metadata in public channels', params: 'limit, channelId' },
            { method: 'GET', path: '/api/public/tasks', desc: 'List tasks', params: 'limit, status' },
            { method: 'POST', path: '/api/public/tasks', desc: 'Create a task', params: 'title, description, priority, dueDate, assigneeId' },
            { method: 'GET', path: '/api/public/files', desc: 'List files', params: 'limit' },
            { method: 'GET', path: '/api/public/users', desc: 'List workspace members', params: '-' },
            { method: 'GET', path: '/api/public/channels', desc: 'List public channels', params: '-' },
          ].map(ep => (
            <div key={`${ep.method} ${ep.path}`} className="dp-endpoint">
              <span className={`dp-method dp-method-${ep.method.toLowerCase()}`}>{ep.method}</span>
              <code className="dp-endpoint-path">{ep.path}</code>
              <p>{ep.desc}</p>
              {ep.params !== '-' && <p className="dp-endpoint-params">{ep.method === 'POST' ? 'Body' : 'Query params'}: <code>{ep.params}</code></p>}
            </div>
          ))}
          <h4 style={{ marginTop: 24 }}>Errors and rate limits</h4>
          <p>Errors are JSON: <code>{'{ "message": "..." }'}</code>. The public API allows <strong>100 requests / minute</strong> per API key.</p>
        </div>
      )
    },
    webhooks: {
      title: 'Webhook Events',
      content: (
        <div>
          <p>When an event occurs, Oruinwan POSTs a JSON payload to your endpoint with these headers:</p>
          <pre><code>{`X-Chttrix-Event: task.created
X-Chttrix-Signature: sha256=<hmac>
X-Chttrix-Delivery: <webhook-id>`}</code></pre>
          <p className="dp-docs-note">
            These are legacy header names kept for compatibility with existing receivers; they are the wire contract and will not change.
            Verify <code>X-Chttrix-Signature</code> as an HMAC-SHA256 of the raw request body using the signing secret shown when the webhook was created.
          </p>
          <h4>Payload shape</h4>
          <pre><code>{`{
  "event": "task.created",
  "workspaceId": "...",
  "data": { /* event-specific data */ },
  "timestamp": "2026-03-27T14:00:00.000Z"
}`}</code></pre>
          <h4>Available events</h4>
          <table className="dp-docs-table">
            <thead><tr><th>Event</th><th>Triggered when</th></tr></thead>
            <tbody>
              {[...eventRows, ['*', 'All of the above'], ['webhook.test', 'Sent by “Send test” in the Webhooks tab']].map(([e, d]) => (
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
          <pre><code>{`# Copy sdk/js/oruinwan-sdk.js into your project
# or serve it as a static file`}</code></pre>
          <h4>Initialization</h4>
          <pre><code>{`const client = new OruinwanSDK({
  apiKey: '${exampleKey}',
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

export default function DeveloperPortalPage({ workspaceId }) {
  const [activeTab, setActiveTab] = useState('api-keys');
  const [keyPrefixes, setKeyPrefixes] = useState([]);
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);

  const wsId = workspaceId || new URLSearchParams(window.location.search).get('workspaceId') || '';
  const isAdmin = useIsWorkspaceAdmin(wsId);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/v2/integrations/webhooks/events')
      .then(res => { if (!cancelled) setEvents(res.data.events || []); })
      .catch(err => { if (!cancelled) setEventsError(errorMessage(err, 'Failed to load webhook events')); });
    return () => { cancelled = true; };
  }, []);

  const onKeysChange = useCallback((keys) => setKeyPrefixes(keys.map(k => k.keyPrefix).filter(Boolean)), []);
  const samplePrefix = keyPrefixes[0] || null;
  const keyScheme = schemeOf(samplePrefix) || DEFAULT_KEY_SCHEME;

  return (
    <div className="dp-root">
      <div className="dp-header">
        <div className="dp-header-content">
          <div className="dp-header-icon"><Terminal size={22} /></div>
          <div>
            <h1>Developer Platform</h1>
            <p>Build integrations, automate workflows, and extend Oruinwan for your team.</p>
          </div>
        </div>
      </div>

      <div className="dp-tabs" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            className={`dp-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} className="dp-tab-icon" />
            {label}
          </button>
        ))}
      </div>

      <div className="dp-body">
        <div className="dp-body-inner">
          {isAdmin === undefined && activeTab !== 'docs' ? <Skeleton rows={3} /> : <>
          {activeTab === 'api-keys' && <ApiKeysTab workspaceId={wsId} isAdmin={isAdmin} onKeysChange={onKeysChange} />}
          {activeTab === 'webhooks' && <WebhooksTab workspaceId={wsId} isAdmin={isAdmin} events={events} eventsError={eventsError} />}
          {activeTab === 'bots'     && <BotsTab     workspaceId={wsId} isAdmin={isAdmin} />}
          {activeTab === 'apps'     && <AppsTab     workspaceId={wsId} isAdmin={isAdmin} />}
          {activeTab === 'docs'     && <DocsTab keyScheme={keyScheme} samplePrefix={samplePrefix} events={events} />}
          </>}
        </div>
      </div>
    </div>
  );
}
