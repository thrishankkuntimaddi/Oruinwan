import React from "react";
import { X, CheckCircle2, Clock, Lock, Smile, MessageSquare } from "lucide-react";

/**
 * MessageInfoModal
 * Props from backend /api/v2/messages/:id/info:
 *   msg      - { _id, text, payload, createdAt, sender, reactions, readBy: string[] }
 *   members  - [{ _id, username, profilePicture }]
 *   readBy   - string[]  (same as msg.readBy, duped for convenience)
 *   currentUserId - string
 *   onClose  - fn
 */
export default function MessageInfoModal({ msg, members = [], readBy = [], currentUserId, onClose }) {
  if (!msg) return null;

  const readBySet = new Set(readBy.map(String));

  // Seen by = members who have read AND are not the current user
  const seenByList = members.filter(m => {
    const id = String(m._id);
    return readBySet.has(id) && id !== String(currentUserId);
  }).sort((a, b) => (a.username || '').localeCompare(b.username || ''));

  // Delivered to = members who haven't read AND are not the current user
  const deliveredToList = members.filter(m => {
    const id = String(m._id);
    return !readBySet.has(id) && id !== String(currentUserId);
  }).sort((a, b) => (a.username || '').localeCompare(b.username || ''));

  const displayText = msg.text || msg.payload?.text || '🔒 Encrypted message';
  const sentAt = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '–';
  const sentDate = msg.createdAt
    ? new Date(msg.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  const Avatar = ({ user, size = 'sm', blue = false }) => {
    const char = (user.username || '?').charAt(0).toUpperCase();
    const sizeClass = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs';
    const colorClass = blue
      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400'
      : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400';
    return user.profilePicture ? (
      <img src={user.profilePicture} alt={user.username}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border ${colorClass}`} />
    ) : (
      <div className={`${sizeClass} rounded-full flex items-center justify-center border flex-shrink-0 font-bold ${colorClass}`}>
        {char}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Message Info</span>
          </div>
          <button onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* ── Message preview ── */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300 italic line-clamp-3 leading-snug">
            "{displayText}"
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><Clock size={11} /> {sentDate} at {sentAt}</span>
            <span className="flex items-center gap-1">
              <Lock size={11} className="text-blue-400" />
              {msg.isEncrypted ? 'End-to-end encrypted' : 'Encrypted in transit'}
            </span>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="max-h-[55vh] overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-800">

          {/* Reactions */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2.5">
                <Smile size={14} className="text-yellow-500" />
                Reactions ({msg.reactions.reduce((acc, r) => acc + (r.users?.length || 0), 0)})
              </div>
              <div className="space-y-2">
                {msg.reactions.map((reaction, idx) => {
                  const reactedNames = members
                    .filter(m => reaction.users?.some(uid => String(uid) === String(m._id)))
                    .map(u => u.username || 'Unknown');
                  return (
                    <div key={idx} className="flex items-center gap-2.5">
                      <span className="text-base">{reaction.emoji}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {reactedNames.join(', ') || `${reaction.users?.length || 0} members`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seen By */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2.5">
              <CheckCircle2 size={14} className="text-blue-500" />
              Seen by {seenByList.length}
            </div>
            {seenByList.length > 0 ? (
              <div className="space-y-2.5">
                {seenByList.map(user => (
                  <div key={user._id} className="flex items-center gap-2.5">
                    <Avatar user={user} blue />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user.username}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic pl-5">No one has read this yet.</p>
            )}
          </div>

          {/* Delivered To */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2.5 uppercase tracking-wider">
              Delivered to ({deliveredToList.length})
            </div>
            {deliveredToList.length > 0 ? (
              <div className="space-y-2.5">
                {deliveredToList.map(user => (
                  <div key={user._id} className="flex items-center gap-2.5 opacity-65">
                    <Avatar user={user} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {user.username}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic pl-5">All members have seen this.</p>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
