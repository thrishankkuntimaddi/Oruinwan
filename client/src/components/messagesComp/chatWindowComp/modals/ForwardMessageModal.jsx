import React, { useState } from "react";
import { Search, X, User, Hash } from "lucide-react";
import { useContacts } from "../../../../contexts/ContactsContext";

export default function ForwardMessageModal({ onClose, onForward }) {
    const { allItems } = useContacts();
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);

    const filtered = allItems.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-96 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Forward message to...</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-3 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search people or channels"
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filtered.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setSelected(item)}
                            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${selected?.id === item.id ? "bg-blue-50 border border-blue-100" : "hover:bg-gray-50 border border-transparent"}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${item.type === 'channel' ? 'bg-gray-700' : 'bg-blue-500'}`}>
                                {item.type === 'channel' ? <Hash size={14} /> : <User size={14} />}
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                                <div className="text-xs text-gray-500 capitalize">{item.type}</div>
                            </div>
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            No results found
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={() => selected && onForward(selected)}
                        disabled={!selected}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Forward
                    </button>
                </div>

            </div>
        </div>
    );
}
