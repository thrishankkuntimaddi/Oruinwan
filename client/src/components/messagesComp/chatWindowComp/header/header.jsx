// src/components/messageComp/chatWindow/header/header.jsx
import React from "react";

export default function Header({
  chat,
  onClose,
  showSearch,
  setShowSearch,
  searchQuery,
  setSearchQuery,
  showMenu,
  setShowMenu,
  setSelectMode,
  setShowContactInfo,
  setShowChannelManagement,
  muted,
  setMuted,
  blocked,
  setBlocked,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-[#f9fafb]">
      <div className="flex items-center gap-3 min-w-0">
        {chat.image ? (
          <img src={chat.image} alt={chat.name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
            {chat.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
        )}

        <div className="min-w-0">
          <div className="text-base font-medium truncate">{chat.name}</div>
          <div className="text-xs text-gray-500 truncate">{chat.status}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {chat.type === "dm" && (
          <>
            <button title="Voice Call" className="p-2 rounded hover:bg-gray-100">📞</button>
            <button title="Video Call" className="p-2 rounded hover:bg-gray-100">🎥</button>
          </>
        )}

        {chat.type === "channel" && (
          <>
            <button title="Meeting" className="p-2 rounded hover:bg-gray-100">🧑‍💻</button>
            <button title="Poll" className="p-2 rounded hover:bg-gray-100">📊</button>
          </>
        )}

        {/* Search */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSearch((s) => !s);
              setShowMenu(false);
            }}
            className="p-2 rounded hover:bg-gray-100"
            title="Search messages"
          >
            🔎
          </button>

          {showSearch && (
            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-72 bg-white border rounded shadow-md p-2 z-40">
              <input
                className="w-full px-3 py-2 border rounded text-sm"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">Press Esc to close</p>
            </div>
          )}
        </div>

        {/* Global menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((s) => !s);
            }}
            className="p-2 rounded hover:bg-gray-100"
            title="More"
          >
            ⋯
          </button>

          {showMenu && (
            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-md p-2 z-40 text-sm">
              {chat.type === "channel" && setShowChannelManagement && (
                <>
                  <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => { setShowChannelManagement(true); setShowMenu(false); }}>
                    Manage Channel
                  </button>
                  <div className="border-t my-1" />
                </>
              )}
              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => { setShowContactInfo(true); setShowMenu(false); }}>
                {chat.type === "channel" ? "Channel Info" : "Contact Info"}
              </button>
              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => { setSelectMode(true); setShowMenu(false); }}>
                Select Messages
              </button>
              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => setMuted((m) => !m)}>
                {muted ? "Unmute" : "Mute"}
              </button>
              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded" onClick={() => setBlocked((b) => !b)}>
                {blocked ? "Unblock" : "Block"}
              </button>
              <div className="border-t my-1" />
              <button className="w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-red-600" onClick={onClose}>
                Close
              </button>
            </div>
          )}
        </div>

        <button onClick={onClose} className="ml-2 text-sm text-blue-500 hover:underline">
          Close
        </button>
      </div>
    </div>
  );
}
