import React, { useState } from 'react';
import { ExternalLink, KeyRound, Plug, Unplug } from 'lucide-react';
import { aiService, aiErrorMessage } from '../../services/aiService';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Button, Field, Input, Notice, Row, Section } from './settingsUi';

/** The outside models a workspace can connect. People pick them in the AI panel or @mention them. */
export const ASSISTANT_CATALOG = [
    { id: 'anthropic', name: 'Claude', maker: 'Anthropic', mention: '@claude', keyHint: 'sk-ant-…', keysUrl: 'https://console.anthropic.com/settings/keys', modelHint: 'claude-sonnet-4-5' },
    { id: 'openai', name: 'ChatGPT', maker: 'OpenAI', mention: '@chatgpt', keyHint: 'sk-…', keysUrl: 'https://platform.openai.com/api-keys', modelHint: 'gpt-4o-mini' },
    { id: 'gemini', name: 'Gemini', maker: 'Google', mention: '@gemini', keyHint: 'AIza…', keysUrl: 'https://aistudio.google.com/app/apikey', modelHint: 'gemini-3.5-flash' },
    { id: 'xai', name: 'Grok', maker: 'xAI', mention: '@grok', keyHint: 'xai-…', keysUrl: 'https://console.x.ai', modelHint: 'grok-4' },
];

/**
 * Settings → AI → Assistants: connect Claude, ChatGPT, Gemini or Grok with the workspace's own
 * API key. Oruinwan AI stays the default; these answer only when someone picks or mentions them.
 */
export default function AIAssistantsSection({ workspaceId, connected = [], onChanged }) {
    const { showToast } = useToast();
    const [open, setOpen] = useState(null); // id of the assistant being connected
    const [form, setForm] = useState({ apiKey: '', model: '' });
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);

    const isConnected = (id) => connected.some((c) => (c.provider === id || (id === 'anthropic' && c.provider === 'claude')) && c.status === 'active');

    const startConnect = (id) => {
        setOpen(id);
        setForm({ apiKey: '', model: '' });
        setError(null);
    };

    const connect = async (a) => {
        if (!form.apiKey.trim()) { setError('Paste an API key'); return; }
        setBusy(a.id);
        setError(null);
        try {
            await aiService.connectProvider(workspaceId, a.id, form.apiKey.trim(), form.model.trim() ? { model: form.model.trim() } : {});
            showToast(`${a.name} is connected. Mention ${a.mention} or pick it in the AI panel.`, 'success');
            setOpen(null);
            onChanged?.();
        } catch (err) {
            setError(aiErrorMessage(err, `Could not connect ${a.name}`));
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async (a) => {
        setBusy(a.id);
        try {
            await aiService.disconnectProvider(workspaceId, a.id);
            showToast(`${a.name} is disconnected`, 'success');
            onChanged?.();
        } catch (err) {
            showToast(aiErrorMessage(err, `Could not disconnect ${a.name}`), 'error');
        } finally {
            setBusy(null);
        }
    };

    return (
        <Section
            title="Assistants"
            description="Connect outside models with your own API key. Oruinwan AI stays the default; these answer only when someone picks or mentions them."
        >
            <Notice tone="warning">
                When someone asks Claude, ChatGPT, Gemini or Grok, their question and the conversation it's about are sent to that company. Oruinwan AI keeps everything on Oruinwan's servers.
            </Notice>
            {ASSISTANT_CATALOG.map((a) => {
                const on = isConnected(a.id);
                return (
                    <div key={a.id} data-testid={`assistant-${a.id}`}>
                        <Row
                            label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <img src={`/icons/ai/${a.id}.svg`} alt="" width={20} height={20} style={{ borderRadius: 5 }} />
                                {a.name} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {a.maker}</span>
                            </span>}
                            description={on ? <>Mention <span className="stg-mono">{a.mention}</span> in a conversation, or pick {a.name} in the AI panel.</> : 'Not connected'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {on && <Badge tone="success">Connected</Badge>}
                                {on ? (
                                    <Button variant="ghost" icon={Unplug} loading={busy === a.id} onClick={() => disconnect(a)}>Disconnect</Button>
                                ) : open !== a.id ? (
                                    <Button icon={Plug} onClick={() => startConnect(a.id)}>Connect</Button>
                                ) : null}
                            </div>
                        </Row>
                        {open === a.id && !on && (
                            <div className="stg-ws-details-body" style={{ marginBottom: 12 }}>
                                <div className="stg-grid-2">
                                    <Field label={`${a.name} API key`} id={`ai-key-${a.id}`} error={error}
                                        hint={<>Stored encrypted, never shown again. <a href={a.keysUrl} target="_blank" rel="noreferrer noopener">Get a key <ExternalLink size={11} style={{ display: 'inline' }} /></a></>}>
                                        <Input id={`ai-key-${a.id}`} type="password" autoComplete="new-password" placeholder={a.keyHint}
                                            value={form.apiKey} invalid={!!error} onChange={(e) => { setForm((f) => ({ ...f, apiKey: e.target.value })); setError(null); }} />
                                    </Field>
                                    <Field label="Model (optional)" id={`ai-model-${a.id}`} hint={`Empty: ${a.modelHint}`}>
                                        <Input id={`ai-model-${a.id}`} className="stg-mono" maxLength={80} placeholder={a.modelHint}
                                            value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
                                    </Field>
                                </div>
                                <div className="stg-ws-actions">
                                    <Button variant="primary" icon={KeyRound} loading={busy === a.id} onClick={() => connect(a)}>Connect {a.name}</Button>
                                    <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </Section>
    );
}
