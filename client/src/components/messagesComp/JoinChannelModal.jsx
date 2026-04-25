import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/apiHelpers";
import { useChannels } from "../../hooks/useChannels";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import api from '@services/api';
import { Hash, Loader2, X } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function JoinChannelModal({ onClose, onJoined, currentUserId }) {
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const workspaceId = activeWorkspace?.id || activeWorkspace?._id;
    const { joinDiscoverableChannel } = useChannels(workspaceId);

    const [publicChannels, setPublicChannels] = useState([]);
    const [loadingList, setLoadingList] = useState(false);
    const [joiningId, setJoiningId] = useState(null); 

    const loadPublicChannels = useCallback(async () => {
        if (!workspaceId) return;
        try {
            setLoadingList(true);
            const res = await api.get(`/api/workspaces/${workspaceId}/channels`);
            const allChannels = res.data.channels || [];

            
            const notJoined = allChannels.filter(ch =>
                !ch.isPrivate &&
                ch.isDiscoverable !== false &&
                !ch.members.some(m => String(m) === String(currentUserId)) &&
                !ch.members.some(m => String(m._id) === String(currentUserId))
            );

            setPublicChannels(notJoined);
        } catch (err) {
            console.error("Load public channels failed:", err);
        } finally {
            setLoadingList(false);
        }
    }, [workspaceId, currentUserId]);

    useEffect(() => {
        loadPublicChannels();
    }, [loadPublicChannels]);

    const handleJoin = async (channelId) => {
        setJoiningId(channelId);
        try {
            
            const joined = await joinDiscoverableChannel(channelId);

            showToast(`Joined #${joined.label} successfully!`);
            onJoined?.(joined);
            onClose();

            
            navigate(joined.path || `/channels/${channelId}`);
        } catch (err) {
            console.error("Join failed:", err);
            showToast(getErrorMessage(err), "error");
        } finally {
            setJoiningId(null);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, fontFamily: FONT,
        }}>
            <div style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '2px',
                width: '100%', maxWidth: '440px',
                maxHeight: '80vh', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}>
                {}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 20px', borderBottom: '1px solid var(--border-default)',
                    flexShrink: 0,
                }}>
                    <h3 style={{
                        margin: 0, fontSize: '14px', fontWeight: 600,
                        color: 'var(--text-primary)', fontFamily: FONT,
                    }}>
                        Join Public Channel
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '2px',
                            transition: '100ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        <X size={16} />
                    </button>
                </div>

                {}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    {loadingList ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: '8px', padding: '32px 16px',
                            fontSize: '13px', color: 'var(--text-muted)', fontFamily: FONT,
                        }}>
                            <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }} />
                            Loading channels...
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {publicChannels.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', color: 'var(--text-muted)',
                                    padding: '32px 16px', fontSize: '13px', fontFamily: FONT,
                                }}>
                                    No public channels available to join
                                </div>
                            ) : (
                                publicChannels.map((channel) => (
                                    <div
                                        key={channel._id}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 12px', borderRadius: '2px',
                                            backgroundColor: 'var(--bg-active)',
                                            border: '1px solid var(--border-default)',
                                            transition: '150ms ease',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-active)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                margin: 0, fontWeight: 500, fontSize: '13px',
                                                color: 'var(--text-primary)', fontFamily: FONT,
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                            }}>
                                                <Hash size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                {channel.name}
                                            </p>
                                            {channel.description && (
                                                <p style={{
                                                    margin: '2px 0 0 16px', fontSize: '12px',
                                                    color: 'var(--text-muted)', fontFamily: FONT,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {channel.description}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleJoin(channel._id)}
                                            disabled={joiningId !== null}
                                            style={{
                                                marginLeft: '12px', flexShrink: 0,
                                                padding: '5px 14px',
                                                backgroundColor: joiningId === channel._id ? 'var(--bg-active)' : 'var(--accent)',
                                                color: joiningId === channel._id ? 'var(--text-muted)' : '#0c0c0c',
                                                border: 'none', borderRadius: '2px', outline: 'none',
                                                fontSize: '12px', fontWeight: 600, cursor: joiningId !== null ? 'not-allowed' : 'pointer',
                                                fontFamily: FONT, transition: '150ms ease',
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                opacity: joiningId !== null && joiningId !== channel._id ? 0.5 : 1,
                                            }}
                                            onMouseEnter={e => { if (!joiningId) e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
                                            onMouseLeave={e => { if (!joiningId) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
                                        >
                                            {joiningId === channel._id
                                                ? <><Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> Joining…</>
                                                : 'Join'
                                            }
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {}
                <div style={{
                    padding: '12px 20px', borderTop: '1px solid var(--border-default)',
                    display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '7px 16px', fontSize: '13px', fontWeight: 500,
                            color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)',
                            border: '1px solid var(--border-default)', borderRadius: '2px',
                            outline: 'none', cursor: 'pointer', fontFamily: FONT, transition: '150ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--bg-active)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
