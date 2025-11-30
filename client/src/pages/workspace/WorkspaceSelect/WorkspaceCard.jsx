import React from 'react';

const WorkspaceCard = ({ workspace, onLaunch }) => {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
                <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl text-white shadow-sm"
                    style={{ backgroundColor: workspace.color }}
                >
                    {workspace.icon}
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
                    {workspace.members} members
                </span>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-1">{workspace.name}</h3>
            <p className="text-sm text-gray-500 mb-6">Last active just now</p>

            <button
                onClick={() => onLaunch(workspace)}
                className="w-full py-2.5 rounded-lg bg-gray-50 text-gray-900 font-medium border border-gray-200 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-all"
            >
                Launch Workspace
            </button>
        </div>
    );
};

export default WorkspaceCard;
