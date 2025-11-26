import React from "react";

export default function EmojiPicker({ onPick }) {
  const EMOJIS = [
    "😀", "😁", "😂", "🤣", "😅", "😊", "😍", "😘", "😎", "🤔", "🤩", "🙌",
    "👍", "👎", "👏", "🙏", "🔥", "🎉", "😢", "😮", "😴", "🤯", "🤝", "💯",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "❣️", "💕", "💞", "💓",
    "💪", "🧠", "👀", "👁️", "👄", "💋", "👅", "👃", "👂", "🦶", "🦵", "🖕",
    "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙"
  ];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-white border border-gray-100 rounded-2xl shadow-2xl w-80 flex flex-col z-50 animate-fade-in origin-bottom-right overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pick an emoji</h3>
      </div>

      <div className="p-2 grid grid-cols-8 gap-1 max-h-64 overflow-y-auto custom-scrollbar">
        {EMOJIS.map((em) => (
          <button
            key={em}
            onClick={() => onPick(em)}
            className="w-8 h-8 flex items-center justify-center text-xl rounded-lg hover:bg-gray-100 hover:scale-110 transition-all cursor-pointer"
          >
            {em}
          </button>
        ))}
      </div>
    </div>
  );
}
