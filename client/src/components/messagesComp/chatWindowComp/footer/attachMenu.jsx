/**
 * attachMenu.jsx — Phase 7.1 Attachments
 *
 * Renders the attach popover. "Photo / Video" and "Document" buttons open a
 * hidden <input type="file">, upload the file to /api/v2/uploads, then call
 * onSendAttachment with the returned metadata so the parent sends the message.
 *
 * Props:
 *   onAttach          (type: string) => void   — legacy fallback / contact pick
 *   onSendAttachment  (attachment: object) => void  — called after GCS upload success
 *   conversationId    string
 *   conversationType  'channel' | 'dm'
 */
import React, { useRef, useState } from "react";
import { Image, FileText, User, BarChart2, Video, Loader2 } from "lucide-react";
import api from "../../../../services/api";

export default function AttachMenu({ onAttach, onSendAttachment, onCreatePoll, conversationId, conversationType = "channel" }) {
  const photoInputRef = useRef(null);
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
    e.target.value = ""; // reset so same file can be picked again
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-white border border-gray-100 rounded-xl shadow-xl p-1.5 flex flex-col z-50 min-w-[180px] animate-fade-in origin-bottom-left"
    >
      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z,.ppt,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload spinner overlay */}
      {uploading && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500">
          <Loader2 size={14} className="animate-spin text-blue-500" />
          Uploading…
        </div>
      )}

      {uploadError && (
        <div className="px-3 py-1.5 text-xs text-red-500">{uploadError}</div>
      )}

      {!uploading && (
        <>
          <button
            className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
            onClick={() => photoInputRef.current?.click()}
          >
            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
              <Image size={16} />
            </div>
            Photo / Video
          </button>

          <button
            className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
            Document
          </button>

          <button
            className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
            onClick={() => onAttach?.("contact")}
          >
            <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <User size={16} />
            </div>
            Contact
          </button>

          {/* Phase 7.3 — Poll */}
          {onCreatePoll && (
            <button
              className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
              onClick={() => onCreatePoll()}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BarChart2 size={16} />
              </div>
              Poll
            </button>
          )}

          {/* Phase 7.6 — Schedule Meeting */}
          <button
            className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
            onClick={() => onAttach?.("meeting")}
          >
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <Video size={16} />
            </div>
            Meeting
          </button>
        </>
      )}
    </div>
  );
}
