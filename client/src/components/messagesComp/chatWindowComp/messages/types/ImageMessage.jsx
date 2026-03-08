/**
 * ImageMessage.jsx — Phase 7.1 Attachments
 * Renders an inline image with a click-to-expand lightbox.
 */
import React, { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";

export default function ImageMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { name, sizeFormatted } = attachment;
    const proxyUrl = toProxyUrl(attachment);
    const [lightbox, setLightbox] = useState(false);

    if (!proxyUrl) return null;

    return (
        <>
            {/* Thumbnail */}
            <div
                className="mt-1 cursor-zoom-in inline-block max-w-xs rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                onClick={() => setLightbox(true)}
            >
                <img
                    src={proxyUrl}
                    alt={name || "Image"}
                    className="max-w-full max-h-64 object-cover block"
                    loading="lazy"
                />
                {sizeFormatted && (
                    <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <span className="truncate max-w-[180px]">{name}</span>
                        <span className="ml-2 flex-shrink-0">{sizeFormatted}</span>
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setLightbox(false)}
                >
                    <div
                        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={proxyUrl}
                            alt={name}
                            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                        />
                        <div className="mt-3 flex items-center gap-3">
                            <span className="text-white/80 text-sm">{name}</span>
                            <a
                                href={proxyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-white/70 hover:text-white transition-colors"
                                title="Open in new tab"
                            >
                                <ExternalLink size={16} />
                            </a>
                        </div>
                        <button
                            onClick={() => setLightbox(false)}
                            className="absolute -top-4 -right-4 w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
