// client/src/components/messagesComp/chatWindowComp/footer/MentionAutocomplete.jsx
//
// @ mention suggestion dropdown — displayed inside footerInput when the user
// types "@" followed by a partial username.
//
// Props:
//   suggestions      : Array<{ _id, username, profilePicture }>
//   selectedIndex    : number
//   onSelect         : (member) => void
//   onClose          : () => void

import React, { useEffect, useRef } from 'react';
import { AtSign } from 'lucide-react';

export default function MentionAutocomplete({ suggestions, selectedIndex, onSelect, onClose }) {
    const listRef = useRef(null);

    // Auto-scroll the selected item into view
    useEffect(() => {
        if (listRef.current) {
            const selected = listRef.current.children[selectedIndex];
            if (selected) {
                selected.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!suggestions || suggestions.length === 0) return null;

    return (
        <div
            className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
            onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
        >
            {/* Header */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-gray-700/60">
                <AtSign size={12} className="text-blue-500 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Mention a member
                </span>
            </div>

            {/* Suggestions list */}
            <ul
                ref={listRef}
                className="max-h-48 overflow-y-auto custom-scrollbar py-1"
                role="listbox"
            >
                {suggestions.map((member, idx) => (
                    <li
                        key={member._id}
                        role="option"
                        aria-selected={idx === selectedIndex}
                        onClick={() => onSelect(member)}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                            idx === selectedIndex
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                    >
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                            {member.profilePicture ? (
                                <img
                                    src={member.profilePicture}
                                    alt={member.username}
                                    className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-600"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {member.username?.charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {member.username}
                            </p>
                            {member.name && member.name !== member.username && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                    {member.name}
                                </p>
                            )}
                        </div>

                        {/* Keyboard hint */}
                        {idx === selectedIndex && (
                            <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                                ↵
                            </span>
                        )}
                    </li>
                ))}
            </ul>

            {/* Footer hint */}
            <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700/60 text-[10px] text-gray-400 dark:text-gray-500">
                ↑↓ navigate &nbsp;·&nbsp; Tab/Enter to select &nbsp;·&nbsp; Esc to close
            </div>
        </div>
    );
}
