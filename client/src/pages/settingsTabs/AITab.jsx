import React, { useEffect, useState, useCallback } from 'react';
import { Sparkles, Loader2, Check, X, RefreshCw, Eye, EyeOff, Plug, Unplug, Activity, ShieldCheck } from 'lucide-react';
import { aiService, aiErrorMessage } from '../../services/aiService';
import { useToast } from '../../contexts/ToastContext';

const S = { font: { fontFamily: 'Inter, system-ui, -apple-system, sans-serif' } };

const PROVIDER_META = {
    default: { label: 'Server default', desc: 'Whatever the server is configured with (usually Gemini).' },
    gemini: { label: 'Google Gemini', desc: 'Gemini 2.5 models via Google AI Studio key.', keyHint: 'AIza…' },
    openai: { label: 'OpenAI', desc: 'GPT-4o family via an OpenAI API key.', keyHint: 'sk-…' },
    anthropic: { label: 'Anthropic Claude', desc: 'Claude Sonnet / Haiku via an Anthropic API key.', keyHint: 'sk-ant-…' },
    local_llm: { label: 'Local / self-hosted', desc: 'Any OpenAI-compatible endpoint: Ollama, LM Studio, vLLM…', keyHint: 'optional', needsUrl: true },
};

const inputS = {
    width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)',
    borderRadius: 2, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', ...S.font,
};
const labelS = { display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6, ...S.font };
const cardS = { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 2, padding: 16 };
const btnS = (primary) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 2, cursor: 'pointer', ...S.font,
    background: primary ? 'var(--accent)' : 'var(--bg-active)', color: primary ? '#0c0c0c' : 'var(--text-secondary)', border: `1px solid ${primary ? 'var(--accent)' : 'var(--border-default)'}`,
});

function Toggle({ checked, onChange, disabled }) {
    return (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
            style={{ width: 36, height: 20, borderRadius: 99, border: '1px solid var(--border-default)', background: checked ? 'var(--accent)' : 'var(--bg-active)', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, padding: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: checked ? 17 : 2, width: 14, height: 14, borderRadius: '50%', background: checked ? '#0c0c0c' : 'var(--text-muted)', transition: 'left 150ms ease' }} />
        </button>
    );
}

