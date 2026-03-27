// client/src/components/messagesComp/chatWindowComp/messages/TranslatePopover.jsx
// Language selection popover — rendered via a fixed portal so it escapes
// any scroll-container overflow clipping (same approach as ReactionPicker).

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';

const SUPPORTED_LANGS = [
    { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
    { code: 'fr', label: 'French',     flag: '🇫🇷' },
    { code: 'de', label: 'German',     flag: '🇩🇪' },
    { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
    { code: 'ar', label: 'Arabic',     flag: '🇸🇦' },
    { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
    { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
    { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
];

/**
 * TranslatePopover
 *
 * Props:
 *  pos          — { top|bottom, right } — fixed position from trigger rect
 *  status       — null | 'loading' | 'error'
 *  onSelect(langCode) — called when a language pill is clicked
 *  onClose()    — close without translating
 *  onRetry()    — retry after error
 */
export default function TranslatePopover({ pos, status, onSelect, onClose, onRetry }) {
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const popover = (
        <div
            ref={ref}
            className="fixed z-[9999] w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
            style={{ ...pos }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                    🌐 Translate to
                </span>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    aria-label="Close"
                >
                    <X size={12} />
                </button>
            </div>

            {/* Loading state */}
            {status === 'loading' && (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    <Loader2 size={13} className="animate-spin text-blue-500" />
                    Translating…
                </div>
            )}

            {/* Error state */}
            {status === 'error' && (
                <div className="px-3 py-3">
                    <p className="text-xs text-red-500 dark:text-red-400 mb-2">Translation failed.</p>
                    <button
                        onClick={onRetry}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Language grid */}
            {!status && (
                <div className="p-2 grid grid-cols-2 gap-1">
                    {SUPPORTED_LANGS.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => onSelect(lang.code)}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left font-medium"
                        >
                            <span className="text-sm leading-none">{lang.flag}</span>
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return createPortal(popover, document.body);
}
