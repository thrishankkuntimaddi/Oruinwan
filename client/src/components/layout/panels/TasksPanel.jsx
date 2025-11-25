import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "my-tasks"
                            ? "bg-blue-100 text-blue-700"
                            : "text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    📝 My Tasks
                </button>
                <button
                    onClick={() => handleNav("shared-tasks")}
                    className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "shared-tasks"
                            ? "bg-blue-100 text-blue-700"
                            : "text-gray-700 hover:bg-gray-200"
                        }`}
                >
                    👥 Shared Tasks
                </button>
            </div>
        </div>
    );
};

export default TasksPanel;
