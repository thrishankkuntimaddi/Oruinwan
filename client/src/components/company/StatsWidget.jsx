import React from 'react';
import { Kpi } from '../company-dash/dashUi';

/**
 * Single stat (kept for existing callers) — a kit Kpi. `bgColor`/`iconColor`
 * are ignored now: colours come from the theme tokens.
 */
const StatsWidget = ({ icon, label, value, trend = null, trendLabel = '' }) => (
    <Kpi
        icon={icon}
        label={label}
        value={value}
        delta={trend !== null && trend !== undefined ? `${trend > 0 ? '+' : ''}${trend}%` : undefined}
        deltaTone={trend > 0 ? 'up' : trend < 0 ? 'down' : undefined}
        hint={trend !== null && trend !== undefined ? trendLabel : undefined}
    />
);

export default StatsWidget;
