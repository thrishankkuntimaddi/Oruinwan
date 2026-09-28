import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ChevronRight, Layers, RefreshCcw, ShieldCheck, Sparkles } from 'lucide-react';
import { aiService, aiErrorMessage } from '../../services/aiService';
import { useToast } from '../../contexts/ToastContext';
import AIMemorySection from './AIMemorySection';
import {
    Badge, Button, EmptyState, ErrorState, Field, IconButton, Input, LoadingState, Notice, PageIntro, Row, Section, SwitchRow,
} from './settingsUi';
import './stg-ws.css';

/** Providers run by someone else. Oruinwan AI no longer offers them; old workspaces may still point at one. */
const THIRD_PARTY = ['gemini', 'openai', 'anthropic', 'claude'];

const PRIVACY_LINE = "Runs on Oruinwan's own servers. No third-party AI service sees your data.";

const engineLabel = (effective) => {
    if (effective?.source === 'workspace' && effective.provider === 'local_llm') return 'Oruinwan Engine (self-hosted)';
    if (effective?.source === 'workspace' && THIRD_PARTY.includes(effective.provider)) return 'External AI provider';
    return 'Oruinwan Engine';
};

const humanize = (id) => {
    const s = String(id || 'other').replace(/[_.-]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

const isHttpUrl = (value) => {
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

/** Settings → Oruinwan AI: status, personal memory, workspace features, engine, usage. */
export default function AITab({ workspaceId, workspaceName, workspacePicker }) {
    const { showToast } = useToast();
    const [settings, setSettings] = useState(null);
    const [canManage, setCanManage] = useState(false);
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [saving, setSaving] = useState(null); // key of the change in flight
    const [health, setHealth] = useState(null); // { ok, model?, message? }
    const [testing, setTesting] = useState(false);
    const [engine, setEngine] = useState({ baseUrl: '', apiKey: '', model: '' });
    const [engineError, setEngineError] = useState(null);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setLoadError(null);
        setHealth(null);
        try {
            const [s, u] = await Promise.all([
                aiService.getSettings(workspaceId),
                aiService.usage(workspaceId, 30).catch(() => null),
            ]);
            setSettings(s.settings);
            setCanManage(!!s.canManage);
            setUsage(u);
            setEngine({ baseUrl: '', apiKey: '', model: s.settings?.model || '' });
        } catch (err) {
            setLoadError(aiErrorMessage(err, 'Could not load AI settings'));
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    const patch = async (key, changes, okMessage) => {
        setSaving(key);
        try {
            const s = await aiService.updateSettings(workspaceId, changes);
            setSettings(s.settings);
            setEngine((e) => ({ ...e, model: s.settings?.model || '' }));
            setHealth(null);
            if (okMessage) showToast(okMessage, 'success');
            return true;
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not save'), 'error');
            return false;
        } finally {
            setSaving(null);
        }
    };

    const test = async () => {
        setTesting(true);
        try {
            const r = await aiService.testProvider(workspaceId);
            setHealth({ ok: true, model: r.model });
        } catch (err) {
            setHealth({ ok: false, message: aiErrorMessage(err, 'The engine did not answer.') });
        } finally {
            setTesting(false);
        }
    };

    const saveEngine = async () => {
        setEngineError(null);
        const baseUrl = engine.baseUrl.trim();
        const model = engine.model.trim();
        if (baseUrl && !isHttpUrl(baseUrl)) {
            setEngineError('Enter a full http:// or https:// address, for example https://ai.example.com/v1');
            return;
        }
        if (baseUrl) {
            setSaving('engine');
            try {
                await aiService.connectProvider(workspaceId, 'local_llm', engine.apiKey.trim() || 'local', { baseUrl });
            } catch (err) {
                setSaving(null);
                setEngineError(aiErrorMessage(err, 'Could not save the endpoint'));
                return;
            }
            const ok = await patch('engine', { provider: 'local_llm', model: model || null }, 'Workspace now uses your self-hosted engine');
            if (ok) setEngine({ baseUrl: '', apiKey: '', model });
            return;
        }
        await patch('engine', { model: model || null }, 'Model updated');
    };

    const useDefault = () => patch('default', { provider: 'default', model: null }, 'Back on the Oruinwan Engine');

    const intro = (
        <PageIntro
            title="Oruinwan AI"
            description="Your assistant: what it remembers about you, which features are on, and how much it is used."
        />
    );

    if (!workspaceId) {
        return (
            <>
                {intro}
                <Notice tone="success">{PRIVACY_LINE}</Notice>
                <AIMemorySection workspaceId="" />
                <Section title="Workspace AI">
                    <EmptyState icon={Layers}>Join or create a workspace to manage its AI features and see usage.</EmptyState>
                </Section>
            </>
        );
    }

    const effective = settings?.effective || {};
    const provider = settings?.provider || 'default';
    const thirdParty = THIRD_PARTY.includes(provider);
    const selfHosted = provider === 'local_llm';
    const selfHostedRecord = (settings?.connected || []).find((c) => c.provider === 'local_llm' && c.status === 'active');
    const defaultModel = settings?.defaultProvider?.models?.chat
        || settings?.available?.find((p) => p.name === 'local_llm')?.models?.chat
        || 'qwen2.5:3b';
    const modelDirty = (engine.model.trim() || '') !== (settings?.model || '');
    const engineDirty = !!engine.baseUrl.trim() || modelDirty;

    let statusBadge = null;
    if (settings?.enabled === false) statusBadge = <Badge>Off in this workspace</Badge>;
    else if (testing) statusBadge = <Badge>Checking…</Badge>;
    else if (health?.ok) statusBadge = <Badge tone="success">Online</Badge>;
    else if (health && !health.ok) statusBadge = <Badge tone="danger">Not reachable</Badge>;

    return (
        <>
            {intro}
            {workspacePicker}

            {loading && !settings ? (
                <Section><LoadingState label="Loading AI settings…" /></Section>
            ) : loadError ? (
                <Section><ErrorState message={loadError} onRetry={load} /></Section>
            ) : settings ? (
                <Section pad>
                    <div className="stg-ws-status">
                        <div className="stg-ws-status-icon" aria-hidden="true"><Sparkles size={17} /></div>
                        <div className="stg-ws-status-text">
                            <div className="stg-ws-status-title">
                                {engineLabel(effective)}
                                {statusBadge}
                            </div>
                            <div className="stg-ws-status-meta">
                                Model <span className="stg-mono">{health?.model || effective.model || defaultModel}</span>
                                {workspaceName ? ` · ${workspaceName}` : ''}
                            </div>
                            {health && !health.ok && <div className="stg-ws-status-meta" role="alert">{health.message}</div>}
                            {!thirdParty && (
                                <div className="stg-ws-status-privacy"><ShieldCheck size={13} /> {PRIVACY_LINE}</div>
                            )}
                        </div>
                        <div className="stg-ws-actions">
                            {canManage && (
                                <Button size="sm" icon={Activity} loading={testing} onClick={test} disabled={settings.enabled === false}>
                                    Check connection
                                </Button>
                            )}
                            <IconButton label="Refresh" onClick={load} disabled={loading}><RefreshCcw size={14} /></IconButton>
                        </div>
                    </div>
                </Section>
            ) : null}

            {settings && thirdParty && (
                canManage ? (
                    <Notice
                        tone="warning"
                        action={<Button size="sm" variant="primary" loading={saving === 'default'} onClick={useDefault}>Switch to Oruinwan Engine</Button>}
                    >
                        <strong>This workspace still sends AI requests to an outside provider.</strong> Oruinwan now has its own engine, so your data can stay on Oruinwan’s servers.
                    </Notice>
                ) : (
                    <Notice tone="warning">An admin set this workspace to use an outside AI provider. Ask them to switch to the Oruinwan Engine.</Notice>
                )
            )}

            <AIMemorySection workspaceId={workspaceId} />

            {settings && (
                <Section title="Features" description="Applies to everyone in this workspace.">
                    {!canManage && <div style={{ paddingTop: 12 }}><Notice>Only workspace admins can change these.</Notice></div>}
                    <SwitchRow
                        label="AI features"
                        description="Assistant, @Oruinwan replies in chats, summaries, drafts, translation, and note and task helpers."
                        checked={settings.enabled !== false}
                        disabled={!canManage || !!saving}
                        onChange={(v) => patch('enabled', { enabled: v }, v ? 'AI features on' : 'AI features off')}
                    />
                    <SwitchRow
                        label="Smart replies"
                        description="Reply suggestions under the message box in channels and direct messages."
                        checked={settings.smartReplies !== false}
                        disabled={!canManage || !!saving || settings.enabled === false}
                        onChange={(v) => patch('smartReplies', { smartReplies: v }, v ? 'Smart replies on' : 'Smart replies off')}
                    />
                </Section>
            )}

            {settings && canManage && (
                <Section title="Engine" description="Where this workspace’s AI runs.">
                    <Row
                        label="Endpoint"
                        description={selfHosted
                            ? <span className="stg-mono">{selfHostedRecord?.baseUrl || 'Self-hosted endpoint'}</span>
                            : 'Oruinwan servers (default)'}
                    >
                        <Badge tone={selfHosted ? 'accent' : 'success'}>{selfHosted ? 'Self-hosted' : thirdParty ? 'External' : 'Default'}</Badge>
                    </Row>
                    <Row label="Model" description={<span className="stg-mono">{effective.model || defaultModel}</span>} />

                    <details className="stg-ws-details">
                        <summary><ChevronRight size={14} /> Advanced: run on your own server</summary>
                        <div className="stg-ws-details-body">
                            <div className="stg-hint">
                                Point this workspace at any OpenAI-compatible server you run (for example Ollama or vLLM). Leave the endpoint empty to only change the model.
                            </div>
                            <div className="stg-grid-2">
                                <Field label="Endpoint URL" id="ai-engine-url" error={engineError}>
                                    <Input
                                        id="ai-engine-url"
                                        type="url"
                                        inputMode="url"
                                        value={engine.baseUrl}
                                        invalid={!!engineError}
                                        onChange={(e) => { setEngine((s) => ({ ...s, baseUrl: e.target.value })); setEngineError(null); }}
                                        placeholder={selfHostedRecord?.baseUrl || 'https://ai.example.com/v1'}
                                        autoComplete="off"
                                    />
                                </Field>
                                <Field label="Access key (optional)" id="ai-engine-key" hint="Stored encrypted. Never shown again.">
                                    <Input
                                        id="ai-engine-key"
                                        type="password"
                                        value={engine.apiKey}
                                        onChange={(e) => setEngine((s) => ({ ...s, apiKey: e.target.value }))}
                                        placeholder="Only if your server needs one"
                                        autoComplete="new-password"
                                        disabled={!engine.baseUrl.trim()}
                                    />
                                </Field>
                            </div>
                            <Field label="Model" id="ai-engine-model" hint={`Leave empty to use the default (${defaultModel}).`}>
                                <Input
                                    id="ai-engine-model"
                                    className="stg-mono"
                                    value={engine.model}
                                    onChange={(e) => setEngine((s) => ({ ...s, model: e.target.value }))}
                                    placeholder={defaultModel}
                                    maxLength={80}
                                    autoComplete="off"
                                />
                            </Field>
                            <div className="stg-ws-actions">
                                <Button variant="primary" loading={saving === 'engine'} disabled={!engineDirty || !!saving} onClick={saveEngine}>
                                    {engine.baseUrl.trim() ? 'Save and use' : 'Save model'}
                                </Button>
                                <Button icon={Activity} loading={testing} onClick={test} disabled={settings.enabled === false}>Test connection</Button>
                                <Button
                                    variant="ghost"
                                    loading={saving === 'default'}
                                    disabled={(provider === 'default' && !settings.model) || !!saving}
                                    onClick={useDefault}
                                >
                                    Use Oruinwan default
                                </Button>
                            </div>
                        </div>
                    </details>
                </Section>
            )}

            {settings && (
                <Section
                    title="Usage"
                    description={usage
                        ? `Last ${usage.days} days · ${usage.scope === 'workspace' ? 'everyone in this workspace' : 'just you'}`
                        : 'Last 30 days'}
                >
                    {!usage ? (
                        <EmptyState icon={Activity}>Usage isn’t available right now.</EmptyState>
                    ) : !usage.totals?.calls ? (
                        <EmptyState icon={Activity}>No AI activity in the last {usage.days} days.</EmptyState>
                    ) : (
                        <>
                            <div className="stg-ws-stats">
                                {[
                                    ['Requests', usage.totals.calls.toLocaleString()],
                                    ['Errors', usage.totals.errors.toLocaleString()],
                                    ['Avg. time', `${(usage.totals.avgMs / 1000).toFixed(1)} s`],
                                    ['People', usage.totals.users.toLocaleString()],
                                ].map(([label, value]) => (
                                    <div key={label} className="stg-ws-stat">
                                        <div className="stg-ws-stat-label">{label}</div>
                                        <div className="stg-ws-stat-value">{value}</div>
                                    </div>
                                ))}
                            </div>
                            {usage.byIntent?.length > 0 && (
                                <div className="stg-ws-table-wrap">
                                    <table className="stg-ws-table">
                                        <caption className="stg-ws-sr-only">AI usage by feature</caption>
                                        <thead>
                                            <tr>
                                                <th scope="col">Feature</th>
                                                <th scope="col" className="stg-ws-num">Requests</th>
                                                <th scope="col" className="stg-ws-num">Errors</th>
                                                <th scope="col" className="stg-ws-num">Avg. time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {usage.byIntent.map((r) => (
                                                <tr key={r.intent || 'other'}>
                                                    <td>{humanize(r.intent)}</td>
                                                    <td className="stg-ws-num">{r.calls}</td>
                                                    <td className="stg-ws-num" data-bad={r.errors ? 'true' : undefined}>{r.errors}</td>
                                                    <td className="stg-ws-num">{(r.avgMs / 1000).toFixed(1)} s</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </Section>
            )}
        </>
    );
}
