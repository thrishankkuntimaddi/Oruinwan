// src/components/messageComp/chatWindow/modals/contactInfoModal.jsx
import React from "react";

export default function ContactInfoModal({ chat, onClose }) {
  if (!chat) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white w-80 rounded shadow-lg p-4 relative">
        <h3 className="font-semibold text-lg mb-2">{chat.name}</h3>
        <p><strong>Phone:</strong> {chat.phone || "N/A"}</p>
        <p><strong>Email:</strong> {chat.email || "N/A"}</p>
        <p><strong>About:</strong> {chat.about || "N/A"}</p>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-red-500">✖</button>
      </div>
    </div>
  );
}
