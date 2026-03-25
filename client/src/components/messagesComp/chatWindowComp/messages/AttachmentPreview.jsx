// Phase 2 — Unified Attachment Preview Component
// Renders image lightbox, PDF embed, video player, audio player in one component

import React, { useState } from "react";
import { FileText, Download, X, PlayCircle, Volume2 } from "lucide-react";

const BYTES_LABEL = (n) => {
    if (!n) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * @param {object} props
 * @param {object} props.attachment - { type, url, name, size, mimeType, duration, thumbnail }
 */
export default function AttachmentPreview({ attachment }) {
    const [lightboxOpen, setLightboxOpen] = useState(false);

    if (!attachment?.url) return null;

    const { type, url, name, size, mimeType, duration, thumbnail } = attachment;

    /* ── IMAGE ──────────────────────────────────────────────────────────── */
    if (type === "image") {
        return (
            <>
                <div
                    className="mt-1 cursor-zoom-in rounded-xl overflow-hidden max-w-xs border border-gray-100 bg-gray-50 hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxOpen(true)}
                >
                    <img
                        src={url}
                        alt={name || "Image"}
                        className="w-full h-auto max-h-64 object-cover"
                        loading="lazy"
                    />
                </div>
                {lightboxOpen && (
                    <div
                        className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
                        onClick={() => setLightboxOpen(false)}
                    >
                        <button
                            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
                            onClick={() => setLightboxOpen(false)}
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={url}
                            alt={name}
                            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        />
                        <a
                            href={url}
                            download={name}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm transition-colors"
                            onClick={e => e.stopPropagation()}
                        >
                            <Download size={15} /> Download
                        </a>
                    </div>
                )}
            </>
        );
    }

    /* ── VIDEO ──────────────────────────────────────────────────────────── */
    if (type === "video") {
        return (
            <div className="mt-1 max-w-xs rounded-xl overflow-hidden border border-gray-100 bg-black">
                <video
                    src={url}
                    poster={thumbnail}
                    controls
                    className="w-full h-auto max-h-64"
                    preload="metadata"
                />
                {name && (
                    <div className="px-3 py-2 flex items-center justify-between bg-gray-900">
                        <span className="text-xs text-gray-400 truncate max-w-[180px]">{name}</span>
                        <a href={url} download={name} className="text-gray-400 hover:text-white transition-colors">
                            <Download size={14} />
                        </a>
                    </div>
                )}
            </div>
        );
    }

    /* ── AUDIO ──────────────────────────────────────────────────────────── */
    if (type === "audio" || type === "voice") {
        return (
            <div className="mt-1 flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 max-w-xs">
                <Volume2 size={18} className="text-violet-500 flex-shrink-0" />
                <audio src={url} controls className="flex-1 h-8" style={{ maxWidth: 200 }} preload="metadata" />
                {duration && (
                    <span className="text-xs text-gray-400 font-mono">
                        {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
                    </span>
                )}
            </div>
        );
    }

    /* ── PDF embed ──────────────────────────────────────────────────────── */
    if (mimeType === "application/pdf" || name?.endsWith(".pdf")) {
        return (
            <div className="mt-1 rounded-xl overflow-hidden border border-gray-200 max-w-sm">
                <iframe
                    src={url}
                    title={name || "PDF"}
                    className="w-full"
                    height={360}
                    style={{ border: "none" }}
                />
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
                    <span className="text-xs text-gray-600 truncate max-w-[180px] font-medium">{name}</span>
                    <a href={url} download={name} className="text-violet-600 hover:text-violet-700 transition-colors">
                        <Download size={14} />
                    </a>
                </div>
            </div>
        );
    }

    /* ── GENERIC FILE ───────────────────────────────────────────────────── */
    return (
        <div className="mt-1 flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 max-w-xs hover:bg-gray-100 transition-colors group">
            <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText size={18} className="text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{name || "File"}</p>
                {size && <p className="text-xs text-gray-400">{BYTES_LABEL(size)}</p>}
            </div>
            <a
                href={url}
                download={name}
                className="text-gray-400 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
                title="Download"
            >
                <Download size={16} />
            </a>
        </div>
    );
}
