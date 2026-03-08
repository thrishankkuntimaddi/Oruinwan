/**
 * FileMessage.jsx — Phase 7.1 Attachments
 * Renders a clickable file card: icon + name + size + download button.
 *
 * Downloads route through the authenticated backend proxy
 * (GET /api/v2/uploads/file?path=<gcsPath>) so the GCS bucket can stay private.
 */
import React from "react";
import { FileText, Film, Archive, Sheet, File, Download } from "lucide-react";
import { toProxyUrl } from "../../../../../utils/gcsProxy";

const ICON_MAP = {
    pdf: { Icon: FileText, color: "text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400" },
    doc: { Icon: FileText, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
    docx: { Icon: FileText, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
    xls: { Icon: Sheet, color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" },
    xlsx: { Icon: Sheet, color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" },
    csv: { Icon: Sheet, color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" },
    zip: { Icon: Archive, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400" },
    rar: { Icon: Archive, color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400" },
    mp4: { Icon: Film, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" },
    mov: { Icon: Film, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" },
};

function getFileInfo(name = '') {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    return ICON_MAP[ext] || { Icon: File, color: "text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400" };
}

export default function FileMessage({ msg }) {
    const attachment = msg.attachment || {};
    const { name, sizeFormatted } = attachment;
    const proxyUrl = toProxyUrl(attachment);

    if (!proxyUrl) return null;

    const { Icon, color } = getFileInfo(name);

    return (
        <a
            href={proxyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors max-w-xs group"
        >
            {/* File type icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={20} />
            </div>

            {/* File details */}
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {name || "Attachment"}
                </div>
                {sizeFormatted && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {sizeFormatted}
                    </div>
                )}
            </div>

            {/* Download icon */}
            <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                <Download size={16} />
            </div>
        </a>
    );
}
