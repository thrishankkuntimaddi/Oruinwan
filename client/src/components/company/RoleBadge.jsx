import React from 'react';
import { Chip } from '../company-dash/dashUi';

const ROLES = {
    owner: { tone: 'accent', label: 'Owner' },
    admin: { tone: 'accent', label: 'Admin' },
    manager: { tone: 'success', label: 'Manager' },
    employee: { tone: undefined, label: 'Employee' },
    member: { tone: undefined, label: 'Member' },
    guest: { tone: 'warning', label: 'Guest' },
    external: { tone: 'warning', label: 'External' },
};

/** Company role as a token-styled chip. `size`/`className` kept for API compatibility. */
const RoleBadge = ({ role, className = '' }) => {
    const r = ROLES[String(role || 'member').toLowerCase()] || ROLES.member;
    return <span className={className}><Chip tone={r.tone}>{r.label}</Chip></span>;
};

export default RoleBadge;
