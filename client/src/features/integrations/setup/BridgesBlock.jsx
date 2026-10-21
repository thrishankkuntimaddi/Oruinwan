import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { Button, ConfirmDialog, IconButton, Input, Notice, Select } from '../../../pages/settingsTabs/settingsUi';
import { ChannelSelect, sameJson } from './setupKit';
import { runConnectorAction } from './connectorsApi';

/**
 * Slack / Teams bridges: rows of { remote, channelId, direction }.
 * Turning on the outgoing direction asks for confirmation (the copies leave
 * end-to-end encryption) and sends acknowledgeOutgoing: true for that row.
 */

const isOut = (dir) => dir === 'out' || dir === 'both';
const plain = (list) => (list || []).map((b) => ({ remote: String(b.remote || ''), channelId: String(b.channelId || ''), direction: b.direction || 'in' }));

export default function BridgesBlock({ c, cfg, channels, workspaceId }) {
    const { showToast } = useToast();
    const savedRaw = cfg.data?.config?.bridges;
    const saved = useMemo(() => plain(savedRaw), [savedRaw]);
    const [rows, setRows] = useState(saved);
    const [pending, setPending] = useState(null); // { index, direction, thenSave }
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const remoteLabel = c.bridge?.remoteLabel || 'Remote channel';
    const provider = c.label;
    const hasBotToken = !!cfg.data?.config?.hasBotToken;

    useEffect(() => { setRows(saved); setError(null); }, [saved]);

    // Slack: offer the channels the bot can see (admin action, needs a bot token).
    useEffect(() => {
        if (c.type !== 'slack' || !hasBotToken) return undefined;
        let alive = true;
        runConnectorAction('slack', 'channels', workspaceId)
            .then((d) => { if (alive) setSuggestions(Array.isArray(d?.channels) ? d.channels : []); })
            .catch(() => { /* suggestions are optional */ });
        return () => { alive = false; };
    }, [c.type, hasBotToken, workspaceId]);

    const wasOut = (r) => saved.some((s) => s.remote === (r.remote.trim() || '*') && s.channelId === String(r.channelId) && isOut(s.direction));
    const needsAck = (r) => isOut(r.direction) && !r.acknowledgeOutgoing && !wasOut(r);
    const dirty = !sameJson(plain(rows), saved);
    const anyOut = rows.some((r) => isOut(r.direction)) || saved.some((s) => isOut(s.direction));

    const update = (i, patch) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const changeTarget = (i, patch) => {
        // A different remote/channel is a new decision: ask again before copying out.
        update(i, { ...patch, acknowledgeOutgoing: false });
        setError(null);
    };
    const changeDirection = (i, direction) => {
        const r = rows[i];
        setError(null);
        if (!isOut(direction) || r.acknowledgeOutgoing || wasOut(r)) { update(i, { direction }); return; }
        setPending({ index: i, direction, thenSave: false });
    };

    const persist = async (list) => {
        const problem = list.some((r) => !r.channelId) ? 'Every bridge needs an Oruinwan channel.'
            : c.bridge?.remoteRequired && list.some((r) => !r.remote.trim()) ? `Every bridge needs a ${remoteLabel}.` : null;
        if (problem) { setError(problem); return; }
        const firstUnacked = list.findIndex(needsAck);
        if (firstUnacked >= 0) { setPending({ index: firstUnacked, direction: list[firstUnacked].direction, thenSave: true }); return; }
        setSaving(true); setError(null);
        try {
            await cfg.save({
                bridges: list.map((r) => ({
                    remote: r.remote.trim() || '*',
                    channelId: r.channelId,
                    direction: r.direction,
                    ...(isOut(r.direction) && r.acknowledgeOutgoing ? { acknowledgeOutgoing: true } : {}),
                })),
            });
            showToast('Bridges saved', 'success');
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const confirmOut = () => {
        if (!pending) return;
        const next = rows.map((r, j) => (j === pending.index ? { ...r, direction: pending.direction, acknowledgeOutgoing: true } : r));
        setRows(next);
        const { thenSave } = pending;
        setPending(null);
        if (thenSave) persist(next);
    };

    const pendingRow = pending ? rows[pending.index] : null;
    const pendingChannel = pendingRow ? channels.find((ch) => ch.id === String(pendingRow.channelId)) : null;
    const channelName = pendingChannel ? `#${pendingChannel.name}` : 'this channel';
    const listId = `bridge-${c.type}-remotes`;

    return (
        <div className="oi-setup-block" data-testid={`bridges-${c.type}`}>
            <h3 className="oi-setup-h">Bridged channels</h3>
            {anyOut && (
                <Notice tone="warning">
                    Some channels are copied to {provider}. Those copies leave Oruinwan’s end-to-end encryption and are stored by {provider}. People in those channels see a notice.
                </Notice>
            )}
            {suggestions.length > 0 && (
                <datalist id={listId}>
                    {suggestions.map((s) => <option key={s.id} value={s.id}>{`${s.isPrivate ? '🔒 ' : '#'}${s.name}${s.isMember === false ? ' (app not in channel)' : ''}`}</option>)}
                </datalist>
            )}
            <div className="oi-routes">
                {rows.length === 0 && <p className="stg-hint">No bridges yet. Add one to connect a {provider} channel with an Oruinwan channel.</p>}
                {rows.map((r, i) => (
                    <fieldset key={i} className="oi-route">
                        <legend className="stg-ws-sr-only">Bridge {i + 1}</legend>
                        <div className="oi-route-row oi-bridge-row">
                            <div className="oi-route-key">
                                <label className="stg-label" htmlFor={`${listId}-r-${i}`}>{remoteLabel}</label>
                                <Input id={`${listId}-r-${i}`} value={r.remote} placeholder={c.bridge?.remotePlaceholder} autoComplete="off" spellCheck={false}
                                    list={suggestions.length ? listId : undefined}
                                    onChange={(e) => changeTarget(i, { remote: e.target.value.trim() })} />
                            </div>
                            <div className="oi-route-channel">
                                <label className="stg-label" htmlFor={`${listId}-c-${i}`}>Oruinwan channel</label>
                                <ChannelSelect id={`${listId}-c-${i}`} channels={channels} value={r.channelId} onChange={(v) => changeTarget(i, { channelId: v })} />
                            </div>
                            <div className="oi-bridge-dir">
                                <label className="stg-label" htmlFor={`${listId}-d-${i}`}>Direction</label>
                                <Select id={`${listId}-d-${i}`} value={r.direction} onChange={(e) => changeDirection(i, e.target.value)}>
                                    <option value="in">In → Oruinwan</option>
                                    <option value="out">Out → {provider}</option>
                                    <option value="both">Both ways</option>
                                </Select>
                            </div>
                            <IconButton label={`Remove bridge ${i + 1}`} tone="danger" onClick={() => { setRows((list) => list.filter((_, j) => j !== i)); setError(null); }}>
                                <Trash2 size={14} />
                            </IconButton>
                        </div>
                    </fieldset>
                ))}
                <button type="button" className="stg-btn" data-size="sm" onClick={() => setRows((list) => [...list, { remote: '', channelId: '', direction: 'in' }])}>
                    <Plus size={13} /> Add bridge
                </button>
            </div>
            {error && <div className="stg-error-text" role="alert">{error}</div>}
            {dirty && (
                <div className="stg-ws-actions oi-setup-save">
                    <Button variant="primary" size="sm" loading={saving} onClick={() => persist(rows)}>Save bridges</Button>
                    <Button variant="ghost" size="sm" disabled={saving} onClick={() => { setRows(saved); setError(null); }}>Discard</Button>
                </div>
            )}
            <ConfirmDialog
                open={!!pending}
                title={`Copy messages to ${provider}?`}
                tone="danger"
                confirmLabel={`Copy to ${provider}`}
                onConfirm={confirmOut}
                onCancel={() => setPending(null)}
            >
                Messages posted in {channelName} will be copied to {provider}. Copies leave Oruinwan’s end-to-end encryption and are stored by {provider}. Only messages sent from Oruinwan apps after this is turned on are copied, by the sender’s app.
            </ConfirmDialog>
        </div>
    );
}