/** Settings → AI: on/off switches, provider & model per workspace, API keys, usage. */
export default function AITab({ workspaceId }) {
    const { showToast } = useToast();
    const [settings, setSettings] = useState(null);
    const [canManage, setCanManage] = useState(false);
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [model, setModel] = useState('');
    const [keyProvider, setKeyProvider] = useState('gemini');
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [showKey, setShowKey] = useState(false);

    const load = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const [s, u] = await Promise.all([aiService.getSettings(workspaceId), aiService.usage(workspaceId, 30).catch(() => null)]);
            setSettings(s.settings);
            setCanManage(!!s.canManage);
            setModel(s.settings.model || '');
            setUsage(u);
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not load AI settings'), 'error');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, showToast]);

    useEffect(() => { load(); }, [load]);

    const patch = async (changes, okMessage = 'Saved') => {
        setSaving(true);
        try {
            const s = await aiService.updateSettings(workspaceId, changes);
            setSettings(s.settings);
            setModel(s.settings.model || '');
            showToast(okMessage, 'success');
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not save'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const connectKey = async () => {
        const meta = PROVIDER_META[keyProvider];
        if (!apiKey.trim() && keyProvider !== 'local_llm') { showToast('Enter an API key', 'error'); return; }
        if (meta?.needsUrl && !baseUrl.trim()) { showToast('Enter the endpoint URL', 'error'); return; }
        setSaving(true);
        try {
            await aiService.connectProvider(workspaceId, keyProvider, apiKey.trim() || 'local', baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {});
            setApiKey('');
            showToast(`${meta.label} connected`, 'success');
            await patch({ provider: keyProvider }, `${meta.label} is now this workspace's provider`);
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not connect provider'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const disconnect = async (provider) => {
        setSaving(true);
        try {
            await aiService.disconnectProvider(workspaceId, provider);
            if (settings?.provider === provider) await patch({ provider: 'default' }, 'Back to the server default provider');
            else await load();
            showToast('Provider disconnected', 'success');
        } catch (err) {
            showToast(aiErrorMessage(err, 'Could not disconnect'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const test = async () => {
        setTesting(true);
        try {
            const r = await aiService.testProvider(workspaceId);
            showToast(`Connected: ${r.provider} · ${r.model}`, 'success');
        } catch (err) {
            showToast(aiErrorMessage(err, 'Provider test failed'), 'error');
        } finally {
            setTesting(false);
        }
    };

    if (!workspaceId) return <p style={{ fontSize: 13, color: 'var(--text-muted)', ...S.font }}>Select a workspace to manage its AI settings.</p>;
    if (loading || !settings) return <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, ...S.font }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading AI settings…</div>;

    const effective = settings.effective || {};
    const connected = settings.connected || [];
    const providerOptions = ['default', ...(settings.available || []).map(p => p.name)];
    const modelsFor = (name) => (name === 'default' ? settings.defaultProvider?.models : settings.available?.find(p => p.name === name)?.models) || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={cardS}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, background: 'var(--bg-active)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={15} style={{ color: 'var(--accent)' }} /></div>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0, ...S.font }}>Chttrix Intelligence</h3>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', ...S.font }}>
                                Using <strong style={{ color: 'var(--text-secondary)' }}>{PROVIDER_META[effective.provider]?.label || effective.provider}</strong> · {effective.model} · {effective.source === 'workspace' ? 'workspace key' : 'server default'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={load} style={btnS(false)} title="Refresh"><RefreshCw size={12} /></button>
                        {canManage && <button onClick={test} disabled={testing} style={btnS(false)}>{testing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={12} />} Test connection</button>}
                    </div>
                </div>
                {!canManage && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, ...S.font }}>Only workspace admins can change these settings.</p>}
            </div>

            <div style={cardS}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', ...S.font }}>Features</h4>
                {[
                    { key: 'enabled', label: 'AI features', desc: 'Assistant, summaries, drafts, translation, note and task helpers.' },
                    { key: 'smartReplies', label: 'Smart replies', desc: 'Reply suggestions under the message box in channels and DMs.' },
                ].map(f => (
                    <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                        <div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, ...S.font }}>{f.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', ...S.font }}>{f.desc}</div>
                        </div>
                        <Toggle checked={settings[f.key] !== false} disabled={!canManage || saving} onChange={(v) => patch({ [f.key]: v }, v ? `${f.label} on` : `${f.label} off`)} />
                    </div>
                ))}
            </div>

            <div style={cardS}>
                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', ...S.font }}>Model</h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px', ...S.font }}>Pick which AI provider and model this workspace uses. Adding a new model later is just a new entry here.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
                    <div>
                        <label style={labelS}>Provider</label>
                        <select value={settings.provider || 'default'} disabled={!canManage || saving} onChange={e => patch({ provider: e.target.value, model: null }, 'Provider updated')} style={inputS}>
                            {providerOptions.map(name => {
                                const isConnected = name === 'default' || connected.some(c => c.provider === name && c.status === 'active') || settings.available?.find(p => p.name === name)?.connected;
                                return <option key={name} value={name}>{PROVIDER_META[name]?.label || name}{name !== 'default' && !isConnected ? ' (no key connected)' : ''}</option>;
                            })}
                        </select>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0', ...S.font }}>{PROVIDER_META[settings.provider || 'default']?.desc}</p>
                    </div>
                    <div>
                        <label style={labelS}>Model (blank = provider default: {modelsFor(settings.provider || 'default').chat || '—'})</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <input value={model} disabled={!canManage || saving} onChange={e => setModel(e.target.value)} placeholder={modelsFor(settings.provider || 'default').chat || 'model id'} style={inputS} list="ai-model-suggestions" />
                            <datalist id="ai-model-suggestions">
                                {['gemini-2.5-flash', 'gemini-2.5-pro', 'gpt-4o-mini', 'gpt-4o', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001', 'llama3.1', 'qwen2.5'].map(m => <option key={m} value={m} />)}
                            </datalist>
                            {canManage && <button onClick={() => patch({ model: model.trim() || null }, 'Model updated')} disabled={saving || (model || '') === (settings.model || '')} style={btnS(true)}><Check size={12} /></button>}
                        </div>
                    </div>
                </div>
            </div>

            {canManage && (
                <div style={cardS}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', ...S.font }}>API keys</h4>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px', ...S.font }}>Keys are encrypted at rest with the server key and never shown again.</p>
                    {connected.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                            {connected.map(c => (
                                <div key={c.provider} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: 2 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-primary)', ...S.font }}>
                                        <Plug size={11} style={{ color: c.status === 'active' ? 'var(--state-success)' : 'var(--text-muted)', marginRight: 6 }} />
                                        {PROVIDER_META[c.provider]?.label || c.provider} <span style={{ color: 'var(--text-muted)' }}>· {c.status}{c.baseUrl ? ` · ${c.baseUrl}` : ''}</span>
                                    </div>
                                    {c.status === 'active' && <button onClick={() => disconnect(c.provider)} disabled={saving} style={{ ...btnS(false), padding: '4px 8px' }}><Unplug size={11} /> Disconnect</button>}
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,180px) minmax(0,1fr)', gap: 10, alignItems: 'end' }}>
                        <div>
                            <label style={labelS}>Provider</label>
                            <select value={keyProvider} onChange={e => setKeyProvider(e.target.value)} style={inputS}>
                                {(settings.available || []).map(p => <option key={p.name} value={p.name}>{PROVIDER_META[p.name]?.label || p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelS}>API key</label>
                            <div style={{ position: 'relative' }}>
                                <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={PROVIDER_META[keyProvider]?.keyHint || 'key'} style={{ ...inputS, paddingRight: 34 }} autoComplete="off" />
                                <button type="button" onClick={() => setShowKey(v => !v)} style={{ position: 'absolute', right: 6, top: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>{showKey ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                            </div>
                        </div>
                        {PROVIDER_META[keyProvider]?.needsUrl && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={labelS}>Endpoint URL (OpenAI-compatible)</label>
                                <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" style={inputS} />
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: 10 }}>
                        <button onClick={connectKey} disabled={saving} style={btnS(true)}>{saving ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plug size={12} />} Connect &amp; use this provider</button>
                    </div>
                </div>
            )}

            {usage && (
                <div style={cardS}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6, ...S.font }}><Activity size={13} style={{ color: 'var(--accent)' }} /> Usage · last {usage.days} days · {usage.scope === 'workspace' ? 'whole workspace' : 'you'}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 12 }}>
                        {[['Calls', usage.totals.calls], ['Errors', usage.totals.errors], ['Avg latency', `${usage.totals.avgMs} ms`], ['People', usage.totals.users]].map(([k, v]) => (
                            <div key={k} style={{ background: 'var(--bg-active)', border: '1px solid var(--border-default)', padding: '8px 10px', borderRadius: 2 }}>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', ...S.font }}>{k}</div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', ...S.font }}>{v}</div>
                            </div>
                        ))}
                    </div>
                    {usage.byIntent.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, ...S.font }}>
                            <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}><th style={{ padding: '4px 0', fontWeight: 600 }}>Feature</th><th style={{ fontWeight: 600 }}>Calls</th><th style={{ fontWeight: 600 }}>Errors</th><th style={{ fontWeight: 600 }}>Avg</th></tr></thead>
                            <tbody>
                                {usage.byIntent.map(r => (
                                    <tr key={r.intent} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                        <td style={{ padding: '5px 0' }}>{r.intent.replace(/_/g, ' ')}</td><td>{r.calls}</td><td style={{ color: r.errors ? 'var(--state-danger)' : 'inherit' }}>{r.errors}</td><td>{r.avgMs} ms</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {usage.totals.calls === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, ...S.font }}>No AI activity yet.</p>}
                </div>
            )}
            {saving && <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, ...S.font }}><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</div>}
            {settings.enabled === false && <div style={{ fontSize: 12, color: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: 6, ...S.font }}><X size={12} /> AI is currently off for this workspace.</div>}
        </div>
    );
}
