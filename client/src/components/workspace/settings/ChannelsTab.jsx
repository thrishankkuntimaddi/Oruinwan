import React, { useState } from 'react';
import { Hash, Lock, Star } from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../../contexts/ToastContext';
import { Panel, Chip, EmptyState, LoadingState, ErrorState, useAsync, errorMessage } from '../../ui/page';
import SettingSwitch from '../../ui/SettingSwitch';

/** Default channels first, then by name; private channels can't be defaults. */
export function sortChannels(channels = []) {
    return [...channels].sort((a, b) => (Number(!!b.isDefault) - Number(!!a.isDefault)) || String(a.name).localeCompare(String(b.name)));
}

/** Whether turning this channel's default off would leave the workspace with none. */
export function isLastDefault(channels, channel) {
    return !!channel?.isDefault && channels.filter((c) => c.isDefault).length <= 1;
}

/**
 * Workspace admin → Channels: pick the default channels (everyone who joins is added to them and
 * they can't be left). Who may post in a channel is set in that channel's own settings.
 */
export default function ChannelsTab({ workspaceId, isAdmin }) {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(null);
    const { data, loading, error, reload, setData } = useAsync(
        () => api.get(`/api/workspaces/${workspaceId}/channels`).then((r) => r.data?.channels || []),
        [workspaceId],
        { enabled: !!workspaceId },
    );
    const channels = sortChannels(data || []);

    const toggle = async (channel, next) => {
        setSaving(channel._id);
        try {
            const { data: res } = await api.put(`/api/workspaces/${workspaceId}/channels/${channel._id}/default`, { isDefault: next });
            setData((list) => (list || []).map((c) => (c._id === channel._id ? { ...c, isDefault: next } : c)));
            showToast(next
                ? `#${channel.name} is a default channel${res?.added ? ` · ${res.added} ${res.added === 1 ? 'person' : 'people'} added` : ''}`
                : `#${channel.name} is no longer a default channel`, 'success');
        } catch (err) {
            showToast(errorMessage(err, 'Could not change the channel'), 'error');
        } finally {
            setSaving(null);
        }
    };

    if (loading && !data) return <LoadingState label="Loading channels…" />;
    if (error && !data) return <ErrorState message={error} onRetry={reload} />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                New members are added to default channels when they join and can’t leave them. Turning one on adds everyone who is already here.
                Who can post in a channel is set in that channel’s settings.
            </p>
            {channels.length === 0 ? (
                <Panel><EmptyState icon={Hash} title="No channels yet" text="Channels you create appear here." /></Panel>
            ) : (
                <Panel flush>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="admin-channels">
                        {channels.map((c, i) => {
                            const Icon = c.isPrivate ? Lock : Hash;
                            const last = isLastDefault(channels, c);
                            const disabled = !isAdmin || c.isPrivate || saving === c._id || last;
                            return (
                                <li key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                                    <Icon size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                            {c.isDefault && <Chip tone="accent"><Star size={10} /> Default</Chip>}
                                            {c.isPrivate && <Chip>Private</Chip>}
                                        </div>
                                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                            {(c.members || []).length} {(c.members || []).length === 1 ? 'member' : 'members'}
                                            {c.isPrivate ? ' · private channels can’t be defaults' : last ? ' · the only default channel' : ''}
                                        </div>
                                    </div>
                                    <SettingSwitch checked={!!c.isDefault} disabled={disabled} onChange={(v) => toggle(c, v)} label={`Default channel: ${c.name}`} />
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
            )}
        </div>
    );
}
