import React, { useEffect, useState } from 'react';
import { KeyRound, PlugZap, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import {
    Badge, Button, ConfirmDialog, ErrorState, Field, Input, LoadingState, Notice, Section, SwitchRow,
} from '../../../pages/settingsTabs/settingsUi';
import { ProviderMark } from '../ui';
import { isRepo } from '../prRefs';
import { rotateIntegrationSecret, testIntegration, disconnectDevIntegration, clearConnectionCache } from '../integrationsApi';
import { CopyField, RouteEditor, sameJson, useIntegrationConfig, useWorkspaceChannels } from './setupKit';
import '../integrations.css';
import './setup.css';

/* ── Shared shell ──────────────────────────────────────────────────────── */

function StatusBadge({ data }) {
    if (!data) return null;
    if (data.connected) return <Badge tone="success">Connected</Badge>;
    if (data.status === 'error') return <Badge tone="danger">Needs attention</Badge>;
    return <Badge>Not connected</Badge>;
}

const MASK = '••••';
const isMasked = (v) => typeof v === 'string' && v.includes(MASK);

function LastEvent({ at }) {
    if (!at) return <span className="oi-muted">No events received yet</span>;
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return null;
    return <span className="oi-muted">Last event {d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>;
}

const FIRST_MESSAGE_HINT = 'Cards appear in a channel only after someone has sent at least one message there (Oruinwan needs that channel’s encryption key). Say hi in a new channel before routing events to it.';

function ProviderShell({ provider, title, description, cfg, isAdmin, children, onConnectClick, connectOpen }) {
    const { data, loading, error, reload } = cfg;
    return (
        <Section
            id={`integration-${provider}`}
            title={(
                <span className="oi-setup-title">
                    <ProviderMark provider={provider} size={22} /> {title} <StatusBadge data={data} />
                </span>
            )}
            description={description}
            action={isAdmin && data && !data.connected && !connectOpen
                ? <Button size="sm" variant="primary" icon={PlugZap} onClick={onConnectClick}>Connect</Button>
                : null}
        >
            <div className="oi-setup-body" data-testid={`setup-${provider}`}>
                {loading && !data ? <LoadingState label={`Loading ${title}…`} inline />
                    : error ? <ErrorState message={error} onRetry={reload} />
                        : children}
            </div>
        </Section>
    );
}

function TestResult({ result }) {
    if (!result) return null;
    return (
        <div className="oi-test" role="status" data-ok={result.ok ? 'true' : 'false'}>
            {result.ok ? <ShieldCheck size={13} aria-hidden="true" /> : null}
            {result.message}
        </div>
    );
}

function useTester(type, workspaceId) {
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState(null);
    const run = async (overrides) => {
        setTesting(true); setResult(null);
        try {
            const r = await testIntegration(type, workspaceId, overrides && typeof overrides === 'object' && !overrides.nativeEvent ? overrides : {});
            const ok = r?.ok !== false;
            const acct = r?.account;
            const who = typeof acct === 'string' ? acct : (acct?.login || acct?.name || acct?.displayName || acct?.email || r?.login);
            setResult({ ok, message: r?.message || (ok ? `Connection works${who ? ` — signed in as ${who}` : ''}.` : 'The connection test failed.') });
            return ok;
        } catch (err) {
            setResult({ ok: false, message: err.message });
            return false;
        } finally {
            setTesting(false);
        }
    };
    return { testing, result, run, setResult };
}

function DisconnectButton({ type, label, workspaceId, onDone }) {
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true);
        try {
            await disconnectDevIntegration(type, workspaceId);
            clearConnectionCache();
            showToast(`${label} disconnected`, 'success');
            setOpen(false);
            onDone();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };
    return (
        <>
            <Button size="sm" variant="danger-soft" icon={Unplug} onClick={() => setOpen(true)}>Disconnect</Button>
            <ConfirmDialog open={open} title={`Disconnect ${label}?`} tone="danger" confirmLabel="Disconnect" loading={busy} onConfirm={go} onCancel={() => setOpen(false)}>
                Oruinwan stops posting {label} events and the saved credentials are deleted. Messages already posted stay.
            </ConfirmDialog>
        </>
    );
}

/** Toggle rows that save immediately. */
function SettingToggles({ items, config, onSave, disabled }) {
    const { showToast } = useToast();
    const [pending, setPending] = useState(null);
    const flip = async (key, value) => {
        setPending(key);
        try { await onSave({ [key]: value }); } catch (err) { showToast(err.message, 'error'); } finally { setPending(null); }
    };
    return (
        <div className="oi-setup-toggles">
            {items.map((it) => (
                <SwitchRow key={it.key} label={it.label} description={it.description}
                    checked={!!config?.[it.key]} disabled={disabled || pending === it.key}
                    onChange={(v) => flip(it.key, typeof v === 'boolean' ? v : !config?.[it.key])} />
            ))}
        </div>
    );
}

/** Routes with a Save/Discard bar. */
function RoutesBlock({ cfg, isAdmin, channels, editorProps, normalise, validate }) {
    const { showToast } = useToast();
    const saved = cfg.data?.config?.routes || [];
    const [routes, setRoutes] = useState(saved);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);
    useEffect(() => { setRoutes(cfg.data?.config?.routes || []); }, [cfg.data?.config?.routes]);
    const dirty = !sameJson(routes, saved);
    const save = async () => {
        const clean = routes.map(normalise).filter((r) => r[editorProps.keyName] || r.channelId);
        const problem = validate(clean);
        setErr(problem);
        if (problem) return;
        setSaving(true);
        try { await cfg.save({ routes: clean }); showToast('Routes saved', 'success'); } catch (e) { setErr(e.message); } finally { setSaving(false); }
    };
    return (
        <div className="oi-setup-block">
            <h3 className="oi-setup-h">Where events are posted</h3>
            <RouteEditor routes={routes} onChange={setRoutes} channels={channels} disabled={!isAdmin} {...editorProps} />
            {err && <div className="stg-error-text" role="alert">{err}</div>}
            {isAdmin && dirty && (
                <div className="stg-ws-actions oi-setup-save">
                    <Button variant="primary" size="sm" loading={saving} onClick={save}>Save routes</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setRoutes(saved); setErr(null); }} disabled={saving}>Discard</Button>
                </div>
            )}
        </div>
    );
}

