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
 */
import React, { useRef, useState } from "react";
import { Image, FileText, User, BarChart2, Video, Loader2, Mic, Calendar } from "lucide-react";
import api from "../../../../services/api";

export default function AttachMenu({
  onAttach,
  onSendAttachment,
  onCreatePoll,
  onOpenVoiceRecorder,   // NEW: opens VoiceRecorder overlay
  conversationId,
  conversationType = "channel",
  onClose,               // called after picking an item to close the menu
}) {
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Upload a File object to GCS via the backend
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

      // attachment = { url, name, size, sizeFormatted, mimeType, type, gcsPath }
      onSendAttachment(attachment);
      onClose?.();
    } catch (err) {
      console.error("[AttachMenu] Upload failed:", err);
      setUploadError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const items = [
    {
      label: "Photo",
      icon: <Image size={16} />,
      color: "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
      action: () => photoInputRef.current?.click(),
    },
    {
      label: "Video",
      icon: <Video size={16} />,
      color: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      action: () => videoInputRef.current?.click(),
    },
    {
      label: "Document",
      icon: <FileText size={16} />,
      color: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
      action: () => fileInputRef.current?.click(),
    },
    {
      label: "Voice Note",
      icon: <Mic size={16} />,
      color: "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400",
      action: () => {
        onClose?.();
        onOpenVoiceRecorder?.();
      },
      hide: !onOpenVoiceRecorder,
    },
    {
      label: "Contact",
      icon: <User size={16} />,
      color: "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      action: () => { onAttach?.("contact"); onClose?.(); },
    },
    {
      label: "Poll",
      icon: <BarChart2 size={16} />,
      color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
      action: () => { onCreatePoll?.(); onClose?.(); },
      hide: !onCreatePoll,
    },
    {
      label: "Meeting",
      icon: <Calendar size={16} />,
      color: "bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
      action: () => { onAttach?.("meeting"); onClose?.(); },
    },
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl p-2 flex flex-col z-50 min-w-[190px] animate-in fade-in slide-in-from-bottom-2 origin-bottom-right"
    >
      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z,.ppt,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload spinner */}
      {uploading && (
        <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
          <Loader2 size={14} className="animate-spin text-blue-500" />
          Uploading…
        </div>
      )}

      {uploadError && (
        <div className="px-3 py-1.5 text-xs text-red-500">{uploadError}</div>
      )}

      {!uploading && (
        <>
          {items
            .filter((item) => !item.hide)
            .map((item) => (
              <button
                key={item.label}
                className="px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 rounded-xl flex items-center gap-3 text-gray-700 dark:text-gray-200 transition-colors text-sm font-medium group"
                onClick={item.action}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${item.color}`}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
              </button>
            ))}
        </>
      )}
    </div>
  );
}
