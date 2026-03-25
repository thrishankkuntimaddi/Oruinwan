// Phase 1 — Upgraded Reaction Picker
// Quick strip (6 common emojis) + full emoji-picker-react grid on "+" click

import React, { useState, useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function ReactionPicker({ onSelect, onClose }) {
    const [showFull, setShowFull] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                onClose?.();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
            {/* Quick strip */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 shadow-lg rounded-full px-2 py-1 animate-fade-in">
                {QUICK_REACTIONS.map((emoji) => (
                    <button
                        key={emoji}
                        onClick={() => { onSelect(emoji); onClose?.(); }}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-lg transition-transform hover:scale-125"
                    >
                        {emoji}
                    </button>
                ))}
                {/* Full picker toggle */}
                <button
                    onClick={() => setShowFull(s => !s)}
                    className="p-1.5 hover:bg-gray-100 rounded-full text-sm text-gray-500 transition-colors font-semibold"
                    title="More reactions"
                >
                    +
                </button>
            </div>

            {/* Full emoji picker — positioned above the strip */}
            {showFull && (
                <div className="absolute bottom-full mb-2 right-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
                    <EmojiPicker
                        onEmojiClick={(emojiData) => {
                            onSelect(emojiData.emoji);
                            onClose?.();
                        }}
                        height={380}
                        width={320}
                        searchDisabled={false}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                    />
                </div>
            )}
        </div>
    );
}
