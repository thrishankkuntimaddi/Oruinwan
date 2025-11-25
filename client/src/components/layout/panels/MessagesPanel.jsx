import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const MessagesPanel = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState("all"); // all, unread

    const contacts = [
        { id: 1, name: "Sarah Connor", status: "online", unread: 0 },
        { id: 2, name: "John Doe", status: "offline", unread: 0 },
        { id: 3, name: "Alice Smith", status: "online", unread: 2 },
        { id: 4, name: "Bob Wilson", status: "busy", unread: 0 },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 font-bold text-gray-900">
                <span>Direct Messages</span>
                <button className="text-gray-500 hover:bg-gray-200 p-1 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 flex space-x-2">
                <button
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filter === "all" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                >
                    All
                </button>
                <button
                    onClick={() => setFilter("unread")}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${filter === "unread" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
                >
                    Unread
                </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-2">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-4 mt-2">
                <div className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Friends</div>

                <div className="space-y-0.5">
                    {contacts.map((contact) => (
                        <div
                            key={contact.id}
                            onClick={() => navigate(`/messages/dm/${contact.id}`)}
                            className="px-4 py-2 mx-2 rounded-md cursor-pointer flex items-center justify-between hover:bg-gray-200 group transition-colors"
                        >
                            <div className="flex items-center">
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-3">
                                        {contact.name.charAt(0)}
                                    </div>
                                    <div className={`absolute bottom-0 right-3 w-2.5 h-2.5 rounded-full border-2 border-gray-50 ${contact.status === "online" ? "bg-green-500" :
                                            contact.status === "busy" ? "bg-red-500" : "bg-gray-400"
                                        }`}></div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-gray-900">{contact.name}</div>
                                    <div className="text-xs text-gray-500">You: Hey there!</div>
                                </div>
                            </div>

                            {contact.unread > 0 && (
                                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                                    {contact.unread}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MessagesPanel;
