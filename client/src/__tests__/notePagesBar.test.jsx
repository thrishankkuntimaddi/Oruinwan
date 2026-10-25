// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';

const get = vi.fn(async () => ({ data: { note: { pages: [{ _id: 'n1', title: 'Spec' }, { _id: 'p2', title: 'Second' }] } } }));
const post = vi.fn(async () => ({ data: { note: { _id: 'p3' } } }));
vi.mock('@services/api', () => ({ default: { get: (...a) => get(...a), post: (...a) => post(...a) } }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const { default: NotePagesBar } = await import('../pages/SidebarComp/notesComponents/ui/NotePagesBar');
const { toCalendarEvents } = await import('../features/notifications/components/ActivityCalendar');

function Page() {
    const { id } = useParams();
    return <div><span data-testid="at">{id}</span><NotePagesBar noteId={id} workspaceId="w1" canEdit title={id === 'p2' ? 'Second' : 'Spec'} /></div>;
}

describe('note pages (web)', () => {
    it('lists the pages, opens one, and adds a page after the last', async () => {
        render(<MemoryRouter initialEntries={['/workspace/w1/notes/p2']}><Routes><Route path="/workspace/:ws/notes/:id" element={<Page />} /></Routes></MemoryRouter>);
        expect(await screen.findByRole('tab', { name: /1 · Spec/ })).toBeTruthy();
        expect(screen.getByRole('tab', { name: /2 · Second/ }).getAttribute('aria-selected')).toBe('true');
        fireEvent.click(screen.getByRole('tab', { name: /1 · Spec/ }));
        await waitFor(() => expect(screen.getByTestId('at').textContent).toBe('n1'));
        fireEvent.click(screen.getByTestId('note-add-page'));
        await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v2/notes', { workspaceId: 'w1', parentNoteId: 'n1' }));
        await waitFor(() => expect(screen.getByTestId('at').textContent).toBe('p3'));
    });

    it('puts note reminders on the calendar, linking to the note', () => {
        const events = toCalendarEvents({ workspaceId: 'w1', noteReminders: [{ id: 'r', noteId: 'n1', noteTitle: 'Spec', remindAt: '2026-10-28T09:00:00Z' }] });
        expect(events).toEqual([expect.objectContaining({ kind: 'reminder', title: 'Note: Spec', href: '/workspace/w1/notes/n1' })]);
    });
});
