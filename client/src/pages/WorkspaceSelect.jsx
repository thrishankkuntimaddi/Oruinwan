import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const WorkspaceSelect = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        window.location.replace("/login");
    };

    // Mock data for workspaces
    const workspaces = [
        { id: 1, name: "Acme Corp", members: 12, icon: "A", color: "bg-blue-600" },
        { id: 2, name: "Project Beta", members: 5, icon: "P", color: "bg-purple-600" },
        { id: 3, name: "Design Team", members: 8, icon: "D", color: "bg-pink-600" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative">
            {/* Logo */}
            <div className="absolute top-6 left-6 flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">💬</div>
                <span className="text-xl font-bold text-gray-900 tracking-tight">Chttrix</span>
            </div>

            {/* Sign Out Button */}
            <button
                onClick={handleLogout}
                className="absolute top-6 right-6 text-gray-500 hover:text-red-600 font-medium text-sm transition-colors flex items-center"
            >
                Sign Out <span className="ml-2">→</span>
            </button>

            <div className="w-full max-w-4xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to Chttrix</h1>
                    <p className="text-lg text-gray-600">Choose a workspace to launch.</p>
                </div>

                {/* Workspace Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {workspaces.map((ws) => (
                        <div
                            key={ws.id}
                            className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div
                                    className={`w-12 h-12 rounded-lg ${ws.color} flex items-center justify-center text-2xl text-white shadow-sm`}
                                >
                                    {ws.icon}
                                </div>
                                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
                                    {ws.members} members
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-1">{ws.name}</h3>
                            <p className="text-sm text-gray-500 mb-6">Last active just now</p>

                            <button
                                onClick={() => navigate("/")}
                                className="w-full py-2.5 rounded-lg bg-gray-50 text-gray-900 font-medium border border-gray-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-all"
                            >
                                Launch Workspace
                            </button>
                        </div>
                    ))}

                    {/* Create New Workspace Card */}
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            Create Workspace
                        </h3>
                        <p className="text-sm text-gray-500">Start a new team</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceSelect;
