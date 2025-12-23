import React from 'react';
import { Rocket, Briefcase, Zap, Palette, FlaskConical, Globe, ShieldCheck, TrendingUp, Lightbulb, Flame, Target, Trophy } from 'lucide-react';

const WorkspaceCard = ({ workspace, onLaunch }) => {
    // Map icon names to Lucide components
    const iconMap = {
        'rocket': Rocket,
        'briefcase': Briefcase,
        'zap': Zap,
        'palette': Palette,
        'microscope': FlaskConical,
        'globe': Globe,
        'shield': ShieldCheck,
        'trend': TrendingUp,
        'bulb': Lightbulb,
        'flame': Flame,
        'target': Target,
        'trophy': Trophy
    };

    const IconComponent = iconMap[workspace.icon?.toLowerCase()] || Rocket;

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
                <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: workspace.color || '#2563eb' }}
                >
                    <IconComponent size={24} className="text-white" />
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
