/**
 * LinkPreviewMessage.jsx — Phase 7.5
 *
 * Renders an Open Graph / link preview card below message text.
 * Reads msg.linkPreview = { url, title, description, image, site }.
 *
 * Also used standalone in ChannelMessageItem / DMMessageItem:
 *   <LinkPreviewMessage preview={msg.linkPreview} />
 */
import React, { useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

export default function LinkPreviewMessage({ preview }) {
    const [imgError, setImgError] = useState(false);

    if (!preview?.url) return null;
    const { url, title, description, image, site } = preview;

    // Clean up site label
    let siteLabel = site || '';
    try {
        if (!siteLabel) siteLabel = new URL(url).hostname.replace(/^www\./, '');
    } catch { /* ignore */ }

    const hasImage = image && !imgError;

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 block max-w-sm group"
            onClick={e => e.stopPropagation()}
        >
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                {/* Image */}
                {hasImage && (
                    <div className="w-full h-36 bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                        <img
                            src={image}
                            alt={title || 'Link preview'}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                            onError={() => setImgError(true)}
                        />
                    </div>
                )}

                {/* Text body */}
                <div className="px-3 py-2.5">
                    {/* Site */}
                    <div className="flex items-center gap-1.5 mb-1">
                        <Globe size={11} className="text-gray-400 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">
                            {siteLabel}
                        </span>
                    </div>

                    {/* Title */}
                    {title && (
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {title}
                        </p>
                    )}

                    {/* Description */}
                    {description && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                            {description}
                        </p>
                    )}

                    {/* URL pill */}
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-500 dark:text-blue-400">
                        <ExternalLink size={10} />
                        <span className="truncate">{url}</span>
                    </div>
                </div>
            </div>
        </a>
    );
}
