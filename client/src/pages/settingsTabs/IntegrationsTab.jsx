// IntegrationsTab — Monolith Flow design system
import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, Zap, Bot, Link2, Plus, Trash2, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { getIntegrations, connectIntegration, disconnectIntegration, getWebhooks, createWebhook, deleteWebhook, getAIProviders, connectAIProvider, switchAIProvider, disconnectAIProvider } from '../../services/integrations.service';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

// ── Provider catalogue ────────────────────────────────────────────────────────
const PROVIDER_CATALOGUE = [
    { category: 'Developer', providers: [
        { type: 'github',   label: 'GitHub',        icon: '🐙', desc: 'Sync issues → tasks, PRs → activity',       fields: [{ key: 'token',         label: 'Personal Access Token', type: 'password' }] },
        { type: 'gitlab',   label: 'GitLab',        icon: '🦊', desc: 'Webhook for issues & merge requests',       fields: [{ key: 'token',         label: 'Access Token',           type: 'password' }, { key: 'webhookSecret', label: 'Webhook Secret', type: 'password' }] },
        { type: 'bitbucket',label: 'Bitbucket',     icon: '🪣', desc: 'Push events & issue creation',             fields: [{ key: 'appPassword',   label: 'App Password',           type: 'password' }] },
        { type: 'linear',   label: 'Linear',        icon: '◑',  desc: 'Sync Linear issues as tasks',              fields: [{ key: 'apiKey',        label: 'API Key',                type: 'password' }] },
        { type: 'jira',     label: 'Jira',          icon: '🔷', desc: 'Sync Jira issues, project tracking',       fields: [{ key: 'token',         label: 'API Token',              type: 'password' }, { key: 'baseUrl', label: 'Base URL', type: 'text' }] },
        { type: 'cicd',     label: 'CI/CD Pipeline',icon: '⚙️', desc: 'Generic CI/CD webhook (GH Actions)',       fields: [{ key: 'webhookSecret', label: 'Webhook Secret (optional)', type: 'password' }] },
    ]},
    { category: 'Productivity', providers: [
        { type: 'google_drive', label: 'Google Drive', icon: '📁', desc: 'Attach Drive files to workspace', fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
        { type: 'onedrive',     label: 'OneDrive',     icon: '☁️', desc: 'Attach OneDrive files',           fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
        { type: 'dropbox',      label: 'Dropbox',      icon: '📦', desc: 'Attach Dropbox files',            fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
        { type: 'notion',       label: 'Notion',       icon: '📝', desc: 'Attach Notion pages',             fields: [{ key: 'token',       label: 'Integration Token',   type: 'password' }] },
        { type: 'confluence',   label: 'Confluence',   icon: '📚', desc: 'Attach Confluence pages',         fields: [{ key: 'token',       label: 'API Token',           type: 'password' }, { key: 'baseUrl', label: 'Base URL', type: 'text' }] },
    ]},
    { category: 'Communication', providers: [
        { type: 'slack',        label: 'Slack',             icon: '💬', desc: 'Bridge messages Slack ↔ Chttrix',       fields: [{ key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'text' }] },
        { type: 'zoom',         label: 'Zoom',              icon: '📹', desc: 'Create Zoom meetings from Chttrix',     fields: [{ key: 'apiKey',     label: 'API Key',              type: 'password' }, { key: 'apiSecret', label: 'API Secret', type: 'password' }] },
        { type: 'google_meet',  label: 'Google Meet',       icon: '🎥', desc: 'Create Meet links from Chttrix',       fields: [{ key: 'accessToken', label: 'OAuth Access Token', type: 'password' }] },
        { type: 'teams',        label: 'Microsoft Teams',   icon: '💼', desc: 'Bridge messages via Teams webhooks',   fields: [{ key: 'webhookUrl',  label: 'Incoming Webhook URL', type: 'text' }] },
    ]},
    { category: 'Automation', providers: [
        { type: 'zapier', label: 'Zapier',            icon: '⚡', desc: 'Trigger Zapier zaps from Chttrix events', fields: [{ key: 'webhookUrl', label: 'Zapier Webhook URL', type: 'text' }] },
        { type: 'make',   label: 'Make (Integromat)', icon: '🔗', desc: 'Connect Make.com scenarios',             fields: [{ key: 'webhookUrl', label: 'Make Webhook URL',   type: 'text' }] },
        { type: 'n8n',    label: 'n8n',               icon: '🔄', desc: 'Trigger n8n workflows',                  fields: [{ key: 'webhookUrl', label: 'n8n Webhook URL',    type: 'text' }] },
    ]},
];

const WEBHOOK_EVENTS = ['task.created', 'task.updated', 'task.completed', 'message.sent', 'file.uploaded', 'meeting.started', 'meeting.completed', 'integration.connected', 'integration.disconnected', '*'];

const AI_PROVIDERS = [
    { id: 'gemini',    label: 'Gemini',    icon: '✨', desc: 'Google Gemini (default for Chttrix)' },
    { id: 'openai',    label: 'ChatGPT',   icon: '🤖', desc: 'OpenAI GPT-4 / GPT-3.5' },
    { id: 'claude',    label: 'Claude',    icon: '🎭', desc: 'Anthropic Claude 3' },
    { id: 'local_llm', label: 'Local LLM', icon: '🖥️', desc: 'Ollama or custom endpoint' },
];

// ── Shared input style ────────────────────────────────────────────────────────
const inputS = {
    width: '100%', padding: '7px 10px',
    backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)',
    borderRadius: 2, fontSize: 13, color: 'var(--text-primary)',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 150ms ease', ...S.font,
};

// ── StatusBadge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        connected:    { Icon: CheckCircle, color: 'var(--state-success)', bg: 'rgba(90,186,138,0.12)',  border: 'rgba(90,186,138,0.3)',  label: 'Connected' },
        disconnected: { Icon: XCircle,     color: 'var(--text-muted)',    bg: 'var(--bg-active)',        border: 'var(--border-default)', label: 'Disconnected' },
        error:        { Icon: AlertCircle, color: 'var(--state-danger)',  bg: 'rgba(224,82,82,0.12)',   border: 'rgba(224,82,82,0.3)',   label: 'Error' },
    };
    const p = map[status] || map.disconnected;
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600, color: p.color, backgroundColor: p.bg, border: `1px solid ${p.border}`, ...S.font }}>
            <p.Icon size={10} />{p.label}
        </span>
    );
};

