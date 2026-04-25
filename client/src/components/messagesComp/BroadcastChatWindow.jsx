import React from "react";
import { Users, Megaphone, Calendar, CheckCircle2 } from "lucide-react";

export default function BroadcastChatWindow({ broadcast }) {
    if (!broadcast) return null;

    return (
        <div className="flex flex-col h-full bg-white">
            {}
            <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                        <Megaphone size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900">{broadcast.name}</h2>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date().toLocaleDateString()} • {broadcast.recipients?.length || 0} recipients
                        </div>
                    </div>
                </div>
            </div>

            {}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
                <div className="max-w-3xl mx-auto space-y-8">

                    {}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-700">Broadcast Message</span>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
                                <CheckCircle2 size={12} /> Sent
                            </span>
                        </div>
                        <div className="p-6 text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
                            {broadcast.lastMessage}
                        </div>
                    </div>

                    {}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Users size={16} className="text-gray-500" />
                            Recipients ({broadcast.recipients?.length || 0})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {broadcast.recipients?.map((u, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                        {u.username?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                        {u.username}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
