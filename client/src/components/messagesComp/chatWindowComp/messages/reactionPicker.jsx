import React from "react";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

export default function ReactionPicker({ onSelect, onClose }) {
    return (
        <div className="flex items-center gap-1 bg-white border border-gray-200 shadow-lg rounded-full p-1 animate-fade-in">
            {REACTIONS.map((emoji) => (
                <button
                    key={emoji}
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(emoji);
                    }}
                    className="p-1.5 hover:bg-gray-100 rounded-full text-lg transition-transform hover:scale-125"
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
}
