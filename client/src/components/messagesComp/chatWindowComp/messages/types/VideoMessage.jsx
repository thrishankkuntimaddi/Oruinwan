/**
 * VideoMessage.jsx — Phase 7.1 Attachments
 * Renders an HTML5 <video> player with controls.
 */
import React from "react";
import { ExternalLink } from "lucide-react";

export default function VideoMessage({ msg }) {
    const { url, name, sizeFormatted } = msg.attachment || {};

    if (!url) return null;

    return (
        <div className="mt-1 max-w-sm rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
            <video
                src={url}
                controls
                preload="metadata"
                className="w-full max-h-64 bg-black block"
            >
                Your browser does not support the video element.
            </video>
            <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="truncate max-w-[200px]">{name}</span>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {sizeFormatted && <span>{sizeFormatted}</span>}
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400"
                        title="Open in new tab"
                    >
                        <ExternalLink size={13} />
                    </a>
                </div>
            </div>
        </div>
    );
}