/* ── GitHub ────────────────────────────────────────────────────────────── */

const GH_EVENTS = [
    { id: 'pull_request', label: 'Pull requests' },
    { id: 'pull_request_review', label: 'Reviews' },
    { id: 'issues', label: 'Issues' },
    { id: 'push', label: 'Pushes' },
    { id: 'check_suite', label: 'Checks' },
];

function WebhookInstructions({ webhookUrl, secret, cfg, isAdmin, workspaceId }) {
    const { showToast } = useToast();
    const [rotating, setRotating] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const rotate = async () => {
        setRotating(true);
        try {
            const r = await rotateIntegrationSecret('github', workspaceId);
            cfg.setData((d) => ({ ...d, webhookSecret: r?.webhookSecret || r?.secret || null, webhookUrl: r?.webhookUrl || d.webhookUrl }));
            showToast('New webhook secret created — update it in GitHub', 'success');
            setConfirm(false);
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setRotating(false);
        }
    };
    return (
        <div className="oi-setup-block">
            <h3 className="oi-setup-h">Send GitHub events to Oruinwan</h3>
            {secret && (
                <Notice tone="success"><strong>Copy the webhook secret now.</strong> It won’t be shown again after you leave this page.</Notice>
            )}
            <CopyField id="gh-webhook-url" label="Payload URL" value={webhookUrl} />
            {secret && !isMasked(secret)
                ? <CopyField id="gh-webhook-secret" label="Secret" value={secret} secret />
                : <p className="stg-hint">{cfg.data?.config?.hasWebhookSecret === false ? 'No webhook secret yet — rotate to create one.' : 'The webhook secret is saved and hidden.'} {isAdmin ? 'Rotating shows a new one (then paste it into GitHub).' : ''}</p>}
            <ol className="oi-steps">
                <li>In GitHub, open the repository (or organisation) → <strong>Settings → Webhooks → Add webhook</strong>.</li>
                <li><strong>Payload URL</strong>: paste the URL above. <strong>Content type</strong>: <code>application/json</code>.</li>
                <li><strong>Secret</strong>: paste the secret above.</li>
                <li>Choose <strong>Let me select individual events</strong> and tick <em>Pull requests</em>, <em>Pull request reviews</em>, <em>Issues</em>, <em>Pushes</em> and <em>Check suites</em>.</li>
                <li>Keep <strong>Active</strong> ticked and click <strong>Add webhook</strong>. GitHub sends a ping — it shows a green tick when Oruinwan accepted it.</li>
                <li>Below, route each repository to the channel of the team that owns it.</li>
            </ol>
            <Notice>{FIRST_MESSAGE_HINT}</Notice>
            {isAdmin && (
                <>
                    <Button size="sm" icon={RefreshCw} onClick={() => setConfirm(true)}>Rotate secret</Button>
                    <ConfirmDialog open={confirm} title="Rotate the webhook secret?" confirmLabel="Rotate" loading={rotating} onConfirm={rotate} onCancel={() => setConfirm(false)}>
                        GitHub deliveries fail until you paste the new secret into the webhook settings in GitHub.
                    </ConfirmDialog>
                </>
            )}
        </div>
    );
}

