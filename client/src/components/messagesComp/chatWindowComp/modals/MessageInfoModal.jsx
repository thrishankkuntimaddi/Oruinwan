import React from "react";
import { X, CheckCircle2, User, Clock } from "lucide-react";

export default function MessageInfoModal({ msg, onClose, currentUserId, workspaceMembers = [] }) {
  if (!msg) return null;

  const readBy = Array.isArray(msg.backend?.readBy) ? msg.backend.readBy : [];

  // Resolve "Seen by" names
  const seenByList = workspaceMembers
    .filter(m => readBy.includes(String(m.id)) && String(m.id) !== String(currentUserId))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Resolve "Delivered to" names (everyone else in the workspace who hasn't seen it)
  const deliveredToList = workspaceMembers
    .filter(m => !readBy.includes(String(m.id)) && String(m.id) !== String(currentUserId))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in text-gray-800">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose}></div>
      <div className="bg-white w-[320px] rounded-lg shadow-2xl overflow-hidden relative z-10 border border-gray-200">

        {/* Header */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Message Details</span>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Message Preview */}
        <div className="p-4 bg-white border-b border-gray-50">
          <div className="text-[13px] text-gray-600 italic line-clamp-3 leading-snug">
            "{msg.text}"
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-400">
            <Clock size={12} />
            Sent at {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* Status Body */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
          {/* Seen By Section */}
          <div className="p-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 mb-3">
              <CheckCircle2 size={14} className="text-blue-500" />
              Seen by {seenByList.length}
            </div>

            {seenByList.length > 0 ? (
              <div className="space-y-3 pl-1">
                {seenByList.map((user) => (
                  <div key={user.id} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center border border-blue-100/50">
                      <span className="text-[10px] font-bold text-blue-600">{(user.name || "?").charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-[12px] font-medium text-gray-700">{user.name || "Unknown"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-400 italic pl-6 py-1">No one has seen this yet.</div>
            )}
          </div>

          <div className="h-px bg-gray-50 mx-4 my-1"></div>

          {/* Delivered Section */}
          <div className="p-4 py-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Delivered to ({deliveredToList.length})</div>
            {deliveredToList.length > 0 ? (
              <div className="space-y-3 pl-1">
                {deliveredToList.map((user) => (
                  <div key={user.id} className="flex items-center gap-2.5 opacity-70">
                    <div className="w-6 h-6 rounded bg-gray-50 flex items-center justify-center border border-gray-200">
                      <span className="text-[10px] font-bold text-gray-400">{(user.name || "?").charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-[12px] text-gray-600">{user.name || "Unknown"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-gray-400 italic pl-6 py-1">All members have seen this.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 flex justify-center border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-2 text-[12px] font-bold text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-all shadow-sm active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
