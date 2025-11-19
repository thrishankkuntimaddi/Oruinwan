// src/components/messageComp/chatWindow/toolbar/selectionToolbar.jsx
import React from "react";

export default function SelectionToolbar({ selectedCount, onCancel, onDelete }) {
  return (
    <div className="border-t p-2 bg-gray-50 flex items-center justify-between">
      <div className="text-sm text-gray-600">{selectedCount} selected</div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-1 rounded hover:bg-gray-100">Cancel</button>
        <button onClick={onDelete} className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600">Delete</button>
      </div>
    </div>
  );
}
