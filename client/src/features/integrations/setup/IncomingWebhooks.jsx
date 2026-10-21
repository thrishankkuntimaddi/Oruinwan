import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Webhook, X } from 'lucide-react';
import SettingSwitch from '../../../components/ui/SettingSwitch';
import { useToast } from '../../../contexts/ToastContext';
import {
    Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Input, LoadingState, Notice, Section,
} from '../../../pages/settingsTabs/settingsUi';
import { ChannelSelect, CopyField, useWorkspaceChannels } from './setupKit';
import {
    createIncomingWebhook, deleteIncomingWebhook, listIncomingWebhooks, rotateIncomingWebhook, updateIncomingWebhook,
} from './connectorsApi';
import './setup.css';

/** Settings → Integrations → Incoming webhooks (admins): Slack-compatible URLs that post into a channel. */

export const curlExample = (url) => `curl -X POST -H 'Content-Type: application/json' -d '{"text":"Hello"}' ${url}`;

const formatDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export default function IncomingWebhooks({ workspaceId }) {
    const { showToast } = useToast();
    const channels = useWorkspaceChannels(workspaceId);
    const [hooks, setHooks] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({ name: '', channelId: '' });
    const [formError, setFormError] = useState(null);
    const [creating, setCreating] = useState(false);
    const [fresh, setFresh] = useState(null); // { id, url, verb } of a just created / rotated hook
    const [busy, setBusy] = useState({});
    const [confirm, setConfirm] = useState(null); // { kind: 'rotate'|'delete', hook }
    const [confirming, setConfirming] = useState(false);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            setHooks(await listIncomingWebhooks(workspaceId));
        } catch (err) {
            setLoadError(err.message);
        }
    }, [workspaceId]);

    useEffect(() => { setHooks(null); setFresh(null); load(); }, [load]);

    const channelName = (id) => {
        const ch = channels.find((c) => c.id === String(id));
        return ch ? `#${ch.name}` : 'a channel you’re not in';
    };
    const replace = (hook) => setHooks((list) => (list || []).map((h) => (h.id === hook.id ? { ...h, ...hook } : h)));

    const create = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.channelId) { setFormError('Give the webhook a name and choose a channel.'); return; }
        setCreating(true); setFormError(null);
        try {
            const hook = await createIncomingWebhook(workspaceId, { name: form.name.trim(), channelId: form.channelId });
            if (hook) setHooks((list) => [hook, ...(list || [])]);
            setFresh(hook?.url ? { id: hook.id, url: hook.url, verb: 'created' } : null);
            setForm({ name: '', channelId: '' });
            setFormOpen(false);
            showToast('Incoming webhook created', 'success');
        } catch (err) {
            setFormError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const toggle = async (hook, isActive) => {
        setBusy((b) => ({ ...b, [hook.id]: true }));
        try {
            replace((await updateIncomingWebhook(workspaceId, hook.id, { isActive })) || { ...hook, isActive });
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusy((b) => ({ ...b, [hook.id]: false }));
        }
    };

    const runConfirm = async () => {
        if (!confirm) return;
        const { kind, hook } = confirm;
        setConfirming(true);
        try {
            if (kind === 'rotate') {
                const next = await rotateIncomingWebhook(workspaceId, hook.id);
                if (next) replace(next);
                setFresh(next?.url ? { id: hook.id, url: next.url, verb: 'rotated' } : null);
                showToast('New URL created. Update it wherever the old one was used.', 'success');
            } else {
                await deleteIncomingWebhook(workspaceId, hook.id);
                setHooks((list) => (list || []).filter((h) => h.id !== hook.id));
                if (fresh?.id === hook.id) setFresh(null);
                showToast('Incoming webhook deleted', 'success');
            }
            setConfirm(null);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setConfirming(false);
        }
    };

    return (
        <Section
            id="integrations-incoming-webhooks"
            title="Incoming webhooks"
            description="Give another service a URL that posts messages into a channel. The format is compatible with Slack incoming webhooks."
            action={!formOpen ? <Button size="sm" variant="primary" icon={Plus} onClick={() => { setFormOpen(true); setFormError(null); }}>Add incoming webhook</Button> : null}
        >
            <div className="oi-setup-body">
                <Notice tone="warning">
                    Messages posted through these URLs come from outside Oruinwan and are not end-to-end encrypted. They appear from the Incoming webhook bot.
                    {' '}The channel needs at least one message first (otherwise the URL answers <code>channel_not_ready</code>).
                </Notice>

                {fresh && (
                    <Notice tone="success" action={<IconButton label="Dismiss" onClick={() => setFresh(null)}><X size={14} /></IconButton>}>
                        <strong>Webhook {fresh.verb}.</strong> Treat the URL like a password. Try it:
                        <pre className="oi-conn-code stg-mono" data-testid="incoming-webhook-curl">{curlExample(fresh.url)}</pre>
                    </Notice>
                )}

                {formOpen && (
                    <form className="stg-ws-panel" onSubmit={create} noValidate>
                        <div className="stg-grid-2">
                            <Field label="Name" id="incoming-hook-name" hint="Shown as the sender unless the request sets a username.">
                                <Input id="incoming-hook-name" autoFocus maxLength={80} placeholder="Deploy bot" value={form.name}
                                    onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormError(null); }} />
                            </Field>
                            <Field label="Channel" id="incoming-hook-channel">
                                <ChannelSelect id="incoming-hook-channel" channels={channels} value={form.channelId}
                                    onChange={(v) => { setForm((f) => ({ ...f, channelId: v })); setFormError(null); }} />
                            </Field>
                        </div>
                        {formError && <div className="stg-error-text" role="alert">{formError}</div>}
                        <div className="stg-ws-actions">
                            <Button type="submit" variant="primary" loading={creating}>Create webhook</Button>
                            <Button variant="ghost" disabled={creating} onClick={() => { setFormOpen(false); setFormError(null); }}>Cancel</Button>
                        </div>
                    </form>
                )}

                {loadError ? <ErrorState message={loadError} onRetry={load} />
                    : !hooks ? <LoadingState label="Loading incoming webhooks…" inline />
                        : hooks.length === 0 ? <EmptyState icon={Webhook}>No incoming webhooks yet.</EmptyState>
                            : (
                                <ul className="stg-list">
                                    {hooks.map((h) => (
                                        <li key={h.id} className="stg-list-item oi-conn" data-testid="incoming-webhook">
                                            <div className="oi-conn-head stg-ws-item-wrap">
                                                <div className="stg-ws-item-main">
                                                    <div className="stg-ws-item-title"><strong>{h.name}</strong> → {channelName(h.channelId)}</div>
                                                    <div className="stg-ws-item-meta">
                                                        <Badge tone={h.isActive ? 'success' : undefined}>{h.isActive ? 'Active' : 'Paused'}</Badge>
                                                        <span>{h.lastUsedAt ? `Last used ${formatDate(h.lastUsedAt)}` : 'Never used'}</span>
                                                        <span>· {h.useCount || 0} {h.useCount === 1 ? 'message' : 'messages'}</span>
                                                    </div>
                                                </div>
                                                <div className="stg-ws-item-actions">
                                                    <SettingSwitch checked={h.isActive} disabled={!!busy[h.id]} label={`${h.isActive ? 'Pause' : 'Resume'} ${h.name}`} onChange={(v) => toggle(h, v)} />
                                                    <IconButton label={`New URL for ${h.name}`} onClick={() => setConfirm({ kind: 'rotate', hook: h })}><RefreshCw size={14} /></IconButton>
                                                    <IconButton label={`Delete ${h.name}`} tone="danger" onClick={() => setConfirm({ kind: 'delete', hook: h })}><Trash2 size={14} /></IconButton>
                                                </div>
                                            </div>
                                            {h.url && <CopyField id={`incoming-hook-${h.id}`} label="URL" value={h.url} secret />}
                                        </li>
                                    ))}
                                </ul>
                            )}

                {!fresh && hooks?.length > 0 && (
                    <div className="stg-hint">
                        Send a message with:
                        <pre className="oi-conn-code stg-mono">{curlExample('<webhook URL>')}</pre>
                        Optional fields: <code>username</code>, and Slack-style <code>attachments</code> or <code>blocks</code>.
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={!!confirm}
                title={confirm?.kind === 'rotate' ? 'Create a new URL?' : 'Delete incoming webhook?'}
                tone={confirm?.kind === 'delete' ? 'danger' : 'primary'}
                confirmLabel={confirm?.kind === 'rotate' ? 'Create new URL' : 'Delete'}
                loading={confirming}
                onConfirm={runConfirm}
                onCancel={() => setConfirm(null)}
            >
                {confirm?.kind === 'rotate'
                    ? <>The old URL of <strong>{confirm?.hook.name}</strong> stops working right away. Update it wherever it is used.</>
                    : <>Requests to <strong>{confirm?.hook.name}</strong> stop working. Messages it already posted stay. This can’t be undone.</>}
            </ConfirmDialog>
        </Section>
    );
}
