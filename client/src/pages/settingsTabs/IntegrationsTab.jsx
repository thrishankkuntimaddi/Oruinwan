import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Layers, Pause, Play, Plus, Send, Trash2, Webhook, X } from 'lucide-react';
import api, { API_BASE } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useFlag } from '../../contexts/FeatureFlagsContext';
import {
    connectIntegration, createWebhook, deleteWebhook, disconnectIntegration, getIntegrations, getWebhooks,
} from '../../services/integrations.service';
import {
    Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingState, Notice, PageIntro, Section, errorMessage,
} from './settingsUi';
import './stg-ws.css';

// Used only if /webhooks/events can't be loaded; mirrors the server's supported list.
const FALLBACK_EVENTS = [
    { event: 'task.created', description: 'A task was created' },
    { event: 'task.updated', description: 'A task was updated' },
    { event: 'task.completed', description: 'A task was marked done' },
    { event: 'message.sent', description: 'A message was posted in a public channel (ids and metadata only)' },
    { event: 'integration.connected', description: 'An integration was connected' },
    { event: 'integration.disconnected', description: 'An integration was disconnected' },
];

/** https is required, except for local test receivers. */
function validateWebhookUrl(value) {
    const raw = value.trim();
    if (!raw) return 'Enter the address that should receive events.';
    let url;
    try { url = new URL(raw); } catch { return 'Enter a full address, for example https://example.com/hooks/oruinwan'; }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol === 'https:' || (local && url.protocol === 'http:')) return null;
    return 'Use an https:// address (plain http is only allowed for localhost).';
}

const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const statusBadge = (code) => {
    if (code === undefined || code === null) return null;
    if (code === 0) return <Badge tone="danger">Unreachable</Badge>;
    return <Badge tone={code >= 200 && code < 300 ? 'success' : 'danger'}>Last reply {code}</Badge>;
};

async function copyText(text, showToast) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied', 'success');
    } catch {
        showToast('Could not copy. Select the text and copy it manually.', 'error');
    }
}

/* ── Outgoing webhooks ─────────────────────────────────────────────────── */

