// src/components/messageComp/chatWindow/modals/contactShareModal.jsx
import React from "react";

export default function ContactShareModal({ contacts, onShare, onClose }) {
  const list = contacts.length ? contacts : [
    { name: "John Doe", phone: "999-111-222" },
    { name: "Sarah Lee", phone: "999-222-333" },
    { name: "Ethan Carter", phone: "999-333-444" },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white w-96 rounded shadow-lg p-4 relative max-h-[70vh] overflow-y-auto">
        <h4 className="font-semibold mb-2">Share Contact</h4>
        {list.map((c, i) => (
          <div key={i} className="p-2 flex items-center justify-between border rounded mb-2">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-gray-500">{c.phone}</div>
            </div>
            <button onClick={() => onShare(c)} className="px-3 py-1 bg-blue-600 text-white rounded">Share</button>
          </div>
        ))}
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-red-500">✖</button>
      </div>
    </div>
  );
}
