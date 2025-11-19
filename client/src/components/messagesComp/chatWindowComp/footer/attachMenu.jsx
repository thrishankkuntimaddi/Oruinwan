// src/components/messageComp/chatWindow/footer/attachMenu.jsx
import React from "react";

export default function AttachMenu({ onAttach }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="absolute bottom-12 left-0 bg-white border rounded shadow-md p-2 text-sm flex flex-col z-40">
      <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => onAttach("photo")}>Photo / Video</button>
      <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => onAttach("file")}>File</button>
      <button className="px-2 py-1 hover:bg-gray-50 rounded" onClick={() => onAttach("contact")}>Contact</button>
    </div>
  );
}
