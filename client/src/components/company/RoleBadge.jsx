import React from 'react';

const ROLE_STYLES = {
    owner: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        label: 'Owner'
    },
    admin: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: 'Admin'
    },
    manager: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: 'Manager'
    },
    employee: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        label: 'Employee'
    },
    member: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        label: 'Member'
    },
    external: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        label: 'External'
    }
};

const RoleBadge = ({ role, size = 'md', className = '' }) => {
    const roleKey = role?.toLowerCase() || 'member';
    const style = ROLE_STYLES[roleKey] || ROLE_STYLES.member;

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-1.5 text-base'
    };

    return (
        <span className={`${style.bg} ${style.text} ${sizeClasses[size]} rounded-full font-semibold ${className}`}>
            {style.label}
        </span>
    );
};

export default RoleBadge;
