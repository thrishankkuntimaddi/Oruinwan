import React from "react";

export default function PinnedMessage({ pinned, onUnpin }) {
  if (!pinned) return null;
  return (
    <div className="border-b bg-yellow-50 px-4 py-2 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-600">Pinned</div>
        <div className="font-medium text-sm">{pinned.text}</div>
      </div>
      <button onClick={onUnpin} className="text-sm text-gray-600 hover:text-red-500">Unpin</button>
    </div>
  );
}
