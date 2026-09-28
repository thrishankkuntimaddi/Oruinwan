import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { useDateFormatter } from '../../hooks/useUserPreferences';
import IntegrationCard from './IntegrationCard';
import { PROVIDER_AVATAR } from './ui';

/** The integration object on a message, wherever the event shape put it. */
export function integrationOf(event) {
    return event?.integration || event?.payload?.integration || event?.backend?.integration || null;
}

const isoOf = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? undefined : t.toISOString(); };
const idOf = (v) => (v && typeof v === 'object' ? String(v._id || v.id || '') : v ? String(v) : '');

/**
 * A message posted by the GitHub / Jira bot: bot header, the card, and the
 * thread link (reviews, merges and check results arrive as thread replies).
 * The card is updated in place when the server edits the message.
 */
export default function IntegrationEvent({ event, onThreadOpen, threadCounts = {}, workspaceId }) {
    const { socket } = useSocket() || {};
    const formatTime = useDateFormatter().time;
    const id = String(event._id || event.id);
    const [live, setLive] = useState(null);

    // Card updates (state, checks, review) come as message edits carrying the new object.
    useEffect(() => {
        if (!socket) return undefined;
        const onEdited = (data) => {
            if (String(data?._id || data?.id || data?.messageId) !== id) return;
            const next = data.integration || data.message?.integration;
            if (next) setLive(next);
        };
        socket.on('message:edited', onEdited);
        socket.on('message:updated', onEdited);
        return () => { socket.off('message:edited', onEdited); socket.off('message:updated', onEdited); };
    }, [socket, id]);

    const integration = live || integrationOf(event) || {};
    const provider = integration.provider || 'github';
    const sender = event.sender || event.payload?.sender || {};
    const name = sender.username || sender.name || { github: 'GitHub', gitlab: 'GitLab', jira: 'Jira' }[provider] || 'Integration';
    const summary = event.decryptedContent || event.payload?.text || event.text || '';
    const createdAt = event.createdAt || event.payload?.createdAt;
    const channelId = idOf(event.payload?.channel || event.channelId || event.backend?.channel);
    const wsId = workspaceId || idOf(event.payload?.workspace || event.backend?.workspace) || null;
    const count = threadCounts[id] || event.replyCount || event.payload?.replyCount || 0;
    const lastReplyAt = event.lastReplyAt || event.payload?.lastReplyAt;

    // What the thread panel needs to show this post as the thread's root.
    const openThread = onThreadOpen ? () => onThreadOpen({
        _id: id, id, type: 'integration', integration,
        text: summary, decryptedContent: summary,
        sender, senderName: name, senderAvatar: PROVIDER_AVATAR[provider],
        createdAt, ts: createdAt, channelId, replyCount: count,
        payload: event.payload,
    }) : undefined;

    return (
        <div className="oi-event" id={`msg-${id}`} data-testid="integration-message">
            <img className="oi-event-avatar" src={sender.profilePicture || PROVIDER_AVATAR[provider] || PROVIDER_AVATAR.github} alt="" />
            <div className="oi-event-main">
                <div className="oi-event-head">
                    <span className="oi-event-name">{name}</span>
                    <span className="oi-event-app" title="Integration">APP</span>
                    {createdAt && <time className="oi-event-time" dateTime={isoOf(createdAt)}>{formatTime(createdAt)}</time>}
                </div>
                <IntegrationCard
                    integration={integration}
                    summary={summary}
                    messageId={id}
                    channelId={channelId}
                    workspaceId={wsId}
                    onOpenThread={openThread}
                />
                {count > 0 && openThread && (
                    <button type="button" className="oi-event-replies" onClick={openThread}>
                        <MessageSquare size={12} aria-hidden="true" />
                        {count} {count === 1 ? 'reply' : 'replies'}
                        {lastReplyAt && <span className="oi-muted">Last reply {formatTime(lastReplyAt)}</span>}
                    </button>
                )}
            </div>
            {openThread && (
                <div className="oi-event-tools">
                    <button type="button" className="gl-icon-btn" onClick={openThread} aria-label="Reply in thread" title="Reply in thread">
                        <MessageSquare size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
