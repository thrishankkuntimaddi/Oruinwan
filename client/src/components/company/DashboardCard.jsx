import React from 'react';
import { Panel } from '../company-dash/dashUi';

/** Titled card (kept for existing callers) — a kit Panel. */
const DashboardCard = ({ title, children, icon, className = '', headerActions = null }) => (
    <Panel title={title} icon={icon} action={headerActions} className={className}>
        {children}
    </Panel>
);

export default DashboardCard;
