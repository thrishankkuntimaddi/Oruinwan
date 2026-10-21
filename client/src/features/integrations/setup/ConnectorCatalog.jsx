import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, PlugZap, RefreshCw, Send, Settings2, ShieldCheck } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import {
    Button, ConfirmDialog, ErrorState, Field, Input, LoadingState, Notice, Section, Select, Textarea,
} from '../../../pages/settingsTabs/settingsUi';
import { ProviderMark } from '../ui';
import { rotateIntegrationSecret } from '../integrationsApi';
import { ChannelSelect, CopyField, useIntegrationConfig, useWorkspaceChannels } from './setupKit';
import {
    DisconnectButton, FIRST_MESSAGE_HINT, LastEvent, RoutesBlock, SettingToggles, StatusBadge, TestResult, isMasked, useTester,
} from './DevIntegrations';
import BridgesBlock from './BridgesBlock';
import { getConnectorCatalog, runConnectorAction } from './connectorsApi';
import '../integrations.css';
import './setup.css';

/**
 * Settings → Integrations: every token-based connector, rendered from
 * GET /integrations/catalog (docs/api/integrations.md). GitHub, Jira and Zoom
 * have their own setup in DevIntegrations.
 */

const CATEGORIES = [
    { id: 'developer', label: 'Developer', description: 'Code hosts, issue trackers and build pipelines.' },
    { id: 'communication', label: 'Communication', description: 'Bridge Slack and Teams channels, and create meetings.' },
    { id: 'files', label: 'Files', description: 'Find files and attach them to messages and tasks.' },
    { id: 'docs', label: 'Docs', description: 'Attach pages to tasks and import them into Knowledge.' },
    { id: 'automation', label: 'Automation', description: 'Let automation tools post messages and create tasks. To send Oruinwan events to them, use Outgoing webhooks on this page.' },
];

const hasFlag = (config, key) => !!config?.[`has${key.charAt(0).toUpperCase()}${key.slice(1)}`];

/** "who the token belongs to" from config.account. */
export function accountName(account) {
    if (!account) return null;
    if (typeof account === 'string') return account;
    return account.name || account.login || account.username || account.displayName || account.email || null;
}

const AUTOMATION_SAMPLE = `{
  "text": "Deploy of web finished",
  "channel": "deploys",
  "title": "Release 1.4",
  "url": "https://example.com/releases/1.4",
  "username": "Release bot"
}

{ "task": { "title": "Check the release notes", "dueDate": "2026-11-01" } }`;

const CICD_SAMPLE = `{
  "name": "build",
  "status": "success",
  "url": "https://ci.example.com/runs/42",
  "branch": "main",
  "repo": "acme/web"
}`;

/* ── Credentials form (from catalog form[]) ───────────────────────────── */

