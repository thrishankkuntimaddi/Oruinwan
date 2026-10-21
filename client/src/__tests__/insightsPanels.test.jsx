// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Recharts needs layout; render its containers as plain divs.
vi.mock('recharts', () => {
    const Box = ({ children }) => <div>{children}</div>;
    const Nil = () => null;
    return {
        ResponsiveContainer: Box, AreaChart: Box, ComposedChart: Box,
        Area: Nil, Bar: Nil, Line: Nil, XAxis: Nil, YAxis: Nil, CartesianGrid: Nil, Tooltip: Nil,
    };
});

import { ActiveMembersPanel, TeamDeliveryPanel, formatCycle } from '../pages/dashboards/InsightsPanels';

describe('formatCycle', () => {
    it('shows hours under two days, then days', () => {
        expect(formatCycle(null)).toBe('—');
        expect(formatCycle(5.25)).toBe('5.3h');
        expect(formatCycle(72)).toBe('3d');
    });
});

describe('ActiveMembersPanel', () => {
    const data = {
        daily: [{ date: '2026-10-20', active: 3 }, { date: '2026-10-21', active: 5 }],
        weekly: [{ weekStart: '2026-10-19', active: 6 }],
        summary: { avgDailyActive: 4, peakDailyActive: 5, daysWithData: 2 },
    };

    it('shows counts and a day/week switch', () => {
        render(<ActiveMembersPanel data={data} />);
        expect(screen.getByText('Average 4 a day')).toBeTruthy();
        expect(screen.getByText('Peak 5')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Per week' }));
        expect(screen.getByTestId('active-members-chart')).toBeTruthy();
    });

    it('falls back to the older trend before daily records exist', () => {
        render(<ActiveMembersPanel data={{ daily: [], weekly: [], summary: { daysWithData: 0 } }} fallbackTrend={[{ label: 'Week 1', value: 2 }]} />);
        expect(screen.queryByRole('tab', { name: 'Per week' })).toBeNull();
        expect(screen.getByTestId('active-members-chart')).toBeTruthy();
    });

    it('has an empty state', () => {
        render(<ActiveMembersPanel data={{ daily: [{ date: '2026-10-21', active: 0 }], weekly: [], summary: { daysWithData: 0 } }} />);
        expect(screen.getByText('No activity in this period')).toBeTruthy();
    });
});

describe('TeamDeliveryPanel', () => {
    const row = (name, extra) => ({
        teamId: name, name, memberCount: 2, completedPerWeek: [1, 2], overduePerWeek: [0, 1],
        completed: 3, avgCycleHours: 30, medianCycleHours: 24, open: 4, openOverdue: 1, ...extra,
    });

    it('lists teams with done, cycle time, open and overdue', () => {
        render(<TeamDeliveryPanel data={{
            weeks: ['2026-10-12', '2026-10-19'],
            teams: [row('Platform'), row('Design', { openOverdue: 0, avgCycleHours: null })],
            unassigned: { ...row('x'), completed: 0, open: 0 },
            total: row('total', { completed: 6, openOverdue: 1, avgCycleHours: 30 }),
        }} />);
        expect(screen.getByText('Platform')).toBeTruthy();
        expect(screen.getByText('Design')).toBeTruthy();
        expect(screen.queryByText('No team')).toBeNull();
        expect(screen.getByText('6 completed')).toBeTruthy();
        expect(screen.getByText('1 overdue now')).toBeTruthy();
        expect(screen.getAllByText('30h').length).toBeGreaterThan(0);
        expect(screen.getByRole('img', { name: 'Platform completed per week: 1, 2' })).toBeTruthy();
    });

    it('shows an empty state and errors', () => {
        const { unmount } = render(<TeamDeliveryPanel data={{ weeks: [], teams: [], total: { completed: 0, open: 0 } }} />);
        expect(screen.getByText(/No teams or tasks yet/)).toBeTruthy();
        unmount();
        render(<TeamDeliveryPanel error="boom" />);
        expect(screen.getByText('Could not load: boom')).toBeTruthy();
    });
});
