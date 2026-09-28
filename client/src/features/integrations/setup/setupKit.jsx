import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../contexts/ToastContext';
import { IconButton, Input, Select } from '../../../pages/settingsTabs/settingsUi';
import { getIntegrationConfig, saveIntegrationConfig, clearConnectionCache } from '../integrationsApi';

/** Load/save one provider's config. `data` is the GET response. */
export function useIntegrationConfig(type, workspaceId) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true); setError(null);
        try {
            setData(await getIntegrationConfig(type, workspaceId));
        } catch (err) {
            if (err.code === 'not_connected' || err.code === 'not_found') setData({ connected: false, config: {} });
            else setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [type, workspaceId]);

    useEffect(() => { reload(); }, [reload]);

    /** PUT a partial config; keeps a one-time webhookSecret from the response. */
    const save = useCallback(async (partial) => {
        const res = await saveIntegrationConfig(type, workspaceId, partial);
        clearConnectionCache();
        if (res && (res.config || 'connected' in res)) {
            setData((d) => ({ ...(d || {}), ...res, config: { ...(d?.config || {}), ...(res.config || {}) } }));
        } else {
            await reload();
        }
        return res;
    }, [type, workspaceId, reload]);

    return { data, setData, loading, error, reload, save };
}

export async function copyToClipboard(text, showToast, what = 'Copied') {
    try {
        await navigator.clipboard.writeText(text);
        showToast(what, 'success');
    } catch {
        showToast('Could not copy. Select the text and copy it manually.', 'error');
    }
}

/** A read-only value with a Copy button (and optional reveal for secrets). */
export function CopyField({ label, value, secret = false, id }) {
    const { showToast } = useToast();
    const [shown, setShown] = useState(!secret);
    if (!value) return null;
    return (
        <div className="stg-field">
            <span className="stg-label" id={id ? `${id}-label` : undefined}>{label}</span>
            <div className="stg-ws-secret oi-copyfield">
                <code className="stg-mono" aria-labelledby={id ? `${id}-label` : undefined}>{shown ? value : '•'.repeat(Math.min(32, value.length))}</code>
                {secret && (
                    <IconButton label={shown ? 'Hide' : 'Show'} onClick={() => setShown((s) => !s)}>
                        {shown ? <EyeOff size={13} /> : <Eye size={13} />}
                    </IconButton>
                )}
                <IconButton label={`Copy ${label.toLowerCase()}`} onClick={() => copyToClipboard(value, showToast, `${label} copied`)}>
                    <Copy size={13} />
                </IconButton>
            </div>
        </div>
    );
}

/** The workspace's channels the viewer belongs to, for route pickers. */
export function useWorkspaceChannels(workspaceId) {
    const [channels, setChannels] = useState([]);
    useEffect(() => {
        if (!workspaceId) return undefined;
        let alive = true;
        api.get('/api/channels/my', { params: { workspaceId, limit: 200 } })
            .then(({ data }) => { if (alive) setChannels((data?.channels || []).map((c) => ({ id: String(c._id || c.id), name: c.name, isPrivate: !!c.isPrivate }))); })
            .catch(() => { if (alive) setChannels([]); });
        return () => { alive = false; };
    }, [workspaceId]);
    return channels;
}

export function ChannelSelect({ channels, value, onChange, id, disabled, label = 'Channel' }) {
    const known = channels.some((c) => c.id === String(value));
    return (
        <Select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label}>
            <option value="">Choose a channel…</option>
            {!known && value && <option value={value}>Channel {String(value).slice(-6)}</option>}
            {channels.map((c) => <option key={c.id} value={c.id}>{c.isPrivate ? '🔒 ' : '#'}{c.name}</option>)}
        </Select>
    );
}

/**
 * Editable list of routes: key field (repo / project) → channel (+ event checkboxes).
 * routes: [{ [keyName], channelId, events? }]
 */
export function RouteEditor({
    routes, onChange, channels, keyName, keyLabel, keyPlaceholder, keyHint, validateKey, events = null, disabled, idPrefix,
}) {
    const update = (i, patch) => onChange(routes.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const remove = (i) => onChange(routes.filter((_, j) => j !== i));
    const add = () => onChange([...routes, { [keyName]: '', channelId: '', ...(events ? { events: events.map((e) => e.id) } : {}) }]);
    return (
        <div className="oi-routes">
            {routes.length === 0 && <p className="stg-hint">No routes yet. Add one to post events in a channel.</p>}
            {routes.map((r, i) => {
                const keyError = r[keyName] ? validateKey?.(r[keyName]) : null;
                return (
                    <fieldset key={i} className="oi-route" disabled={disabled}>
                        <legend className="stg-ws-sr-only">Route {i + 1}</legend>
                        <div className="oi-route-row">
                            <div className="oi-route-key">
                                <label className="stg-label" htmlFor={`${idPrefix}-key-${i}`}>{keyLabel}</label>
                                <Input
                                    id={`${idPrefix}-key-${i}`}
                                    value={r[keyName] || ''}
                                    placeholder={keyPlaceholder}
                                    invalid={!!keyError}
                                    autoComplete="off"
                                    spellCheck={false}
                                    onChange={(e) => update(i, { [keyName]: e.target.value.trim() })}
                                />
                            </div>
                            <span className="oi-route-arrow" aria-hidden="true">→</span>
                            <div className="oi-route-channel">
                                <label className="stg-label" htmlFor={`${idPrefix}-ch-${i}`}>Channel</label>
                                <ChannelSelect id={`${idPrefix}-ch-${i}`} channels={channels} value={r.channelId} onChange={(v) => update(i, { channelId: v })} disabled={disabled} />
                            </div>
                            {!disabled && (
                                <IconButton label={`Remove route ${i + 1}`} tone="danger" onClick={() => remove(i)}><Trash2 size={14} /></IconButton>
                            )}
                        </div>
                        {keyError ? <div className="stg-error-text" role="alert">{keyError}</div> : keyHint && i === 0 ? <div className="stg-hint">{keyHint}</div> : null}
                        {events && (
                            <div className="oi-route-events" role="group" aria-label="Events to post">
                                {events.map((ev) => {
                                    const on = (r.events || []).includes(ev.id);
                                    return (
                                        <label key={ev.id} className="oi-route-event">
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() => update(i, { events: on ? (r.events || []).filter((x) => x !== ev.id) : [...(r.events || []), ev.id] })}
                                            />
                                            {ev.label}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </fieldset>
                );
            })}
            {!disabled && (
                <button type="button" className="stg-btn" data-size="sm" onClick={add}><Plus size={13} /> Add route</button>
            )}
        </div>
    );
}

export const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