function CredentialsForm({ c, cfg, tester, onDone }) {
    const { showToast } = useToast();
    const config = cfg.data?.config || {};
    const connected = !!cfg.data?.connected;
    const initial = () => Object.fromEntries((c.form || []).map((f) => {
        if (f.secret) return [f.key, ''];
        const saved = config[f.key];
        if (saved !== undefined && saved !== null && saved !== '') return [f.key, String(saved)];
        return [f.key, f.kind === 'select' ? (f.options?.[0]?.value ?? '') : ''];
    }));
    const [values, setValues] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const patch = () => {
        const out = {};
        for (const f of c.form || []) {
            const v = String(values[f.key] ?? '').trim();
            if (f.secret) { if (v) out[f.key] = v; continue; }
            if (v !== String(config[f.key] ?? '') || !connected) out[f.key] = v;
        }
        return out;
    };
    const missing = (c.form || []).filter((f) => f.required && !String(values[f.key] ?? '').trim() && !(f.secret && hasFlag(config, f.key)));

    const save = async (e) => {
        e.preventDefault();
        if (missing.length) { setError(`Fill in: ${missing.map((f) => f.label).join(', ')}.`); return; }
        setError(null); setSaving(true);
        try {
            await cfg.save(patch());
            setValues((v) => Object.fromEntries(Object.entries(v).map(([k, val]) => [k, (c.form.find((f) => f.key === k)?.secret ? '' : val)])));
            showToast(connected ? `${c.label} settings saved` : `${c.label} connected`, 'success');
            onDone?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const set = (key) => (e) => { setValues((v) => ({ ...v, [key]: e.target.value })); setError(null); };

    return (
        <form className="stg-ws-panel" onSubmit={save} noValidate data-testid={`connector-form-${c.type}`}>
            {(c.form || []).map((f) => {
                const id = `conn-${c.type}-${f.key}`;
                const saved = f.secret && hasFlag(config, f.key);
                const hint = [f.hint, saved ? 'Saved. Leave empty to keep it.' : null].filter(Boolean).join(' ');
                const label = f.required ? f.label : `${f.label}${f.secret || f.kind === 'select' ? '' : ' (optional)'}`;
                let control;
                if (f.kind === 'select') {
                    control = (
                        <Select id={id} value={values[f.key] ?? ''} onChange={set(f.key)}>
                            {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                    );
                } else if (f.kind === 'textarea') {
                    control = (
                        <Textarea id={id} className="stg-mono oi-conn-textarea" rows={5} spellCheck={false} autoComplete="off"
                            placeholder={saved ? '•••• (saved)' : f.placeholder} value={values[f.key] ?? ''} onChange={set(f.key)} />
                    );
                } else {
                    const type = f.secret ? 'password' : f.kind === 'url' ? 'url' : f.kind === 'email' ? 'email' : 'text';
                    control = (
                        <Input id={id} type={type} autoComplete={f.secret ? 'new-password' : 'off'} spellCheck={false}
                            placeholder={saved ? '••••' : f.placeholder} value={values[f.key] ?? ''} onChange={set(f.key)} />
                    );
                }
                return <Field key={f.key} label={label} id={id} hint={hint || undefined}>{control}</Field>;
            })}
            {error && <div className="stg-error-text" role="alert">{error}</div>}
            <div className="stg-ws-actions">
                <Button type="submit" variant="primary" loading={saving}>{connected ? 'Save' : 'Save and connect'}</Button>
                {(c.form || []).length > 0 && (
                    <Button icon={ShieldCheck} loading={tester.testing} disabled={saving} onClick={() => tester.run(patch())}>Test connection</Button>
                )}
            </div>
            <TestResult result={tester.result} />
        </form>
    );
}

/* ── Webhook (Oruinwan's receiving URL) ───────────────────────────────── */

function WebhookBlock({ c, cfg, workspaceId }) {
    const { showToast } = useToast();
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);
    const { data } = cfg;
    const rotate = async () => {
        setBusy(true);
        try {
            const r = await rotateIntegrationSecret(c.type, workspaceId);
            cfg.setData((d) => ({ ...d, ...(r || {}), config: { ...(d?.config || {}), ...(r?.config || {}) } }));
            showToast(`New secret created. Update it in ${c.label}.`, 'success');
            setConfirm(false);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };
    if (!data?.webhookUrl && !data?.webhookSecret) return null;
    const masked = isMasked(data.webhookUrl);
    return (
        <div className="oi-setup-block">
            <h3 className="oi-setup-h">Send {c.label} events to Oruinwan</h3>
            {data.webhookSecret && (
                <Notice tone="success"><strong>Copy it now — it’s shown once.</strong> After you leave this page the secret is hidden; rotating creates a new one.</Notice>
            )}
            {data.webhookUrl && (masked
                ? <p className="stg-hint">The webhook URL contains a private token and is hidden (<span className="stg-mono">{data.webhookUrl}</span>). Rotate the secret to see a new URL.</p>
                : <CopyField id={`conn-${c.type}-url`} label="Webhook URL" value={data.webhookUrl} secret={!!c.webhook?.tokenInUrl} />)}
            {data.webhookSecret && <CopyField id={`conn-${c.type}-secret`} label="Webhook secret" value={data.webhookSecret} secret />}
            {c.webhook?.how && <p className="stg-hint">Authentication: {c.webhook.how}.</p>}
            {c.webhook?.generatedSecret && (
                <>
                    <Button size="sm" icon={RefreshCw} onClick={() => setConfirm(true)}>Rotate secret</Button>
                    <ConfirmDialog open={confirm} title={`Rotate the ${c.label} secret?`} confirmLabel="Rotate" loading={busy} onConfirm={rotate} onCancel={() => setConfirm(false)}>
                        {c.label} deliveries fail until you paste the new {c.webhook.tokenInUrl ? 'URL' : 'secret'} into {c.label}.
                    </ConfirmDialog>
                </>
            )}
        </div>
    );
}

/* ── Per-connector extras ─────────────────────────────────────────────── */

function TeamsSendTest({ workspaceId }) {
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true);
        try {
            await runConnectorAction('teams', 'send-test', workspaceId, { method: 'POST' });
            showToast('Test message sent to Teams', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };
    return <Button size="sm" icon={Send} loading={busy} onClick={go}>Send test message</Button>;
}

function Extras({ c, cfg, workspaceId }) {
    const config = cfg.data?.config || {};
    if (c.type === 'google_meet') {
        return <Notice>Without a token, people can still share a meeting by pasting a Meet link: <code>/gmeet https://meet.google.com/abc-defg-hij</code>.</Notice>;
    }
    if (c.type === 'teams' && config.hasWebhookUrl) {
        return (
            <div className="oi-setup-block">
                <h3 className="oi-setup-h">Check the Teams webhook</h3>
                <p className="stg-hint">Posts a visible test message to the Teams channel of the webhook URL.</p>
                <TeamsSendTest workspaceId={workspaceId} />
            </div>
        );
    }
    if (c.category === 'automation' || c.type === 'cicd') {
        return (
            <div className="oi-setup-block">
                <h3 className="oi-setup-h">Example payload</h3>
                <pre className="oi-conn-code stg-mono">{c.type === 'cicd' ? CICD_SAMPLE : AUTOMATION_SAMPLE}</pre>
                <p className="stg-hint">
                    POST it as JSON to the webhook URL above. This is the incoming direction.
                    {' '}To send Oruinwan events to {c.label}, add its URL under <strong>Outgoing webhooks</strong> on this page.
                </p>
            </div>
        );
    }
    return null;
}

/* ── One connector ────────────────────────────────────────────────────── */

function SetupSteps({ steps, collapsed }) {
    if (!steps?.length) return null;
    const list = <ol className="oi-steps">{steps.filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}</ol>;
    if (!collapsed) return <div className="oi-setup-block oi-conn-first"><h3 className="oi-setup-h">How to set it up</h3>{list}</div>;
    return (
        <details className="stg-ws-details oi-conn-steps">
            <summary><ChevronRight size={14} /> How to set it up</summary>
            <div className="stg-ws-details-body">{list}</div>
        </details>
    );
}

function DefaultChannel({ cfg, channels, c }) {
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);
    const value = cfg.data?.config?.defaultChannelId || '';
    const change = async (v) => {
        setBusy(true);
        try {
            await cfg.save({ defaultChannelId: v || null });
            showToast('Default channel saved', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="oi-setup-block">
            <h3 className="oi-setup-h">Default channel</h3>
            <Field id={`conn-${c.type}-default`} hint="Used when no route matches.">
                <ChannelSelect id={`conn-${c.type}-default`} label="Default channel" channels={channels} value={value} onChange={change} disabled={busy} />
            </Field>
        </div>
    );
}

export function ConnectorItem({ c, workspaceId, isAdmin, channels }) {
    const cfg = useIntegrationConfig(c.type, workspaceId);
    const tester = useTester(c.type, workspaceId);
    const [open, setOpen] = useState(false);
    const { data } = cfg;
    const config = data?.config || {};
    const connected = !!data?.connected;
    const who = connected ? accountName(config.account) : null;
    const routes = c.routes;
    const allEvents = routes?.events?.map((e) => e.id) || null;
    const formShown = (c.form || []).length > 0 || !connected;

    return (
        <li className="stg-list-item oi-conn" data-testid={`connector-${c.type}`}>
            <div className="oi-conn-head stg-ws-item-wrap">
                <ProviderMark provider={c.type} size={28} title={c.label} />
                <div className="stg-ws-item-main">
                    <div className="oi-conn-title">
                        <span className="oi-conn-name">{c.label}</span>
                        {data && <StatusBadge data={data} />}
                        {who && <span className="oi-muted oi-conn-who">as {who}</span>}
                    </div>
                    <div className="oi-conn-desc">{c.description}</div>
                </div>
                {isAdmin && data && (
                    <div className="stg-ws-item-actions">
                        <Button size="sm" variant={connected || open ? 'secondary' : 'primary'} icon={connected ? Settings2 : PlugZap}
                            aria-expanded={open} aria-label={`${open ? 'Close' : connected ? 'Manage' : 'Connect'} ${c.label}`}
                            onClick={() => setOpen((o) => !o)}>
                            {open ? 'Close' : connected ? 'Manage' : 'Connect'}
                        </Button>
                    </div>
                )}
            </div>
            {cfg.loading && !data && <LoadingState label={`Loading ${c.label}…`} inline />}
            {cfg.error && <ErrorState message={cfg.error} onRetry={cfg.reload} />}

            {isAdmin && open && data && (
                <div className="oi-setup-body oi-conn-body">
                    <SetupSteps steps={c.setup} collapsed={connected} />
                    {connected && (
                        <div className="oi-setup-status">
                            <span>{who ? <>Connected as <strong>{who}</strong> · </> : null}{c.webhook ? <LastEvent at={data.lastEventAt} /> : null}</span>
                            <div className="stg-ws-actions">
                                {!(c.form || []).length && <Button size="sm" icon={ShieldCheck} loading={tester.testing} onClick={() => tester.run({})}>Test connection</Button>}
                                <DisconnectButton type={c.type} label={c.label} workspaceId={workspaceId} onDone={() => { setOpen(false); cfg.reload(); }} />
                            </div>
                        </div>
                    )}
                    {connected && !(c.form || []).length && <TestResult result={tester.result} />}
                    {formShown && <CredentialsForm key={connected ? 'edit' : 'new'} c={c} cfg={cfg} tester={tester} />}

                    {connected && (
                        <>
                            {c.webhook && <WebhookBlock c={c} cfg={cfg} workspaceId={workspaceId} />}
                            {(c.toggles || []).length > 0 && (
                                <div className="oi-setup-block">
                                    <h3 className="oi-setup-h">Behaviour</h3>
                                    <SettingToggles items={c.toggles} config={config} onSave={cfg.save} disabled={!isAdmin} />
                                </div>
                            )}
                            {c.defaultChannel && <DefaultChannel c={c} cfg={cfg} channels={channels} />}
                            {routes && (
                                <RoutesBlock
                                    cfg={cfg} isAdmin={isAdmin} channels={channels}
                                    editorProps={{
                                        keyName: 'match', keyLabel: routes.label, keyPlaceholder: routes.placeholder, keyHint: routes.hint,
                                        validateKey: (v) => (v === '*' && routes.wildcard === false ? 'Use a name, not *' : null),
                                        events: routes.events || null, idPrefix: `conn-${c.type}-route`,
                                    }}
                                    normalise={(r) => ({
                                        match: String(r.match || '').trim(), channelId: r.channelId,
                                        ...(allEvents ? { events: r.events?.length ? r.events : allEvents } : {}),
                                    })}
                                    validate={(list) => (list.some((r) => !r.match || !r.channelId || (r.match === '*' && routes.wildcard === false))
                                        ? `Every route needs a ${String(routes.label || 'name').toLowerCase()} and a channel.` : null)}
                                />
                            )}
                            {c.bridge && <BridgesBlock c={c} cfg={cfg} channels={channels} workspaceId={workspaceId} />}
                            {(routes || c.defaultChannel || c.bridge) && <Notice>{FIRST_MESSAGE_HINT}</Notice>}
                        </>
                    )}
                    <Extras c={c} cfg={cfg} workspaceId={workspaceId} />
                </div>
            )}
        </li>
    );
}

/* ── All connectors, grouped by category ──────────────────────────────── */

export default function ConnectorCatalog({ workspaceId, isAdmin }) {
    const [connectors, setConnectors] = useState(null);
    const [error, setError] = useState(null);
    const channels = useWorkspaceChannels(workspaceId);

    const load = useCallback(async () => {
        setError(null);
        try {
            setConnectors(await getConnectorCatalog(workspaceId));
        } catch (err) {
            setError(err.message);
        }
    }, [workspaceId]);

    useEffect(() => { setConnectors(null); load(); }, [load]);

    const groups = useMemo(() => {
        if (!connectors) return [];
        const known = CATEGORIES.map((cat) => ({ ...cat, items: connectors.filter((c) => c.category === cat.id) }));
        const other = connectors.filter((c) => !CATEGORIES.some((cat) => cat.id === c.category));
        if (other.length) known.push({ id: 'other', label: 'Other', description: null, items: other });
        return known.filter((g) => g.items.length);
    }, [connectors]);

    if (error) return <Section title="Apps"><ErrorState message={error} onRetry={load} /></Section>;
    if (!connectors) return <Section title="Apps"><LoadingState label="Loading apps…" inline /></Section>;

    return groups.map((g) => (
        <Section key={g.id} id={`integrations-${g.id}`} title={g.label}
            description={isAdmin === false ? `${g.description || ''} Only workspace admins can connect apps.`.trim() : g.description}>
            <ul className="stg-list" data-testid={`connector-group-${g.id}`}>
                {g.items.map((c) => (
                    <ConnectorItem key={`${workspaceId}-${c.type}`} c={c} workspaceId={workspaceId} isAdmin={isAdmin} channels={channels} />
                ))}
            </ul>
        </Section>
    ));
}