function TokenForm({ onSubmit, busy, submitLabel, onCancel }) {
    const [token, setToken] = useState('');
    return (
        <form className="stg-ws-panel" onSubmit={(e) => { e.preventDefault(); if (token.trim()) onSubmit(token.trim()); }}>
            <Field label="Personal access token" id="gh-token"
                hint="Stored encrypted on the server and never shown again. Use a token of a bot or service account if you can.">
                <Input id="gh-token" type="password" autoComplete="off" spellCheck={false} placeholder="github_pat_… or ghp_…" value={token} onChange={(e) => setToken(e.target.value)} autoFocus />
            </Field>
            <div className="oi-scopes">
                <p><KeyRound size={12} aria-hidden="true" /> <strong>Permissions the token needs</strong></p>
                <ul>
                    <li><strong>Fine-grained token</strong> (recommended), for the repositories you route: <em>Pull requests: Read</em>, <em>Contents: Read</em>, <em>Metadata: Read</em>, and <em>Issues: Read and write</em> if you want <code>/github issue</code>.</li>
                    <li><strong>Classic token</strong>: the <code>repo</code> scope (read access is used; write only for <code>/github issue</code>).</li>
                    <li>Create one at GitHub → <strong>Settings → Developer settings → Personal access tokens</strong>.</li>
                </ul>
            </div>
            <div className="stg-ws-actions">
                <Button type="submit" variant="primary" loading={busy} disabled={!token.trim()}>{submitLabel}</Button>
                {onCancel && <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>}
            </div>
        </form>
    );
}

