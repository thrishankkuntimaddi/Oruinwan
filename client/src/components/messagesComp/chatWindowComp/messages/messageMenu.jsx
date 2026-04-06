// src/components/messageComp/chatWindow/messages/messageMenu.jsx
// Monolith Flow Design System

import React, { useState } from "react";
import {
  Pin, Reply, Forward, Copy, Bookmark, Bell, Clock,
  Trash2, Info, Zap, Layers, FolderOpen
} from "lucide-react";
import IntegrationActionModal from "../../../../components/apps/modals/IntegrationActionModal";
import api from '@services/api';

const EMOJI_SHORTCUTS = ["👍", "❤️", "😂", "😊", "🔥", "🙏"];

function MenuItem({ icon, label, onClick, disabled, danger, accent }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left', padding: '6px 12px',
        display: 'flex', alignItems: 'center', gap: '10px',
        backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent',
        color: danger ? 'var(--state-danger)' : accent ? 'var(--accent)' : (hovered ? 'var(--text-primary)' : 'var(--text-secondary)'),
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '13px', fontWeight: 400,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        transition: 'background-color 150ms ease, color 150ms ease',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export default function MessageMenu({
  msg,
  addReaction,
  pinMessage,
  replyToMessage,
  forwardMessage,
  copyMessage,
  deleteMessage,
  infoMessage,
  onBookmark,
  onRemind,
  onShowHistory,
  isBookmarked = false,
}) {
  const [integrationModal, setIntegrationModal] = useState(null);
  const [bookmarkPending, setBookmarkPending] = useState(false);

  const openIntegration = (config) => setIntegrationModal(config);

  const handleBookmark = async () => {
    if (bookmarkPending) return;
    setBookmarkPending(true);
    try {
      await api.post(`/api/messages/${msg.id}/bookmark`);
      onBookmark?.(msg.id);
    } catch { /* silent */ } finally {
      setBookmarkPending(false);
    }
  };

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: '200px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-accent)',
          borderRadius: '2px',
          zIndex: 40,
          padding: '4px 0',
          overflow: 'hidden',
          animation: 'fadeIn 220ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Emoji Reactions */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          padding: '6px 8px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {EMOJI_SHORTCUTS.map((r) => (
            <button
              key={r}
              onClick={() => addReaction(msg.id, r)}
              style={{
                padding: '4px', fontSize: '16px', lineHeight: 1,
                borderRadius: '2px', background: 'none', border: 'none',
                cursor: 'pointer', transition: 'background-color 150ms ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Actions */}
        <MenuItem icon={<Pin size={13} />} label="Pin" onClick={() => pinMessage(msg.id)} />
        <MenuItem icon={<Reply size={13} />} label="Reply" onClick={() => replyToMessage(msg.id)} />
        <MenuItem icon={<Forward size={13} />} label="Forward" onClick={() => forwardMessage(msg.id)} />
        <MenuItem icon={<Copy size={13} />} label="Copy" onClick={() => copyMessage(msg.id)} />

        <MenuItem
          icon={<Bookmark size={13} />}
          label={isBookmarked ? "Remove Bookmark" : "Save / Bookmark"}
          onClick={handleBookmark}
          disabled={bookmarkPending}
          accent={isBookmarked}
        />

        {onRemind && (
          <MenuItem icon={<Bell size={13} />} label="Remind Me" onClick={() => onRemind(msg.id)} />
        )}

        {onShowHistory && msg?.editHistory?.length > 0 && (
          <MenuItem icon={<Clock size={13} />} label="Edit History" onClick={() => onShowHistory(msg)} />
        )}

        <MenuItem icon={<Trash2 size={13} />} label="Delete" onClick={() => deleteMessage(msg.id)} danger />
        <MenuItem icon={<Info size={13} />} label="Info" onClick={() => infoMessage(msg.id)} />

        {/* Integrations Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px', margin: '4px 0',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <span style={{
            fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.14em',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          }}>Integrations</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        </div>

        <MenuItem
          icon={<Zap size={13} />}
          label="Create Jira Issue"
          onClick={() => openIntegration({ title: "Create Jira Issue", integration: "Jira", emoji: "🎫", description: "Create a Jira issue based on this message. The message content will be used as the issue summary.", confirmLabel: "Create Issue" })}
        />
        <MenuItem
          icon={<Layers size={13} />}
          label="Add to Linear"
          onClick={() => openIntegration({ title: "Add to Linear", integration: "Linear", emoji: "⚡", description: "Add this message as a new issue in your Linear workspace.", confirmLabel: "Add to Linear" })}
        />
        <MenuItem
          icon={<FolderOpen size={13} />}
          label="Share to Google Drive"
          onClick={() => openIntegration({ title: "Share to Google Drive", integration: "Google Drive", emoji: "📁", description: "Save this message as a document in your Google Drive for future reference.", confirmLabel: "Save to Drive" })}
        />
      </div>

      {integrationModal && (
        <IntegrationActionModal
          {...integrationModal}
          onClose={() => setIntegrationModal(null)}
        />
      )}
    </>
  );
}
