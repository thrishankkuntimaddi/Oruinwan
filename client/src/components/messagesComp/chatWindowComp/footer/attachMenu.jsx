import React from "react";
import { Image, FileText, User } from "lucide-react";

export default function AttachMenu({ onAttach }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-white border border-gray-100 rounded-xl shadow-xl p-1.5 flex flex-col z-50 min-w-[180px] animate-fade-in origin-bottom-left"
    >
      <button
        className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
        onClick={() => onAttach("photo")}
      >
        <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
          <Image size={16} />
        </div>
        Photo / Video
      </button>
      <button
        className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
        onClick={() => onAttach("file")}
      >
        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
          <FileText size={16} />
        </div>
        Document
      </button>
      <button
        className="px-3 py-2.5 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-gray-700 transition-colors text-sm font-medium"
        onClick={() => onAttach("contact")}
      >
        <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
          <User size={16} />
        </div>
        Contact
      </button>
    </div>
  );
}
