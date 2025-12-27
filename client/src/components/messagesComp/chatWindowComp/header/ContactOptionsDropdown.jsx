import React, { useState, useRef, useEffect } from "react";
import { User, BellOff, Bell, Ban, Trash2, MoreVertical } from "lucide-react";

export default function ContactOptionsDropdown({ contact, onViewProfile, onMute, onBlock, onDelete, isMuted, isBlocked }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className={`p-2 rounded-lg transition-colors ${isOpen ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`} aria-label="Contact options">
                <MoreVertical size={20} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 animate-fade-in">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Contact Options</div>

                    <button onClick={() => { onViewProfile(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        <User size={18} className="text-gray-500" />
                        <span>View Profile</span>
                    </button>

                    <button onClick={() => { onMute(!isMuted); setIsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        {isMuted ? <><Bell size={18} className="text-gray-500" /><span>Unmute Notifications</span></> : <><BellOff size={18} className="text-gray-500" /><span>Mute Notifications</span></>}
                    </button>

                    <div className="my-1 border-t border-gray-100"></div>

                    <button onClick={() => { onBlock(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <Ban size={18} />
                        <span>{isBlocked ? "Unblock User" : "Block User"}</span>
                    </button>

                    <button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={18} />
                        <span>Delete Chat</span>
                    </button>
                </div>
            )}
        </div>
    );
}
