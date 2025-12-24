import React from "react";
import { Mail, Phone, Info, X, MapPin, Calendar } from "lucide-react";

export default function ContactInfoModal({ chat, onClose }) {
  if (!chat) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/20" onClick={onClose}></div>
      <div className="bg-white w-[320px] rounded shadow-md overflow-hidden relative z-10 border border-gray-200">

        {/* Compact Header */}
        <div className="relative h-20 bg-gray-100 flex items-center justify-center border-b border-gray-100">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="w-16 h-16 rounded border-2 border-white bg-white shadow-sm overflow-hidden transform translate-y-4">
            {chat.image ? (
              <img src={chat.image} alt={chat.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-300">
                {chat.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Tight Content */}
        <div className="pt-8 pb-4 px-4 text-center">
          <h2 className="text-sm font-semibold text-gray-800">{chat.name}</h2>
          <p className="text-[10px] text-green-600 font-medium mt-0.5 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            Online
          </p>

          <div className="mt-4 space-y-2 text-left">
            <div className="flex items-center gap-2 p-2 rounded bg-gray-50/50 border border-gray-100">
              <Mail size={14} className="text-gray-400" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase leading-none">Email</div>
                <div className="text-xs text-gray-800 truncate">{chat.email || "N/A"}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded bg-gray-50/50 border border-gray-100">
              <Phone size={14} className="text-gray-400" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase leading-none">Phone</div>
                <div className="text-xs text-gray-800 truncate">{chat.phone || "N/A"}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded bg-gray-50/50 border border-gray-100">
              <Info size={14} className="text-gray-400" />
              <div className="min-w-0">
                <div className="text-[9px] font-bold text-gray-400 uppercase leading-none">About</div>
                <div className="text-xs text-gray-800 leading-tight">{chat.about || "Hey there!"}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-[9px] text-gray-400">
            <div className="flex items-center gap-1">
              <MapPin size={10} /> SF, CA
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={10} /> Joined Nov '23
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
