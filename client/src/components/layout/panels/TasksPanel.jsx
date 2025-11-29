import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { User, Inbox, Send, CheckCircle2, Trash2 } from "lucide-react";

const TasksPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const activeTab = new URLSearchParams(location.search).get("tab") || "my-tasks";

    const handleNav = (tab) => {
        navigate(`/tasks?tab=${tab}`);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="h-12 border-b border-gray-200 flex items-center px-4 font-bold text-gray-900">
                Tasks
            </div>

            <div className="p-4 space-y-2">
                <button
                    onClick={() => handleNav("my-tasks")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "my-tasks"
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    <User size={18} /> Personal
                </button>
                <button
                    onClick={() => handleNav("shared-tasks")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "shared-tasks"
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    <Inbox size={18} /> Incoming
                </button>
                <button
                    onClick={() => handleNav("assigned-tasks")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "assigned-tasks"
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    <Send size={18} /> Delegated
                </button>

                <div className="pt-4 mt-2 border-t border-gray-200 space-y-2">
                    <button
                        onClick={() => handleNav("completed-tasks")}
                        className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "completed-tasks"
                            ? "bg-green-100 text-green-700"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        <CheckCircle2 size={18} /> Completed
                    </button>
                    <button
                        onClick={() => handleNav("deleted-tasks")}
                        className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "deleted-tasks"
                            ? "bg-red-100 text-red-700"
                            : "text-gray-600 hover:bg-gray-100"
                            }`}
                    >
                        <Trash2 size={18} /> Deleted
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TasksPanel;
