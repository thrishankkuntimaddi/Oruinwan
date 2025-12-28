// client/src/components/company/ActivityFeed.jsx

import React from 'react';
import { Clock, User, FileText, MessageSquare, CheckSquare, Users } from 'lucide-react';

const ACTIVITY_ICONS = {
    user: User,
    note: FileText,
    message: MessageSquare,
    task: CheckSquare,
    team: Users
};

const ActivityItem = ({ activity }) => {
    const Icon = ACTIVITY_ICONS[activity.type] || User;
    const timeAgo = getTimeAgo(activity.timestamp);

    return (
        <div className="flex items-start gap-3 py-3">
            <div className="shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Icon className="w-4 h-4 text-gray-600" />
            </div>

            <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                    <span className="font-semibold">{activity.userName}</span>
                    {' '}{activity.action}
                    {activity.targetName && (
                        <span className="font-medium text-gray-700"> {activity.targetName}</span>
                    )}
                </p>
                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo}</span>
                </div>
            </div>
        </div>
    );
};

const ActivityFeed = ({ activities = [], emptyMessage = 'No recent activity' }) => {
    if (activities.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-100">
            {activities.map((activity, index) => (
                <ActivityItem key={activity.id || index} activity={activity} />
            ))}
        </div>
    );
};

// Helper function to calculate time ago
const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';

    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now - activityTime;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return activityTime.toLocaleDateString();
};

export default ActivityFeed;
