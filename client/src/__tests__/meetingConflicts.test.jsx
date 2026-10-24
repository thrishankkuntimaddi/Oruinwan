// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'me' } }) }));

import api from '@services/api';
import { conflictLines, conflictSuggestions, clashMarker, scheduledToast, priorityLabel, normalizePriority } from '../utils/meetingConflicts';
import ConflictWarning from '../components/meetingsComp/ConflictWarning';
import ScheduleMeetingModal from '../features/messaging/chatWindowComp/modals/ScheduleMeetingModal';

const future = (h, m = 0) => {
    const d = new Date(Date.now() + 2 * 86400e3);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
};

const clashResult = () => ({
    hasConflicts: true,
    conflictCount: 2,
    attendees: [
        { userId: 'asha', name: 'Asha', isOrganizer: false, conflicts: [{ meetingId: 'm1', title: 'Design review', busy: false, start: future(9), end: future(9, 30), priority: 'high' }] },
        { userId: 'me', name: 'Me', isOrganizer: true, conflicts: [{ meetingId: 'm2', title: null, busy: true, start: future(9), end: future(10), priority: 'urgent' }] },
        { userId: 'ben', name: 'Ben', isOrganizer: false, conflicts: [] },
    ],
    suggestions: [{ start: future(10), end: future(10, 30), allAvailable: true }, { start: future(11), end: future(11, 30), allAvailable: true }],
});

describe('meetingConflicts helpers', () => {
    it('writes one line per clash, organiser first, with the other meeting and its priority', () => {
        const lines = conflictLines(clashResult());
        expect(lines).toHaveLength(2);
        expect(lines[0].text).toMatch(/^You are busy .+ \(Busy · Urgent priority\)$/);
        expect(lines[1].text).toMatch(/^Asha is busy .+ \(Design review · High priority\)$/);
    });

    it('reads suggestions and drops past ones', () => {
        const res = clashResult();
        res.suggestions.push({ start: '2001-01-01T09:00:00Z', end: '2001-01-01T09:30:00Z' });
        expect(conflictSuggestions(res)).toHaveLength(2);
    });

    it('marks a meeting with the viewer\'s own clash by name, others as double-booked', () => {
        expect(clashMarker({ conflicts: [] })).toBeNull();
        expect(clashMarker({ conflicts: [{ mine: true, title: 'Standup', priority: 'high', start: future(9), end: future(9, 30) }] }).label).toBe('Clashes with Standup');
        expect(clashMarker({ conflicts: [{ mine: false, userIds: ['a', 'b'], priority: 'normal', start: future(9), end: future(9, 30) }] }).label).toBe('2 people double-booked');
        expect(scheduledToast({ conflicts: [] })).toEqual({ text: 'Meeting scheduled', tone: 'success' });
        expect(scheduledToast({ conflicts: [{ mine: false, userIds: ['a'] }] }).tone).toBe('warning');
        expect(priorityLabel('urgent')).toBe('Urgent');
        expect(normalizePriority('critical')).toBe('normal');
    });
});

describe('ConflictWarning', () => {
    it('shows who is busy and offers free times as chips', () => {
        const onPick = vi.fn();
        render(<ConflictWarning result={clashResult()} onPick={onPick} />);
        expect(screen.getByRole('alert')).toHaveTextContent('Asha is busy');
        expect(screen.getByRole('alert')).toHaveTextContent('Design review · High priority');
        const chips = screen.getByRole('group', { name: 'Free times' }).querySelectorAll('button');
        expect(chips).toHaveLength(2);
        fireEvent.click(chips[0]);
        expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ start: new Date(future(10)) }));
    });

    it('says everyone is free when nothing clashes', () => {
        render(<ConflictWarning result={{ hasConflicts: false, attendees: [], suggestions: [] }} />);
        expect(screen.getByTestId('conflict-free')).toHaveTextContent('Everyone is free then.');
    });
});

describe('ScheduleMeetingModal clash check', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockResolvedValue({ data: { members: [{ _id: 'asha', username: 'asha', profile: { name: 'Asha' } }] } });
    });

    const renderModal = (props = {}) => render(
        <MemoryRouter initialEntries={['/workspace/ws1/huddles']}>
            <Routes>
                <Route path="/workspace/:workspaceId/huddles" element={<ScheduleMeetingModal onClose={vi.fn()} {...props} />} />
            </Routes>
        </MemoryRouter>,
    );

    it('checks the picked time, warns, and still lets you schedule anyway with a priority', async () => {
        api.post.mockResolvedValue({ data: clashResult() });
        const onSchedule = vi.fn().mockResolvedValue({});
        renderModal({ onSchedule });

        fireEvent.click(await screen.findByRole('button', { name: /Asha/ }));
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v2/meetings/conflicts', expect.objectContaining({ workspaceId: 'ws1', participants: ['asha'], duration: 30 })), { timeout: 2000 });
        expect(await screen.findByTestId('conflict-warning')).toHaveTextContent('Asha is busy');
        expect(screen.getByRole('button', { name: 'Schedule anyway' })).toBeTruthy();

        fireEvent.change(screen.getByTestId('meeting-priority'), { target: { value: 'high' } });
        fireEvent.change(screen.getByPlaceholderText('e.g. Weekly Sync'), { target: { value: 'Planning' } });
        fireEvent.click(screen.getByRole('button', { name: 'Schedule anyway' }));
        await waitFor(() => expect(onSchedule).toHaveBeenCalled());
        expect(onSchedule.mock.calls[0][0]).toMatchObject({ title: 'Planning', priority: 'high', participants: ['asha'] });
    });

    it('reschedules a meeting: excludes it from its own check and saves time and priority only', async () => {
        api.post.mockResolvedValue({ data: { hasConflicts: false, attendees: [], suggestions: [] } });
        const onSchedule = vi.fn().mockResolvedValue({});
        const meeting = { _id: 'mtg1', workspaceId: 'ws1', title: 'Sync', startTime: future(14), duration: 45, priority: 'urgent', invitees: ['asha'] };
        renderModal({ onSchedule, meeting });

        expect(screen.getByText('Reschedule Meeting')).toBeTruthy();
        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/v2/meetings/conflicts', expect.objectContaining({ excludeMeetingId: 'mtg1', participants: ['asha'], duration: 45 })), { timeout: 2000 });
        expect(await screen.findByTestId('conflict-free')).toBeTruthy();
        expect(screen.getByTestId('meeting-priority').value).toBe('urgent');
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
        await waitFor(() => expect(onSchedule).toHaveBeenCalled());
        expect(onSchedule.mock.calls[0][0]).toEqual({ title: 'Sync', startTime: future(14), duration: 45, priority: 'urgent' });
    });
});
