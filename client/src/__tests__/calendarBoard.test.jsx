// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarBoard from '../features/calendar/CalendarBoard';

const at = (h, m = 0, d = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
const EVENTS = [
    { id: 'm1', kind: 'meeting', title: 'Standup', at: at(10), end: at(10, 30), href: '/m1' },
    { id: 't1', kind: 'task', title: 'Ship it', at: at(9), allDay: true, href: '/t1' },
];

describe('calendar board', () => {
    it('shows a week with events on the hour grid and opens one', () => {
        localStorage.clear();
        const onOpen = vi.fn();
        render(<CalendarBoard events={EVENTS} onOpen={onOpen} onCreateMeeting={() => {}} />);
        expect(screen.getByTestId('calendar-week')).toBeTruthy();
        fireEvent.click(screen.getByText('Standup'));
        expect(screen.getByTestId('calendar-popover')).toHaveTextContent('Meeting');
        fireEvent.click(screen.getByRole('button', { name: /Open/ }));
        expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    });

    it('switches to month and schedule views, and hides a kind', () => {
        localStorage.clear();
        render(<CalendarBoard events={EVENTS} onOpen={() => {}} />);
        fireEvent.click(screen.getByTestId('calendar-view'));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /Month/ }));
        expect(screen.getByTestId('calendar-month')).toBeTruthy();
        fireEvent.click(screen.getByTestId('calendar-view'));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /Schedule/ }));
        expect(screen.getByTestId('calendar-agenda')).toHaveTextContent('Ship it');
        fireEvent.click(screen.getByTestId('calendar-kind-task'));
        expect(screen.queryByText('Ship it')).toBeNull();
    });

    it('clicking an empty time on the grid asks to schedule a meeting there', () => {
        localStorage.clear();
        const onCreateMeeting = vi.fn();
        render(<CalendarBoard events={[]} onCreateMeeting={onCreateMeeting} />);
        fireEvent.click(document.querySelector('.cal-col'), { clientY: 0 });
        expect(onCreateMeeting).toHaveBeenCalledWith(expect.any(Date));
    });
});