export function GitHubSetup({ workspaceId, isAdmin }) {
    const { showToast } = useToast();
    const cfg = useIntegrationConfig('github', workspaceId);
    const channels = useWorkspaceChannels(workspaceId);
    const tester = useTester('github', workspaceId);
    const [connectOpen, setConnectOpen] = useState(false);
    const [replacing, setReplacing] = useState(false);
    const [busy, setBusy] = useState(false);
    const { data } = cfg;
    const config = data?.config || {};

    const submitToken = async (token) => {
        setBusy(true);
        try {
            const first = !data?.connected;
            // Check the token before saving it.
            if (!(await tester.run({ token }))) return;
            await cfg.save(first ? { token, linkTasks: true, statusSync: true, autoReview: false } : { token });
            setConnectOpen(false); setReplacing(false);
            showToast(first ? 'GitHub connected' : 'Token replaced', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <ProviderShell
            provider="github"
            title="GitHub"
            description="Post pull requests, reviews, checks and issues in the right channel, link them to tasks, and review code next to the conversation."
            cfg={cfg} isAdmin={isAdmin} connectOpen={connectOpen} onConnectClick={() => setConnectOpen(true)}
        >
            {!data?.connected ? (
                isAdmin && connectOpen ? (
                    <>
                        <TokenForm onSubmit={submitToken} busy={busy || tester.testing} submitLabel="Test and connect" onCancel={() => setConnectOpen(false)} />
                        <TestResult result={tester.result} />
                    </>
                ) : (
                    <p className="stg-hint oi-setup-empty">{isAdmin ? 'Connect GitHub with a personal access token to get started.' : 'GitHub isn’t connected. Workspace admins can connect it.'}</p>
                )
            ) : (
                <>
                    <div className="oi-setup-status">
                        <span>Token {config.hasToken ? 'saved' : 'missing'}{config.login ? ` · ${config.login}` : ''} · <LastEvent at={data.lastEventAt} /></span>
                        {isAdmin && (
                            <div className="stg-ws-actions">
                                <Button size="sm" icon={ShieldCheck} loading={tester.testing} onClick={tester.run}>Test connection</Button>
                                <Button size="sm" variant="ghost" onClick={() => setReplacing((r) => !r)} aria-expanded={replacing}>Replace token</Button>
                                <DisconnectButton type="github" label="GitHub" workspaceId={workspaceId} onDone={cfg.reload} />
                            </div>
                        )}
                    </div>
                    <TestResult result={tester.result} />
                    {isAdmin && replacing && <TokenForm onSubmit={submitToken} busy={busy} submitLabel="Save token" onCancel={() => setReplacing(false)} />}
                    {!isAdmin && <Notice>Only workspace owners and admins can change the GitHub connection.</Notice>}

                    {isAdmin && <WebhookInstructions webhookUrl={data.webhookUrl} secret={data.webhookSecret} cfg={cfg} isAdmin={isAdmin} workspaceId={workspaceId} />}

                    <RoutesBlock
                        cfg={cfg} isAdmin={isAdmin} channels={channels}
                        editorProps={{
                            keyName: 'repo', keyLabel: 'Repository', keyPlaceholder: 'owner/name or *',
                            keyHint: 'Use * for every repository the webhook sends. More specific routes win.',
                            validateKey: (v) => (v === '*' || isRepo(v) ? null : 'Use owner/name (for example acme/web) or *'),
                            events: GH_EVENTS, idPrefix: 'gh-route',
                        }}
                        normalise={(r) => ({ repo: String(r.repo || '').trim(), channelId: r.channelId, events: r.events?.length ? r.events : GH_EVENTS.map((e) => e.id) })}
                        validate={(list) => {
                            const bad = list.find((r) => !(r.repo === '*' || isRepo(r.repo)) || !r.channelId);
                            if (bad) return 'Every route needs a repository (owner/name or *) and a channel.';
                            return null;
                        }}
                    />

                    <div className="oi-setup-block">
                        <h3 className="oi-setup-h">Behaviour</h3>
                        <SettingToggles
                            config={config} onSave={cfg.save} disabled={!isAdmin}
                            items={[
                                { key: 'linkTasks', label: 'Link tasks', description: 'Task keys in a PR title, branch or description (for example WEB-42) link the PR to that task.' },
                                { key: 'statusSync', label: 'Sync task status', description: 'Opening a PR moves linked tasks to In review; merging moves them to Done.' },
                                { key: 'autoReview', label: 'Oruinwan AI auto-review', description: 'Oruinwan AI reviews every new pull request and posts the review in its thread.' },
                            ]}
                        />
                    </div>
                </>
            )}
        </ProviderShell>
    );
}

/* ── Jira ──────────────────────────────────────────────────────────────── */

export function JiraSetup({ workspaceId, isAdmin }) {
    const { showToast } = useToast();
    const cfg = useIntegrationConfig('jira', workspaceId);
    const channels = useWorkspaceChannels(workspaceId);
    const tester = useTester('jira', workspaceId);
    const [connectOpen, setConnectOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ baseUrl: '', email: '', apiToken: '' });
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState(null);
    const { data } = cfg;
    const config = data?.config || {};

    const submit = async (e) => {
        e.preventDefault();
        const baseUrl = form.baseUrl.trim().replace(/\/+$/, '');
        if (!/^https:\/\/[^\s/]+/.test(baseUrl)) { setFormError('Enter your Jira site address, for example https://acme.atlassian.net'); return; }
        if (!form.email.trim() || (!form.apiToken.trim() && !config.hasApiToken)) { setFormError('Enter the account email and an API token.'); return; }
        setFormError(null); setBusy(true);
        try {
            const first = !data?.connected;
            const creds = { baseUrl, email: form.email.trim(), ...(form.apiToken.trim() ? { apiToken: form.apiToken.trim() } : {}) };
            if (!(await tester.run(creds))) { setFormError('Jira didn’t accept these details — check the site address, email and token.'); return; }
            await cfg.save({ ...creds, ...(first ? { linkTasks: true } : {}) });
            showToast(first ? 'Jira connected' : 'Jira settings saved', 'success');
            setConnectOpen(false); setEditing(false); setForm((f) => ({ ...f, apiToken: '' }));
        } catch (err) {
            setFormError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const showForm = isAdmin && ((!data?.connected && connectOpen) || editing);
    const openEdit = () => { setForm({ baseUrl: config.baseUrl || '', email: config.email || '', apiToken: '' }); setEditing((v) => !v); };

    const credentialsForm = (
        <form className="stg-ws-panel" onSubmit={submit} noValidate>
            <Field label="Jira site" id="jira-base"><Input id="jira-base" type="url" placeholder="https://acme.atlassian.net" value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} /></Field>
            <Field label="Account email" id="jira-email"><Input id="jira-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="API token" id="jira-token" hint={<>Create one at <strong>id.atlassian.com → Security → API tokens</strong>. The account needs “Browse projects” and “Create issues”.{config.hasApiToken ? ' Leave empty to keep the saved token.' : ''}</>}>
                <Input id="jira-token" type="password" autoComplete="off" value={form.apiToken} onChange={(e) => setForm((f) => ({ ...f, apiToken: e.target.value }))} />
            </Field>
            {formError && <div className="stg-error-text" role="alert">{formError}</div>}
            <div className="stg-ws-actions">
                <Button type="submit" variant="primary" loading={busy}>{data?.connected ? 'Save' : 'Connect and test'}</Button>
                <Button variant="ghost" onClick={() => { setConnectOpen(false); setEditing(false); setFormError(null); }} disabled={busy}>Cancel</Button>
            </div>
        </form>
    );

    return (
        <ProviderShell
            provider="jira"
            title="Jira"
            description="Post Jira issue updates in channels, create issues with /jira and link them to tasks."
            cfg={cfg} isAdmin={isAdmin} connectOpen={connectOpen} onConnectClick={() => { setForm({ baseUrl: '', email: '', apiToken: '' }); setConnectOpen(true); }}
        >
            {!data?.connected ? (showForm ? credentialsForm : <p className="stg-hint oi-setup-empty">{isAdmin ? 'Connect Jira Cloud with an API token.' : 'Jira isn’t connected. Workspace admins can connect it.'}</p>) : (
                <>
                    <div className="oi-setup-status">
                        <span><span className="stg-mono">{config.baseUrl}{config.email ? ` · ${config.email}` : ''}</span> · <LastEvent at={data.lastEventAt} /></span>
                        {isAdmin && (
                            <div className="stg-ws-actions">
                                <Button size="sm" icon={ShieldCheck} loading={tester.testing} onClick={tester.run}>Test connection</Button>
                                <Button size="sm" variant="ghost" onClick={openEdit} aria-expanded={editing}>Edit</Button>
                                <DisconnectButton type="jira" label="Jira" workspaceId={workspaceId} onDone={cfg.reload} />
                            </div>
                        )}
                    </div>
                    <TestResult result={tester.result} />
                    {showForm && credentialsForm}
                    {isAdmin && data.webhookUrl && (
                        <div className="oi-setup-block">
                            <h3 className="oi-setup-h">Send Jira events to Oruinwan</h3>
                            {isMasked(data.webhookUrl)
                                ? <p className="stg-hint">The webhook URL contains a private token and is hidden (<span className="stg-mono">{data.webhookUrl}</span>). Rotate the token to see a new URL, then update it in Jira.</p>
                                : <CopyField id="jira-webhook-url" label="Webhook URL" value={data.webhookUrl} secret={/token=/.test(data.webhookUrl)} />}
                            <JiraRotate cfg={cfg} workspaceId={workspaceId} />
                            <ol className="oi-steps">
                                <li>In Jira, open <strong>Settings → System → WebHooks → Create a WebHook</strong> (Jira admin).</li>
                                <li>Paste the URL above; it contains a private token, so keep it secret.</li>
                                <li>Under <strong>Issue related events</strong> tick <em>created</em>, <em>updated</em> and <em>deleted</em>. Optionally limit it with JQL, for example <code>project = WEB</code>.</li>
                                <li>Save. Changes in routed projects now appear in their channels.</li>
                            </ol>
                            <Notice>{FIRST_MESSAGE_HINT}</Notice>
                        </div>
                    )}
                    <RoutesBlock
                        cfg={cfg} isAdmin={isAdmin} channels={channels}
                        editorProps={{
                            keyName: 'project', keyLabel: 'Project key', keyPlaceholder: 'WEB or *', idPrefix: 'jira-route',
                            validateKey: (v) => (v === '*' || /^[A-Z][A-Z0-9_]{0,19}$/.test(v) ? null : 'Use the project key in capitals, for example WEB, or *'),
                        }}
                        normalise={(r) => ({ project: String(r.project || '').trim().toUpperCase(), channelId: r.channelId })}
                        validate={(list) => (list.some((r) => !r.project || !r.channelId) ? 'Every route needs a project key and a channel.' : null)}
                    />
                    <div className="oi-setup-block">
                        <h3 className="oi-setup-h">Behaviour</h3>
                        <SettingToggles config={config} onSave={cfg.save} disabled={!isAdmin}
                            items={[
                                { key: 'linkTasks', label: 'Link tasks', description: 'Issues created with /jira from a task, or mentioning a task key, are linked to that task.' },
                                { key: 'statusSync', label: 'Sync task status', description: 'When a linked Jira issue moves to Done (or back), the task follows.' },
                            ]} />
                    </div>
                </>
            )}
        </ProviderShell>
    );
}

function JiraRotate({ cfg, workspaceId }) {
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true);
        try {
            const r = await rotateIntegrationSecret('jira', workspaceId);
            cfg.setData((d) => ({ ...d, webhookUrl: r?.webhookUrl || d.webhookUrl }));
            showToast('New webhook URL created — update it in Jira', 'success');
            setOpen(false);
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setBusy(false);
        }
    };
    return (
        <div>
            <Button size="sm" icon={RefreshCw} onClick={() => setOpen(true)}>Rotate webhook token</Button>
            <ConfirmDialog open={open} title="Rotate the Jira webhook token?" confirmLabel="Rotate" loading={busy} onConfirm={go} onCancel={() => setOpen(false)}>
                The current webhook URL stops working. Paste the new URL into Jira’s webhook settings.
            </ConfirmDialog>
        </div>
    );
}

