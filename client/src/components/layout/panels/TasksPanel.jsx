import React from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

import { User, Inbox, Send, CheckCircle2, Trash2 } from "lucide-react";

const TasksPanel = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams();
    const activeTab = new URLSearchParams(location.search).get("tab") || "my-tasks";

    const handleNav = (tab) => {
        navigate(`/workspace/${workspaceId}/tasks?tab=${tab}`);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
            <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center px-5 font-bold text-xl text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 shrink-0">
                Tasks
            </div>

            <div className="p-4 space-y-2">
                <button
                    onClick={() => handleNav("my-tasks")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "my-tasks"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                        }`}
                >
                    <User size={18} /> Personal
                </button>
                <button
                    onClick={() => handleNav("shared-tasks")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "shared-tasks"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                        }`}
                >
                    <Inbox size={18} /> Incoming
                </button>
                <button
                    onClick={() => handleNav("assigned-tasks")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "assigned-tasks"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
                        }`}
                >
                    <Send size={18} /> Delegated
                </button>

                <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-800 space-y-2">
                    <button
                        onClick={() => handleNav("completed-tasks")}
                        className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "completed-tasks"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                    >
                        <CheckCircle2 size={18} /> Completed
                    </button>
                    <button
                        onClick={() => handleNav("deleted-tasks")}
                        className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-3 ${activeTab === "deleted-tasks"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
