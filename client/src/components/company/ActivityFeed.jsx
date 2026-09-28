import React from 'react';
import { Clock, User, FileText, MessageSquare, CheckSquare, Users } from 'lucide-react';
import { EmptyState, timeAgo } from '../company-dash/dashUi';

const ICONS = { user: User, note: FileText, message: MessageSquare, task: CheckSquare, team: Users };

/** activities = [{ id, type, userName, action, targetName, timestamp }] */
const ActivityFeed = ({ activities = [], emptyMessage = 'No recent activity' }) => {
    if (!activities.length) return <EmptyState icon={Clock} title={emptyMessage} />;
    return (
        <div className="cd-list" style={{ fontSize: 13 }}>
            {activities.map((a, i) => {
                const Icon = ICONS[a.type] || User;
                return (
                    <div className="cd-list-row" key={a.id || i} style={{ alignItems: 'flex-start' }}>
                        <span className="cd-kpi-icon" data-tone="muted"><Icon size={13} /></span>
                        <div className="cd-grow">
                            <div><strong>{a.userName}</strong> {a.action}{a.targetName && <strong> {a.targetName}</strong>}</div>
                            <div className="cd-cell-sub"><Clock size={11} style={{ verticalAlign: '-1px' }} /> {a.timestamp ? timeAgo(a.timestamp) : 'just now'}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ActivityFeed;