function WebhooksSection({ workspaceId, isAdmin }) {
    const { showToast } = useToast();
    const [hooks, setHooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [events, setEvents] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({ url: '', events: [] });
    const [urlError, setUrlError] = useState(null);
    const [formError, setFormError] = useState(null);
    const [creating, setCreating] = useState(false);
    const [secret, setSecret] = useState(null);
    const [busy, setBusy] = useState({}); // id -> 'test' | 'toggle'
    const [testResults, setTestResults] = useState({});
    const [toDelete, setToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setHooks(await getWebhooks(workspaceId) || []);
        } catch (err) {
            setLoadError(errorMessage(err, 'Could not load webhooks'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { load(); setFormOpen(false); setSecret(null); setTestResults({}); }, [load]);

    useEffect(() => {
        if (!isAdmin || events) return;
        api.get('/api/v2/integrations/webhooks/events')
            .then(({ data }) => setEvents(Array.isArray(data?.events) && data.events.length ? data.events : FALLBACK_EVENTS))
            .catch(() => setEvents(FALLBACK_EVENTS));
    }, [isAdmin, events]);

    const allSelected = form.events.includes('*');
    const toggleEvent = (ev) => {
        setFormError(null);
        setForm((f) => {
            if (ev === '*') return { ...f, events: f.events.includes('*') ? [] : ['*'] };
            const rest = f.events.filter((e) => e !== '*');
            return { ...f, events: rest.includes(ev) ? rest.filter((e) => e !== ev) : [...rest, ev] };
        });
    };

    const create = async (e) => {
        e.preventDefault();
        const badUrl = validateWebhookUrl(form.url);
        setUrlError(badUrl);
        setFormError(!form.events.length ? 'Choose at least one event.' : null);
        if (badUrl || !form.events.length) return;
        setCreating(true);
        try {
            const hook = await createWebhook({ workspaceId, url: form.url.trim(), events: form.events });
            setSecret(hook?.secret || null);
            setForm({ url: '', events: [] });
            setFormOpen(false);
            showToast('Webhook added', 'success');
            load();
        } catch (err) {
            setFormError(errorMessage(err, 'Could not add the webhook'));
        } finally {
            setCreating(false);
        }
    };

    const toggleActive = async (hook) => {
        setBusy((b) => ({ ...b, [hook._id]: 'toggle' }));
        try {
            const { data } = await api.patch(`/api/v2/integrations/webhooks/${hook._id}`, { active: !hook.isActive });
            setHooks((list) => list.map((h) => (h._id === hook._id ? { ...h, ...data.webhook } : h)));
        } catch (err) {
            showToast(errorMessage(err, 'Could not update the webhook'), 'error');
        } finally {
            setBusy((b) => ({ ...b, [hook._id]: null }));
        }
    };

    const sendTest = async (hook) => {
        setBusy((b) => ({ ...b, [hook._id]: 'test' }));
        try {
            const { data } = await api.post(`/api/v2/integrations/webhooks/${hook._id}/test`);
            setTestResults((r) => ({ ...r, [hook._id]: data }));
            setHooks((list) => list.map((h) => (h._id === hook._id ? { ...h, lastStatusCode: data.status, lastTriggeredAt: new Date().toISOString() } : h)));
        } catch (err) {
            setTestResults((r) => ({ ...r, [hook._id]: { ok: false, error: errorMessage(err, 'Test failed') } }));
        } finally {
            setBusy((b) => ({ ...b, [hook._id]: null }));
        }
    };

    const confirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteWebhook(toDelete._id);
            setHooks((list) => list.filter((h) => h._id !== toDelete._id));
            setToDelete(null);
            showToast('Webhook deleted', 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not delete the webhook'), 'error');
        } finally {
            setDeleting(false);
        }
    };

    const describeTest = (r) => {
        if (r.error) return r.error;
        if (r.ok) return `Test delivered. Your endpoint answered ${r.status}.`;
        return r.status ? `Test failed. Your endpoint answered ${r.status}.` : 'Test failed. Your endpoint could not be reached.';
    };

    return (
        <Section
            title="Outgoing webhooks"
            description="Oruinwan sends a signed POST request to your address when something happens in this workspace."
            action={isAdmin && !formOpen ? <Button size="sm" variant="primary" icon={Plus} onClick={() => { setFormOpen(true); setSecret(null); }}>Add webhook</Button> : null}
        >
            {isAdmin === false && (
                <div style={{ paddingTop: 12 }}>
                    <Notice>Only workspace owners and admins can add, test or change webhooks. You can see which services receive events.</Notice>
                </div>
            )}

            {secret && (
                <div style={{ paddingTop: 12 }}>
                    <Notice tone="success" action={<IconButton label="Dismiss" onClick={() => setSecret(null)}><X size={14} /></IconButton>}>
                        <strong>Copy the signing secret now.</strong> It won’t be shown again. Use it to verify that requests really come from Oruinwan.
                        <div className="stg-ws-secret">
                            <code className="stg-mono">{secret}</code>
                            <IconButton label="Copy secret" onClick={() => copyText(secret, showToast)}><Copy size={13} /></IconButton>
                        </div>
                    </Notice>
                </div>
            )}

            {isAdmin && formOpen && (
                <form className="stg-ws-panel" onSubmit={create} noValidate>
                    <Field label="Endpoint URL" id="stg-ws-webhook-url" error={urlError} hint="Must start with https:// (http is allowed for localhost).">
                        <Input
                            id="stg-ws-webhook-url"
                            type="url"
                            inputMode="url"
                            autoFocus
                            placeholder="https://example.com/hooks/oruinwan"
                            value={form.url}
                            invalid={!!urlError}
                            onChange={(e) => { setForm((f) => ({ ...f, url: e.target.value })); setUrlError(null); }}
                        />
                    </Field>
                    <fieldset className="stg-ws-events">
                        <legend className="stg-label">Events</legend>
                        {!events ? (
                            <LoadingState label="Loading events…" inline />
                        ) : (
                            <>
                                <label className="stg-ws-check">
                                    <input type="checkbox" checked={allSelected} onChange={() => toggleEvent('*')} />
                                    <span>All events<span className="stg-ws-check-desc">Including ones added later</span></span>
                                </label>
                                {events.map(({ event, description }) => (
                                    <label key={event} className="stg-ws-check" data-disabled={allSelected ? 'true' : undefined}>
                                        <input type="checkbox" disabled={allSelected} checked={allSelected || form.events.includes(event)} onChange={() => toggleEvent(event)} />
                                        <span><span className="stg-mono">{event}</span><span className="stg-ws-check-desc">{description}</span></span>
                                    </label>
                                ))}
                            </>
                        )}
                    </fieldset>
                    {formError && <div className="stg-error-text" role="alert">{formError}</div>}
                    <div className="stg-ws-actions">
                        <Button type="submit" variant="primary" loading={creating}>Add webhook</Button>
                        <Button variant="ghost" onClick={() => { setFormOpen(false); setFormError(null); setUrlError(null); }} disabled={creating}>Cancel</Button>
                    </div>
                </form>
            )}

            {loading ? (
                <LoadingState label="Loading webhooks…" inline />
            ) : loadError ? (
                <ErrorState message={loadError} onRetry={load} />
            ) : hooks.length === 0 ? (
                <EmptyState icon={Webhook}>No webhooks yet.{isAdmin ? ' Add one to send workspace events to another service.' : ''}</EmptyState>
            ) : (
                <ul className="stg-list">
                    {hooks.map((h) => {
                        const hookEvents = Array.isArray(h.events) && h.events.length ? h.events : (h.event ? [h.event] : []);
                        const result = testResults[h._id];
                        return (
                            <li key={h._id} className="stg-list-item stg-ws-item-wrap" data-testid="settings-webhook">
                                <div className="stg-ws-item-main">
                                    <div className="stg-ws-item-title stg-mono">{h.url || 'Hidden address'}</div>
                                    <div className="stg-ws-item-meta">
                                        <Badge tone={h.isActive ? 'success' : undefined}>{h.isActive ? 'Active' : 'Paused'}</Badge>
                                        {hookEvents.map((ev) => <Badge key={ev}>{ev === '*' ? 'All events' : ev}</Badge>)}
                                        {statusBadge(h.lastStatusCode)}
                                        {h.lastTriggeredAt && <span>Last sent {formatDate(h.lastTriggeredAt)}</span>}
                                    </div>
                                    {result && (
                                        <div className="stg-ws-item-meta" role="status" style={{ color: result.ok ? 'var(--state-success)' : 'var(--state-danger)' }}>
                                            {describeTest(result)}
                                        </div>
                                    )}
                                </div>
                                {isAdmin && (
                                    <div className="stg-ws-item-actions">
                                        <Button size="sm" variant="ghost" icon={Send} loading={busy[h._id] === 'test'} disabled={!!busy[h._id]} onClick={() => sendTest(h)}>Test</Button>
                                        <IconButton
                                            label={h.isActive ? 'Pause deliveries' : 'Resume deliveries'}
                                            disabled={!!busy[h._id]}
                                            onClick={() => toggleActive(h)}
                                        >
                                            {h.isActive ? <Pause size={14} /> : <Play size={14} />}
                                        </IconButton>
                                        <IconButton label="Delete webhook" tone="danger" onClick={() => setToDelete(h)}><Trash2 size={14} /></IconButton>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <ConfirmDialog
                open={!!toDelete}
                title="Delete webhook?"
                tone="danger"
                confirmLabel="Delete"
                loading={deleting}
                onConfirm={confirmDelete}
                onCancel={() => setToDelete(null)}
            >
                <span className="stg-mono" style={{ overflowWrap: 'anywhere' }}>{toDelete?.url}</span> will stop receiving events. This can’t be undone.
            </ConfirmDialog>
        </Section>
    );
}

/* ── Third-party apps (behind the "integrations" flag) ─────────────────── */

const PROVIDER_CATALOGUE = [
    { category: 'Developer', providers: [
        { type: 'github', label: 'GitHub', icon: '🐙', desc: 'Sync issues to tasks, PRs to activity', fields: [{ key: 'token', label: 'Personal access token', type: 'password' }] },
        { type: 'gitlab', label: 'GitLab', icon: '🦊', desc: 'Webhook for issues and merge requests', fields: [{ key: 'token', label: 'Access token', type: 'password' }, { key: 'webhookSecret', label: 'Webhook secret', type: 'password' }] },
        { type: 'bitbucket', label: 'Bitbucket', icon: '🪣', desc: 'Push events and issue creation', fields: [{ key: 'appPassword', label: 'App password', type: 'password' }] },
        { type: 'linear', label: 'Linear', icon: '◑', desc: 'Sync Linear issues as tasks', fields: [{ key: 'apiKey', label: 'API key', type: 'password' }] },
        { type: 'jira', label: 'Jira', icon: '🔷', desc: 'Sync Jira issues and projects', fields: [{ key: 'token', label: 'API token', type: 'password' }, { key: 'baseUrl', label: 'Base URL', type: 'text' }] },
        { type: 'cicd', label: 'CI/CD pipeline', icon: '⚙️', desc: 'Generic CI/CD webhook (GitHub Actions)', fields: [{ key: 'webhookSecret', label: 'Webhook secret', type: 'password', optional: true }] },
    ] },
    { category: 'Productivity', providers: [
        { type: 'google_drive', label: 'Google Drive', icon: '📁', desc: 'Attach Drive files', fields: [{ key: 'accessToken', label: 'OAuth access token', type: 'password' }] },
        { type: 'onedrive', label: 'OneDrive', icon: '☁️', desc: 'Attach OneDrive files', fields: [{ key: 'accessToken', label: 'OAuth access token', type: 'password' }] },
        { type: 'dropbox', label: 'Dropbox', icon: '📦', desc: 'Attach Dropbox files', fields: [{ key: 'accessToken', label: 'OAuth access token', type: 'password' }] },
        { type: 'notion', label: 'Notion', icon: '📝', desc: 'Attach Notion pages', fields: [{ key: 'token', label: 'Integration token', type: 'password' }] },
        { type: 'confluence', label: 'Confluence', icon: '📚', desc: 'Attach Confluence pages', fields: [{ key: 'token', label: 'API token', type: 'password' }, { key: 'baseUrl', label: 'Base URL', type: 'text' }] },
    ] },
    { category: 'Communication', providers: [
        { type: 'slack', label: 'Slack', icon: '💬', desc: 'Bridge messages between Slack and Oruinwan', fields: [{ key: 'webhookUrl', label: 'Incoming webhook URL', type: 'text' }] },
        { type: 'zoom', label: 'Zoom', icon: '📹', desc: 'Create Zoom meetings', fields: [{ key: 'apiKey', label: 'API key', type: 'password' }, { key: 'apiSecret', label: 'API secret', type: 'password' }] },
        { type: 'google_meet', label: 'Google Meet', icon: '🎥', desc: 'Create Meet links', fields: [{ key: 'accessToken', label: 'OAuth access token', type: 'password' }] },
        { type: 'teams', label: 'Microsoft Teams', icon: '💼', desc: 'Bridge messages via Teams webhooks', fields: [{ key: 'webhookUrl', label: 'Incoming webhook URL', type: 'text' }] },
    ] },
    { category: 'Automation', providers: [
        { type: 'zapier', label: 'Zapier', icon: '⚡', desc: 'Trigger zaps from Oruinwan events', fields: [{ key: 'webhookUrl', label: 'Zapier webhook URL', type: 'text' }] },
        { type: 'make', label: 'Make', icon: '🔗', desc: 'Connect Make scenarios', fields: [{ key: 'webhookUrl', label: 'Make webhook URL', type: 'text' }] },
        { type: 'n8n', label: 'n8n', icon: '🔄', desc: 'Trigger n8n workflows', fields: [{ key: 'webhookUrl', label: 'n8n webhook URL', type: 'text' }] },
    ] },
];

function ProviderItem({ provider, integration, workspaceId, isAdmin, onChanged }) {
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [fields, setFields] = useState({});
    const connected = integration?.status === 'connected';
    const incomingUrl = `${API_BASE}/api/v2/integrations/webhook/${provider.type}?workspaceId=${workspaceId}`;

    const connect = async (e) => {
        e.preventDefault();
        const missing = provider.fields.filter((f) => !f.optional && !String(fields[f.key] || '').trim());
        if (missing.length) { showToast(`Fill in: ${missing.map((f) => f.label).join(', ')}`, 'error'); return; }
        setBusy(true);
        try {
            await connectIntegration({ workspaceId, type: provider.type, config: fields, label: provider.label });
            showToast(`${provider.label} connected`, 'success');
            setOpen(false);
            setFields({});
            onChanged();
        } catch (err) {
            showToast(errorMessage(err, `Could not connect ${provider.label}`), 'error');
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async () => {
        setBusy(true);
        try {
            await disconnectIntegration(workspaceId, provider.type);
            showToast(`${provider.label} disconnected`, 'success');
            onChanged();
        } catch (err) {
            showToast(errorMessage(err, 'Could not disconnect'), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className="stg-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="stg-ws-item-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="stg-ws-emoji" aria-hidden="true">{provider.icon}</span>
                <div className="stg-ws-item-main">
                    <div className="stg-ws-item-title" style={{ fontWeight: 500 }}>{provider.label} {connected && <Badge tone="success">Connected</Badge>}</div>
                    <div className="stg-ws-item-meta">{provider.desc}</div>
                </div>
                {isAdmin && (
                    <div className="stg-ws-item-actions">
                        {connected ? (
                            <>
                                <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>Details</Button>
                                <Button size="sm" variant="danger-soft" loading={busy} onClick={disconnect}>Disconnect</Button>
                            </>
                        ) : (
                            <Button size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Cancel' : 'Connect'}</Button>
                        )}
                    </div>
                )}
            </div>
            {open && !connected && (
                <form className="stg-ws-panel" onSubmit={connect}>
                    {provider.fields.map((f) => (
                        <Field key={f.key} label={f.optional ? `${f.label} (optional)` : f.label} id={`stg-ws-${provider.type}-${f.key}`}>
                            <Input
                                id={`stg-ws-${provider.type}-${f.key}`}
                                type={f.type === 'password' ? 'password' : 'text'}
                                autoComplete="off"
                                value={fields[f.key] || ''}
                                onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
                            />
                        </Field>
                    ))}
                    <div className="stg-ws-actions">
                        <Button type="submit" variant="primary" loading={busy}>Connect {provider.label}</Button>
                    </div>
                </form>
            )}
            {open && connected && (
                <div className="stg-ws-panel">
                    <Field label="Incoming webhook URL" hint={`Paste this into your ${provider.label} webhook settings.`}>
                        <div className="stg-ws-secret">
                            <code className="stg-mono">{incomingUrl}</code>
                            <IconButton label="Copy URL" onClick={() => copyText(incomingUrl, showToast)}><Copy size={13} /></IconButton>
                        </div>
                    </Field>
                </div>
            )}
        </li>
    );
}

function ProviderCatalogue({ workspaceId, isAdmin }) {
    const [integrations, setIntegrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setIntegrations(await getIntegrations(workspaceId) || []);
        } catch (err) {
            setLoadError(errorMessage(err, 'Could not load connected apps'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <Section title="Third-party apps"><LoadingState label="Loading apps…" inline /></Section>;
    if (loadError) return <Section title="Third-party apps"><ErrorState message={loadError} onRetry={load} /></Section>;

    return PROVIDER_CATALOGUE.map((group) => (
        <Section key={group.category} title={group.category} description={isAdmin === false ? 'Only workspace admins can connect apps.' : undefined}>
            <ul className="stg-list">
                {group.providers.map((p) => (
                    <ProviderItem
                        key={p.type}
                        provider={p}
                        integration={integrations.find((i) => i.type === p.type)}
                        workspaceId={workspaceId}
                        isAdmin={isAdmin}
                        onChanged={load}
                    />
                ))}
            </ul>
        </Section>
    ));
}

/* ── Tab ───────────────────────────────────────────────────────────────── */

/** Whether the signed-in user is an owner/admin of the workspace (the server enforces the same rule). */
function useIsAdminOf(workspaceId) {
    const [roles, setRoles] = useState(null);
    useEffect(() => {
        if (!workspaceId) return undefined;
        let alive = true;
        api.get('/api/workspaces/my')
            .then(({ data }) => {
                if (!alive) return;
                setRoles(Object.fromEntries((data?.workspaces || []).map((w) => [String(w.id), w.role])));
            })
            .catch(() => { if (alive) setRoles({}); /* treated as not admin; the server still decides */ });
        return () => { alive = false; };
    }, [workspaceId]);
    if (!roles) return undefined; // still loading
    const role = roles[String(workspaceId)];
    return role === 'owner' || role === 'admin';
}

const IntegrationsTab = ({ workspaceId, workspaceName, workspacePicker }) => {
    const navigate = useNavigate();
    const providersEnabled = useFlag('integrations');
    const isAdmin = useIsAdminOf(workspaceId);

    const intro = (
        <PageIntro
            title="Integrations"
            description={workspaceName
                ? `Send events from ${workspaceName} to other services.`
                : 'Send workspace events to other services.'}
        />
    );

    if (!workspaceId) {
        return (
            <>
                {intro}
                <Section><EmptyState icon={Layers}>Join or create a workspace to manage its integrations.</EmptyState></Section>
            </>
        );
    }

    return (
        <>
            {intro}
            {workspacePicker}

            <Notice
                action={(
                    <div className="stg-ws-actions">
                        <Button size="sm" onClick={() => navigate(`/workspace/${workspaceId}/apps`)}>Apps</Button>
                        <Button size="sm" onClick={() => navigate(`/workspace/${workspaceId}/developer`)}>Developer portal</Button>
                    </div>
                )}
            >
                Installed apps live in <strong>Apps</strong>. Bots, API keys and webhook delivery details live in the <strong>Developer portal</strong>.
            </Notice>

            <WebhooksSection key={workspaceId} workspaceId={workspaceId} isAdmin={isAdmin} />

            {providersEnabled && <ProviderCatalogue key={`apps-${workspaceId}`} workspaceId={workspaceId} isAdmin={isAdmin} />}
        </>
    );
};

export default IntegrationsTab;
