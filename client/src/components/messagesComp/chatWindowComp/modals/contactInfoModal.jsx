import React from "react";
import { Mail, Phone, Info, X, MapPin, Calendar } from "lucide-react";

export default function ContactInfoModal({ chat, onClose }) {
  if (!chat) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-[380px] rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
        {/* Header with Cover & Avatar */}
        <div className="relative h-32 bg-gradient-to-r from-blue-500 to-indigo-600">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors backdrop-blur-md"
          >
            <X size={16} />
          </button>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <div className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-md overflow-hidden">
              {chat.image ? (
                <img src={chat.image} alt={chat.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-400">
                  {chat.name?.charAt(0)?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-12 pb-6 px-6 text-center">
          <h2 className="text-xl font-bold text-gray-900">{chat.name}</h2>
          <p className="text-sm text-green-600 font-medium mt-1 flex items-center justify-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Online
          </p>

          <div className="mt-6 space-y-4 text-left">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="p-2 bg-white rounded-lg shadow-sm text-blue-500">
                <Mail size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase">Email</div>
                <div className="text-sm font-medium text-gray-900">{chat.email || "No email provided"}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="p-2 bg-white rounded-lg shadow-sm text-green-500">
                <Phone size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase">Phone</div>
                <div className="text-sm font-medium text-gray-900">{chat.phone || "No phone number"}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="p-2 bg-white rounded-lg shadow-sm text-purple-500">
                <Info size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase">About</div>
                <div className="text-sm font-medium text-gray-900">{chat.about || "Hey there! I am using Chttrix."}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <MapPin size={12} /> San Francisco, CA
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={12} /> Joined Nov 2023
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
