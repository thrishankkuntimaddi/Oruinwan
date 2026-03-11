/**
 * attachMenu.jsx — Full Attachment Menu for both channels and DMs
 *
 * Items:
 *   📷 Photo        — image/* upload → onSendAttachment
 *   🎬 Video        — video/* upload → onSendAttachment
 *   📎 Document     — doc/pdf/etc upload → onSendAttachment
 *   🎵 Voice Note   — opens VoiceRecorder overlay (via onOpenVoiceRecorder)
 *   👤 Contact      — workspace member picker (via onAttach('contact'))
 *   📊 Poll         — create poll (via onCreatePoll) — channels AND DMs
 *   📅 Meeting      — schedule meeting (via onAttach('meeting'))
 *
 * ── Apps Section (mock, no API calls) ──
 *   🐙 GitHub Issue — opens CreateGitHubIssueModal
 *   🎫 Jira Ticket  — opens CreateJiraTicketModal
 *   📅 Schedule Meeting — existing meeting flow
 */
import React, { useRef, useState } from "react";
import { Image, FileText, User, BarChart2, Video, Loader2, Mic, Calendar } from "lucide-react";
import api from "../../../../services/api";
import CreateGitHubIssueModal from "../../../../components/apps/modals/CreateGitHubIssueModal";
import CreateJiraTicketModal from "../../../../components/apps/modals/CreateJiraTicketModal";

export default function AttachMenu({
  onAttach,
  onSendAttachment,
  onCreatePoll,
  onOpenVoiceRecorder,
  conversationId,
  conversationType = "channel",
  onClose,
  onInsertText,          // inserts text into chat input (for app actions)
}) {
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // App modal state (local only)
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [showJiraModal, setShowJiraModal] = useState(false);

  const uploadFile = async (file) => {
    if (!onSendAttachment) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationType", conversationType || "channel");
      if (conversationId) formData.append("conversationId", conversationId);
      const { data: attachment } = await api.post("/api/v2/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSendAttachment(attachment);
      onClose?.();
    } catch (err) {
      console.error("[AttachMenu] Upload failed:", err);
      setUploadError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoChange = (e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ""; };
  const handleVideoChange = (e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ""; };
  const handleFileChange = (e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ""; };

  const items = [
    { label: "Photo", icon: <Image size={16} />, color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400", action: () => photoInputRef.current?.click() },
    { label: "Video", icon: <Video size={16} />, color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", action: () => videoInputRef.current?.click() },
    { label: "Document", icon: <FileText size={16} />, color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", action: () => fileInputRef.current?.click() },
    { label: "Voice Note", icon: <Mic size={16} />, color: "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400", action: () => { onClose?.(); onOpenVoiceRecorder?.(); }, hide: !onOpenVoiceRecorder },
    { label: "Contact", icon: <User size={16} />, color: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400", action: () => { onAttach?.("contact"); onClose?.(); } },
    { label: "Poll", icon: <BarChart2 size={16} />, color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400", action: () => { onCreatePoll?.(); onClose?.(); }, hide: !onCreatePoll || conversationType === 'dm' },
    { label: "Meeting", icon: <Calendar size={16} />, color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400", action: () => { onAttach?.("meeting"); onClose?.(); } },
  ];

  const appItems = [
    { label: "GitHub Issue", emoji: "🐙", color: "bg-gray-100 dark:bg-gray-700", action: () => setShowGitHubModal(true) },
    { label: "Jira Ticket", emoji: "🎫", color: "bg-blue-50 dark:bg-blue-900/30", action: () => setShowJiraModal(true) },
    { label: "Schedule Meeting", emoji: "📅", color: "bg-teal-50 dark:bg-teal-900/30", action: () => { onAttach?.("meeting"); onClose?.(); } },
  ];

  return (
    <>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl p-3 z-50 w-[220px] animate-in fade-in slide-in-from-bottom-2 origin-bottom-right"
      >
        <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z,.ppt,.pptx" className="hidden" onChange={handleFileChange} />

        {uploading && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-gray-500 dark:text-gray-400">
            <Loader2 size={14} className="animate-spin text-blue-500" />
            Uploading…
          </div>
        )}
        {uploadError && <div className="px-2 py-1 text-xs text-red-500 text-center">{uploadError}</div>}

        {!uploading && (
          <>
            {/* Standard attachment items */}
            <div className="grid grid-cols-3 gap-1.5">
              {items.filter((item) => !item.hide).map((item) => (
                <button key={item.label} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors group" onClick={item.action}>
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>{item.icon}</div>
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 leading-tight text-center">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Apps divider */}
            <div className="mt-3 mb-2 flex items-center gap-2">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Apps</span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
            </div>

            {/* App action items */}
            <div className="grid grid-cols-3 gap-1.5">
              {appItems.map((item) => (
                <button key={item.label} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors group" onClick={item.action}>
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl transition-transform group-hover:scale-110 ${item.color}`}>{item.emoji}</div>
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 leading-tight text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* App modals — rendered at root level to avoid z-index conflicts */}
      {showGitHubModal && (
        <CreateGitHubIssueModal
          onClose={() => { setShowGitHubModal(false); onClose?.(); }}
          onInsertText={onInsertText}
        />
      )}
      {showJiraModal && (
        <CreateJiraTicketModal
          onClose={() => { setShowJiraModal(false); onClose?.(); }}
          onInsertText={onInsertText}
        />
      )}
    </>
  );
}
