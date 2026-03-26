// client/src/components/messagesComp/PinnedMessagesPanel.jsx
// Phase-8: Side drawer showing pinned messages for the current channel/DM
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

export default function PinnedMessagesPanel({ channelId, dmSessionId, currentUserId, onClose, onUnpin }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const fetchPinned = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = channelId
        ? `${API}/api/v2/messages/channel/${channelId}?pinned=true`
        : `${API}/api/v2/messages/dm/${dmSessionId}?pinned=true`;

      // Fallback: fetch all messages and filter pinned client-side
      // since the backend filter is a query param convenience
      const res = await axios.get(
        channelId
          ? `${API}/api/v2/messages/channel/${channelId}`
          : `${API}/api/v2/messages/workspace/x/dm/${dmSessionId}`,
        { withCredentials: true, params: { limit: 200 } }
      );
      const all = res.data?.messages || [];
      setMessages(all.filter(m => m.isPinned && !m.isDeletedUniversally));
    } catch (err) {
      setError('Failed to load pinned messages.');
    } finally {
      setLoading(false);
    }
  }, [channelId, dmSessionId]);

  useEffect(() => { fetchPinned(); }, [fetchPinned]);

  const handleUnpin = async (messageId) => {
    try {
      await axios.post(`${API}/api/v2/messages/${messageId}/pin`, { pin: false }, { withCredentials: true });
      setMessages(prev => prev.filter(m => m._id !== messageId));
      onUnpin?.(messageId);
    } catch { /* safe to ignore */ }
  };

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, width: 340,
        background: 'var(--bg-secondary, #1e2124)',
        borderLeft: '1px solid var(--border, #2d3035)',
        display: 'flex', flexDirection: 'column',
        zIndex: 900, boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--border, #2d3035)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📌</span>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
            Pinned Messages
          </h2>
          {!loading && (
            <span style={{
              background: '#5865f2', color: '#fff', borderRadius: 10,
              fontSize: 11, padding: '1px 7px', fontWeight: 600,
            }}>{messages.length}</span>
          )}
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#a0a5b0',
          cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4, borderRadius: 4,
        }}>✕</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {loading && (
          <div style={{ textAlign: 'center', color: '#a0a5b0', padding: 32 }}>
            Loading pinned messages…
          </div>
        )}
        {error && (
          <div style={{ color: '#ed4245', padding: '12px 20px', fontSize: 13 }}>{error}</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a0a5b0', padding: 40 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📌</div>
            <p style={{ margin: 0, fontSize: 14 }}>No pinned messages yet</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
              Hover a message and click Pin to save it here
            </p>
          </div>
        )}
        {messages.map(msg => (
          <PinnedMessageCard
            key={msg._id}
            msg={msg}
            currentUserId={currentUserId}
            onUnpin={handleUnpin}
          />
        ))}
      </div>
    </div>
  );
}

function PinnedMessageCard({ msg, currentUserId, onUnpin }) {
  const sender = msg.sender?.username || 'Unknown';
  const text = msg.text || msg.decryptedContent || (msg.payload?.isEncrypted ? '🔒 Encrypted message' : '');
  const time = new Date(msg.pinnedAt || msg.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const isSender = String(msg.sender?._id || msg.sender) === String(currentUserId);

  return (
    <div style={{
      margin: '4px 12px', borderRadius: 8, padding: '12px 14px',
      background: 'var(--bg-tertiary, #2b2d31)',
      border: '1px solid var(--border, #3a3d42)',
      transition: 'background 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, #35363a)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary, #2b2d31)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: '#5865f2', fontSize: 13, fontWeight: 600 }}>{sender}</span>
        <span style={{ color: '#6b7280', fontSize: 11 }}>{time}</span>
      </div>
      <p style={{ margin: 0, color: '#d1d5db', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>
        {msg.type === 'image' ? '📷 Photo' :
          msg.type === 'voice' ? '🎵 Voice note' :
            msg.type === 'file' ? '📎 File' :
              msg.type === 'poll' ? '📊 Poll' : text || '…'}
      </p>
      {isSender && (
        <button
          onClick={() => onUnpin(msg._id)}
          style={{
            marginTop: 8, background: 'none', border: '1px solid #ed4245',
            color: '#ed4245', borderRadius: 4, padding: '3px 10px', fontSize: 11,
            cursor: 'pointer', fontWeight: 600,
          }}>
          Unpin
        </button>
      )}
    </div>
  );
}
