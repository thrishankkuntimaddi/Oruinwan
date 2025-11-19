// src/components/messageComp/chatWindow/footer/emojiPicker.jsx
import React from "react";

export default function EmojiPicker({ onPick }) {
  const EMOJIS = [
    "😀","😁","😂","🤣","😅","😊","😍","😘","😎","🤔","🤩","🙌",
    "👍","👎","👏","🙏","🔥","🎉","😢","😮","😴","🤯","🤝","💯"
  ];

  return (
    <div onClick={(e) => e.stopPropagation()} className="absolute bottom-12 right-0 bg-white border rounded shadow-md p-3 w-72 max-h-56 overflow-y-auto grid grid-cols-8 gap-2 z-40">
      {EMOJIS.map((em) => (
        <button key={em} onClick={() => onPick(em)} className="p-1 text-2xl rounded hover:bg-gray-100">{em}</button>
      ))}
    </div>
  );
}
