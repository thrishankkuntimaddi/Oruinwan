import React, { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { Pin, X } from 'lucide-react';

const FONT = 'Inter, system-ui, -apple-system, sans-serif';

export default function PinnedMessagesPanel({ channelId, dmSessionId, currentUserId, onClose, onUnpin }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const fetchPinned = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      
      
      const res = await api.get(
        channelId
          ? `/api/v2/messages/channel/${channelId}`
          : `/api/v2/messages/workspace/x/dm/${dmSessionId}`,
        { params: { limit: 200 } }
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
      await api.post(`/api/v2/messages/${messageId}/pin`, { pin: false });
      setMessages(prev => prev.filter(m => m._id !== messageId));
      onUnpin?.(messageId);
    } catch {  }
  };

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 320,
      backgroundColor: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border-accent)',
      display: 'flex', flexDirection: 'column',
      zIndex: 900, boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      fontFamily: FONT,
    }}>
      {}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-default)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Pin size={16} style={{ color: 'var(--accent)' }} />
          <h2 style={{
            margin: 0, fontSize: '14px', fontWeight: 600,
            color: 'var(--text-primary)', fontFamily: FONT,
          }}>
            Pinned Messages
          </h2>
          {!loading && (
            <span style={{
              backgroundColor: 'rgba(184,149,106,0.15)',
              border: '1px solid rgba(184,149,106,0.2)',
              color: 'var(--accent)',
              borderRadius: '99px',
              fontSize: '10px', fontWeight: 700,
              padding: '1px 7px', fontFamily: FONT,
            }}>
              {messages.length}
            </span>
          )}
        </div>
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{
            textAlign: 'center', color: 'var(--text-muted)',
            padding: '32px 16px', fontSize: '13px', fontFamily: FONT,
          }}>
            Loading pinned messages…
          </div>
        )}
        {error && (
          <div style={{
            color: 'var(--state-danger)', padding: '12px 20px',
            fontSize: '13px', fontFamily: FONT,
          }}>
            {error}
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '48px 16px', gap: '10px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '2px',
              backgroundColor: 'var(--bg-active)',
              border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Pin size={20} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: FONT }}>
              No pinned messages yet
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontFamily: FONT, textAlign: 'center' }}>
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
  const [hovered, setHovered] = React.useState(false);
  const sender = msg.sender?.username || 'Unknown';
  const text = msg.text || msg.decryptedContent || (msg.payload?.isEncrypted ? '🔒 Encrypted message' : '');
  const time = new Date(msg.pinnedAt || msg.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric' });
  const isSender = String(msg.sender?._id || msg.sender) === String(currentUserId);

  return (
    <div
      style={{
        margin: '4px 12px', borderRadius: '2px', padding: '10px 12px',
        backgroundColor: hovered ? 'var(--bg-hover)' : 'var(--bg-active)',
        border: `1px solid ${hovered ? 'var(--border-accent)' : 'var(--border-default)'}`,
        transition: '150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{
          color: 'var(--accent)', fontSize: '12px', fontWeight: 600, fontFamily: FONT,
        }}>
          {sender}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: FONT }}>
          {time}
        </span>
      </div>
      <p style={{
        margin: 0, color: 'var(--text-secondary)', fontSize: '13px',
        lineHeight: 1.55, wordBreak: 'break-word', fontFamily: FONT,
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
      }}>
        {msg.type === 'image' ? '📷 Photo' :
          msg.type === 'voice' ? '🎵 Voice note' :
            msg.type === 'file' ? '📎 File' :
              msg.type === 'poll' ? '📊 Poll' : text || '…'}
      </p>
      {isSender && (
        <button
          onClick={() => onUnpin(msg._id)}
          style={{
            marginTop: '8px', background: 'none',
            border: '1px solid var(--border-default)',
            color: 'var(--state-danger)', borderRadius: '2px',
            padding: '3px 10px', fontSize: '11px',
            cursor: 'pointer', fontWeight: 600,
            fontFamily: FONT, transition: '150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--state-danger)'; e.currentTarget.style.backgroundColor = 'rgba(224,82,82,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Unpin
        </button>
      )}
    </div>
  );
}