// ── IntegrationCard ───────────────────────────────────────────────────────────
function IntegrationCard({ provider, integration, workspaceId, onRefresh }) {
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fields, setFields] = useState({});
    const [showPwd, setShowPwd] = useState({});
    const isConnected = integration?.status === 'connected';
    const webhookEndpoint = `${window.location.protocol}//${window.location.hostname}:5000/api/v2/integrations/webhook/${provider.type}?workspaceId=${workspaceId}`;

    const handleConnect = async () => {
        const missing = provider.fields.filter(f => !f.label.includes('optional') && !fields[f.key]);
        if (missing.length) { showToast(`Fill in: ${missing.map(f => f.label).join(', ')}`, 'error'); return; }
        setLoading(true);
        try { await connectIntegration({ workspaceId, type: provider.type, config: fields, label: provider.label }); showToast(`${provider.label} connected`, 'success'); onRefresh(); setOpen(false); setFields({}); }
        catch (err) { showToast(err.response?.data?.message || `Failed to connect ${provider.label}`, 'error'); }
        finally { setLoading(false); }
    };

    const handleDisconnect = async () => {
        setLoading(true);
        try { await disconnectIntegration(workspaceId, provider.type); showToast(`${provider.label} disconnected`, 'success'); onRefresh(); }
        catch (err) { showToast(err.response?.data?.message || 'Failed to disconnect', 'error'); }
        finally { setLoading(false); }
    };

    const cardBorder = isConnected ? 'rgba(90,186,138,0.3)' : 'var(--border-default)';
    const cardBg = isConnected ? 'rgba(90,186,138,0.04)' : 'var(--bg-surface)';

    return (
        <div style={{ border: `1px solid ${cardBorder}`, borderRadius: 2, backgroundColor: cardBg, overflow: 'hidden', transition: 'border-color 150ms ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{provider.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', ...S.font }}>{provider.label}</span>
                        <StatusBadge status={integration?.status || 'disconnected'} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...S.font }}>{provider.desc}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isConnected ? (
                        <button onClick={handleDisconnect} disabled={loading} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--state-danger)', backgroundColor: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 2, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 5, ...S.font }}>
                            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null} Disconnect
                        </button>
                    ) : (
                        <button onClick={() => setOpen(o => !o)} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 2, cursor: 'pointer', transition: 'background-color 150ms ease', ...S.font }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}>
                            Connect
                        </button>
                    )}
                    {isConnected && (
                        <button onClick={() => setOpen(o => !o)} style={{ padding: 6, borderRadius: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', transition: 'color 150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>
            </div>

            {open && (
                <div style={{ borderTop: '1px solid var(--border-default)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: 'var(--bg-active)' }}>
                    {!isConnected && provider.fields.map(field => (
                        <div key={field.key}>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>{field.label}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={field.type === 'password' && !showPwd[field.key] ? 'password' : 'text'}
                                    value={fields[field.key] || ''}
                                    onChange={e => setFields(f => ({ ...f, [field.key]: e.target.value }))}
                                    style={{ ...inputS, paddingRight: field.type === 'password' ? 36 : 10 }}
                                    placeholder={`Enter ${field.label}`}
                                    onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                    onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                />
                                {field.type === 'password' && (
                                    <button type="button" onClick={() => setShowPwd(p => ({ ...p, [field.key]: !p[field.key] }))}
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                                        {showPwd[field.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {!isConnected && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleConnect} disabled={loading}
                                style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 500, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 2, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background-color 150ms ease', ...S.font }}
                                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                                onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}>
                                {loading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</> : `Connect ${provider.label}`}
                            </button>
                            <button onClick={() => setOpen(false)} style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 2, cursor: 'pointer', ...S.font }}>Cancel</button>
                        </div>
                    )}

                    {isConnected && (
                        <div>
                            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>Incoming Webhook URL</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 2 }}>
                                <code style={{ flex: 1, fontSize: 11, color: 'var(--accent)', wordBreak: 'break-all', fontFamily: 'monospace' }}>{webhookEndpoint}</code>
                                <button onClick={() => { navigator.clipboard.writeText(webhookEndpoint); showToast('Copied!', 'success'); }} title="Copy URL"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                    <Link2 size={13} />
                                </button>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, ...S.font }}>Configure this URL in your {provider.label} webhook settings.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── WebhookManager ────────────────────────────────────────────────────────────
function WebhookManager({ workspaceId }) {
    const { showToast } = useToast();
    const [webhooks, setWebhooks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ event: 'task.created', url: '' });

    const load = useCallback(async () => {
        try { setWebhooks(await getWebhooks(workspaceId)); } catch { }
    }, [workspaceId]);

    useEffect(() => { if (workspaceId) load(); }, [workspaceId, load]);

    const handleCreate = async () => {
        if (!form.url) { showToast('URL is required', 'error'); return; }
        setLoading(true);
        try { await createWebhook({ workspaceId, event: form.event, url: form.url }); showToast('Webhook created', 'success'); setForm({ event: 'task.created', url: '' }); setShowForm(false); load(); }
        catch (err) { showToast(err.response?.data?.message || 'Failed to create webhook', 'error'); }
        finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        try { await deleteWebhook(id); showToast('Webhook deleted', 'success'); load(); }
        catch { showToast('Failed to delete', 'error'); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, ...S.font }}>Outgoing Webhooks</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 0, ...S.font }}>POST to your URL when workspace events occur</p>
                </div>
                <button onClick={() => setShowForm(f => !f)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 500, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 2, cursor: 'pointer', transition: 'background-color 150ms ease', ...S.font }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}>
                    <Plus size={13} /> Add Webhook
                </button>
            </div>

            {showForm && (
                <div style={{ padding: 16, backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderLeft: '2px solid var(--accent)', borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>Event</label>
                        <select value={form.event} onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
                            style={{ ...inputS }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}>
                            {WEBHOOK_EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>Endpoint URL</label>
                        <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/webhook" style={inputS}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleCreate} disabled={loading}
                            style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 500, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 2, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...S.font }}>
                            {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />} Create
                        </button>
                        <button onClick={() => setShowForm(false)} style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 2, cursor: 'pointer', ...S.font }}>Cancel</button>
                    </div>
                </div>
            )}

            {webhooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    <Zap size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <p style={{ fontSize: 13, margin: 0, ...S.font }}>No webhooks configured yet</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {webhooks.map(wh => (
                        <div key={wh._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: 2 }}>
                            <span style={{ padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, borderRadius: 2, color: wh.isActive ? 'var(--state-success)' : 'var(--text-muted)', backgroundColor: wh.isActive ? 'rgba(90,186,138,0.12)' : 'var(--bg-hover)', border: `1px solid ${wh.isActive ? 'rgba(90,186,138,0.3)' : 'var(--border-default)'}` }}>
                                {wh.event}
                            </span>
                            <code style={{ flex: 1, fontSize: 11, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{wh.url}</code>
                            {wh.lastStatusCode && <span style={{ fontSize: 11, fontWeight: 600, color: wh.lastStatusCode < 300 ? 'var(--state-success)' : 'var(--state-danger)', ...S.font }}>{wh.lastStatusCode}</span>}
                            <button onClick={() => handleDelete(wh._id)} style={{ padding: 6, borderRadius: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', transition: 'color 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── AIProvidersPanel ──────────────────────────────────────────────────────────
function AIProvidersPanel({ workspaceId }) {
    const { showToast } = useToast();
    const [providers, setProviders] = useState([]);
    const [connecting, setConnecting] = useState(null);
    const [fields, setFields] = useState({});
    const [openForm, setOpenForm] = useState(null);

    const load = useCallback(async () => {
        try { setProviders(await getAIProviders(workspaceId)); } catch { }
    }, [workspaceId]);

    useEffect(() => { if (workspaceId) load(); }, [workspaceId, load]);

    const getRecord = (id) => providers.find(p => p.provider === id);

    const handleConnect = async (pid) => {
        const apiKey = fields[`${pid}_apiKey`];
        if (!apiKey) { showToast('API Key is required', 'error'); return; }
        setConnecting(pid);
        try {
            const config = {};
            if (fields[`${pid}_endpoint`]) config.endpoint = fields[`${pid}_endpoint`];
            await connectAIProvider({ workspaceId, provider: pid, apiKey, config });
            showToast(`${pid} connected`, 'success'); setOpenForm(null); setFields({}); load();
        } catch (err) { showToast(err.response?.data?.message || 'Failed to connect', 'error'); }
        finally { setConnecting(null); }
    };

    const handleSwitch = async (pid) => {
        setConnecting(pid);
        try { await switchAIProvider(workspaceId, pid); showToast(`Switched to ${pid}`, 'success'); load(); }
        catch (err) { showToast(err.response?.data?.message || 'Failed to switch', 'error'); }
        finally { setConnecting(null); }
    };

    const handleDisconnect = async (pid) => {
        setConnecting(pid);
        try { await disconnectAIProvider(workspaceId, pid); showToast(`${pid} disconnected`, 'success'); load(); }
        catch { showToast('Failed to disconnect', 'error'); }
        finally { setConnecting(null); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, ...S.font }}>AI Providers</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, marginBottom: 0, ...S.font }}>Connect and switch AI providers — Chttrix will fallback through the chain automatically</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {AI_PROVIDERS.map(p => {
                    const record = getRecord(p.id);
                    const isConnected = record?.status === 'active';
                    const isDefault = record?.isDefault;
                    const isLoading = connecting === p.id;
                    const isFormOpen = openForm === p.id;
                    const borderColor = isDefault ? 'rgba(184,149,106,0.4)' : isConnected ? 'rgba(90,186,138,0.3)' : 'var(--border-default)';
                    const bgColor = isDefault ? 'rgba(184,149,106,0.06)' : isConnected ? 'rgba(90,186,138,0.04)' : 'var(--bg-surface)';

                    return (
                        <div key={p.id} style={{ border: `1px solid ${borderColor}`, borderRadius: 2, backgroundColor: bgColor, overflow: 'hidden', transition: 'border-color 150ms ease' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                                <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', ...S.font }}>{p.label}</span>
                                        {isDefault && <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 2, color: '#0c0c0c', backgroundColor: 'var(--accent)', ...S.font }}>Active</span>}
                                        {isConnected && !isDefault && <span style={{ padding: '2px 8px', fontSize: 10, fontWeight: 600, borderRadius: 2, color: 'var(--state-success)', backgroundColor: 'rgba(90,186,138,0.12)', border: '1px solid rgba(90,186,138,0.3)', ...S.font }}>Connected</span>}
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', ...S.font }}>{p.desc}</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {!isConnected ? (
                                        <button onClick={() => setOpenForm(isFormOpen ? null : p.id)}
                                            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 2, cursor: 'pointer', transition: 'background-color 150ms ease', ...S.font }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}>
                                            Connect
                                        </button>
                                    ) : (
                                        <>
                                            {!isDefault && (
                                                <button onClick={() => handleSwitch(p.id)} disabled={isLoading}
                                                    style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--accent)', backgroundColor: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.3)', borderRadius: 2, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, transition: 'background-color 150ms ease', display: 'flex', alignItems: 'center', gap: 5, ...S.font }}
                                                    onMouseEnter={e => { if (!isLoading) e.currentTarget.style.backgroundColor = 'rgba(184,149,106,0.14)'; }}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(184,149,106,0.08)'}>
                                                    {isLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null} Set Active
                                                </button>
                                            )}
                                            <button onClick={() => handleDisconnect(p.id)} disabled={isLoading}
                                                style={{ padding: '6px 12px', fontSize: 12, fontWeight: 500, color: 'var(--state-danger)', backgroundColor: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)', borderRadius: 2, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, transition: 'background-color 150ms ease', display: 'flex', alignItems: 'center', gap: 5, ...S.font }}
                                                onMouseEnter={e => { if (!isLoading) e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.14)'; }}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.08)'}>
                                                {isLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null} Disconnect
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {isFormOpen && !isConnected && (
                                <div style={{ borderTop: '1px solid var(--border-default)', padding: 16, backgroundColor: 'var(--bg-active)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>API Key</label>
                                        <input type="password" value={fields[`${p.id}_apiKey`] || ''} onChange={e => setFields(f => ({ ...f, [`${p.id}_apiKey`]: e.target.value }))} placeholder={`Enter ${p.label} API key`}
                                            style={inputS}
                                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                                    </div>
                                    {p.id === 'local_llm' && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6, ...S.font }}>Endpoint URL</label>
                                            <input type="text" value={fields[`${p.id}_endpoint`] || ''} onChange={e => setFields(f => ({ ...f, [`${p.id}_endpoint`]: e.target.value }))} placeholder="http://localhost:11434/api"
                                                style={inputS}
                                                onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                                onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => handleConnect(p.id)} disabled={isLoading}
                                            style={{ flex: 1, padding: '8px', fontSize: 13, fontWeight: 500, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 2, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...S.font }}>
                                            {isLoading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</> : `Connect ${p.label}`}
                                        </button>
                                        <button onClick={() => setOpenForm(null)} style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border-default)', borderRadius: 2, cursor: 'pointer', ...S.font }}>Cancel</button>
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

// ── Main IntegrationsTab ──────────────────────────────────────────────────────
const TABS = [
    ...PROVIDER_CATALOGUE.map(c => ({ id: c.category, label: c.category })),
    { id: 'Webhooks', label: '⚡ Webhooks' },
    { id: 'AI', label: '✨ AI Providers' },
];

const IntegrationsTab = ({ workspaceId }) => {
    const [integrations, setIntegrations] = useState([]);
    const [activeCategory, setActiveCategory] = useState('Developer');

    const loadIntegrations = useCallback(async () => {
        if (!workspaceId) return;
        try { setIntegrations(await getIntegrations(workspaceId)); } catch { }
    }, [workspaceId]);

    useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

    const getIntegration = (type) => integrations.find(i => i.type === type);
    const currentCatalogue = PROVIDER_CATALOGUE.find(c => c.category === activeCategory);

    if (!workspaceId) {
        return (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
                <Cloud size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p style={{ fontSize: 13, margin: 0, ...S.font }}>Select a workspace to manage integrations</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Header */}
            <div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.01em', ...S.font }}>Integration Ecosystem</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, ...S.font }}>
                    Connect Chttrix to your favourite tools. All integrations are workspace-level and event-driven.
                </p>
            </div>

            {/* Category tab bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TABS.map(tab => {
                    const isActive = activeCategory === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveCategory(tab.id)}
                            style={{
                                padding: '6px 14px', fontSize: 12, fontWeight: isActive ? 600 : 400,
                                borderRadius: 2,
                                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-default)'}`,
                                backgroundColor: isActive ? 'rgba(184,149,106,0.12)' : 'var(--bg-active)',
                                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 150ms ease', ...S.font,
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-default)'; }}>
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {activeCategory === 'Webhooks' ? (
                <WebhookManager workspaceId={workspaceId} />
            ) : activeCategory === 'AI' ? (
                <AIProvidersPanel workspaceId={workspaceId} />
            ) : currentCatalogue ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', ...S.font }}>
                            {currentCatalogue.category} Integrations
                        </span>
                        <span style={{ padding: '1px 7px', fontSize: 10, fontWeight: 600, borderRadius: 2, color: 'var(--text-muted)', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', ...S.font }}>
                            {currentCatalogue.providers.length} providers
                        </span>
                    </div>
                    {currentCatalogue.providers.map(provider => (
                        <IntegrationCard key={provider.type} provider={provider} integration={getIntegration(provider.type)} workspaceId={workspaceId} onRefresh={loadIntegrations} />
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default IntegrationsTab;