/* ── Zoom ──────────────────────────────────────────────────────────────── */

export function ZoomSetup({ workspaceId, isAdmin }) {
    const { showToast } = useToast();
    const cfg = useIntegrationConfig('zoom', workspaceId);
    const tester = useTester('zoom', workspaceId);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ accountId: '', clientId: '', clientSecret: '' });
    const [busy, setBusy] = useState(false);
    const [formError, setFormError] = useState(null);
    const { data } = cfg;
    const config = data?.config || {};

    const submit = async (e) => {
        e.preventDefault();
        const missing = ['accountId', 'clientId'].filter((k) => !form[k].trim());
        if (missing.length || (!form.clientSecret.trim() && !config.hasClientSecret)) { setFormError('Fill in the account ID, client ID and client secret.'); return; }
        setFormError(null); setBusy(true);
        try {
            const creds = { accountId: form.accountId.trim(), clientId: form.clientId.trim(), ...(form.clientSecret.trim() ? { clientSecret: form.clientSecret.trim() } : {}) };
            if (!(await tester.run(creds))) { setFormError('Zoom didn’t accept these details — check the IDs, the secret and that the app is activated.'); return; }
            await cfg.save(creds);
            showToast(data?.connected ? 'Zoom settings saved' : 'Zoom connected', 'success');
            setOpen(false); setForm((f) => ({ ...f, clientSecret: '' }));
        } catch (err) {
            setFormError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const formEl = (
        <form className="stg-ws-panel" onSubmit={submit} noValidate>
            <ol className="oi-steps">
                <li>In the Zoom App Marketplace choose <strong>Develop → Build App → Server-to-Server OAuth</strong>.</li>
                <li>Add the scope <code>meeting:write:meeting:admin</code> (or <code>meeting:write:admin</code> on older apps) and activate the app.</li>
                <li>Copy the <strong>Account ID</strong>, <strong>Client ID</strong> and <strong>Client secret</strong> here.</li>
            </ol>
            <Field label="Account ID" id="zoom-account"><Input id="zoom-account" autoComplete="off" value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} /></Field>
            <Field label="Client ID" id="zoom-client"><Input id="zoom-client" autoComplete="off" value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} /></Field>
            <Field label="Client secret" id="zoom-secret" hint={data?.connected ? 'Leave empty to keep the saved secret.' : undefined}>
                <Input id="zoom-secret" type="password" autoComplete="off" value={form.clientSecret} onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} />
            </Field>
            {formError && <div className="stg-error-text" role="alert">{formError}</div>}
            <div className="stg-ws-actions">
                <Button type="submit" variant="primary" loading={busy}>{data?.connected ? 'Save' : 'Connect and test'}</Button>
                <Button variant="ghost" onClick={() => { setOpen(false); setFormError(null); }} disabled={busy}>Cancel</Button>
            </div>
        </form>
    );

    return (
        <ProviderShell
            provider="zoom"
            title="Zoom"
            description="Start a Zoom meeting from any conversation with /zoom and post the join link."
            cfg={cfg} isAdmin={isAdmin} connectOpen={open} onConnectClick={() => { setForm({ accountId: '', clientId: '', clientSecret: '' }); setOpen(true); }}
        >
            {!data?.connected ? (isAdmin && open ? formEl : <p className="stg-hint oi-setup-empty">{isAdmin ? 'Connect a Zoom Server-to-Server OAuth app.' : 'Zoom isn’t connected. Workspace admins can connect it.'}</p>) : (
                <>
                    <div className="oi-setup-status">
                        <span>Account <span className="stg-mono">{config.accountId || '—'}</span></span>
                        {isAdmin && (
                            <div className="stg-ws-actions">
                                <Button size="sm" icon={ShieldCheck} loading={tester.testing} onClick={tester.run}>Test connection</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setForm({ accountId: config.accountId || '', clientId: config.clientId || '', clientSecret: '' }); setOpen((o) => !o); }} aria-expanded={open}>Edit</Button>
                                <DisconnectButton type="zoom" label="Zoom" workspaceId={workspaceId} onDone={cfg.reload} />
                            </div>
                        )}
                    </div>
                    <TestResult result={tester.result} />
                    {isAdmin && open && formEl}
                    <p className="stg-hint">Type <code>/zoom Design review</code> in a channel to create a meeting and share its link.</p>
                </>
            )}
        </ProviderShell>
    );
}

/** The three developer integrations, in order. */
export default function DevIntegrations({ workspaceId, isAdmin }) {
    return (
        <>
            <GitHubSetup key={`gh-${workspaceId}`} workspaceId={workspaceId} isAdmin={isAdmin} />
            <JiraSetup key={`jira-${workspaceId}`} workspaceId={workspaceId} isAdmin={isAdmin} />
            <ZoomSetup key={`zoom-${workspaceId}`} workspaceId={workspaceId} isAdmin={isAdmin} />
        </>
    );
}
