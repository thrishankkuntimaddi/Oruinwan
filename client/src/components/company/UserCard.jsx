import React from 'react';
import RoleBadge from './RoleBadge';
import { Avatar, Chip } from '../company-dash/dashUi';

/** Person row card with optional actions. */
const UserCard = ({ user, showDepartment = true, showEmail = true, actions = null, onClick }) => {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`gl-card cd-list-row${onClick ? ' gl-card--interactive' : ''}`}
            style={{ width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left' }}
        >
            <Avatar user={user} />
            <div className="cd-grow">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span className="cd-cell-title">{user.username || 'Unknown'}</span>
                    {user.companyRole && <RoleBadge role={user.companyRole} />}
                </div>
                {showEmail && user.email && <div className="cd-cell-sub">{user.email}</div>}
                {showDepartment && user.departmentName && <div style={{ marginTop: 4 }}><Chip>{user.departmentName}</Chip></div>}
            </div>
            {actions && <div className="cd-head-actions">{actions}</div>}
        </Tag>
    );
};

export default UserCard;
