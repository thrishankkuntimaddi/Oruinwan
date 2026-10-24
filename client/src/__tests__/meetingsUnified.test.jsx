// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

const showToast = vi.fn();
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast }) }));
let fakeSocket = null;
vi.mock('../contexts/SocketContext', () => ({
    useOptionalSocket: () => (fakeSocket ? { socket: fakeSocket } : null),
    useSocket: () => ({ socket: fakeSocket }),
}));
vi.mock('../contexts/ContactsContext', () => ({ useContacts: () => ({ channels: [] }) }));
vi.mock('../hooks/useMessageActions', () => ({ useMessageActions: () => ({ sendMessage: vi.fn() }) }));
const list = vi.fn();
vi.mock('../features/meetings/meetingApi', () => ({ meetingApi: { list: (...a) => list(...a) }, default: {} }));

import {
    normaliseSummary, summaryText, normaliseActionItem, normaliseActionItems, meetingPhase, normaliseTab, huddlesTab,
    meetingConversation, conversationLabel, meetingPeople, meetingPath, meetingErrorKind, MEETING_TAB_IDS,
} from '../features/meetings/meetingModel';
import { SummaryBlock, ActionItems } from '../features/meetings/tabs/SummaryTab';
import AgendaTab from '../features/meetings/tabs/AgendaTab';
import OverviewTab from '../features/meetings/tabs/OverviewTab';
import { MeetingTabBar, meetingTabs } from '../features/meetings/MeetingTabs';
import MeetingState from '../features/meetings/MeetingStates';
import MeetingRecapListener, { recapNotice } from '../features/meetings/MeetingRecapListener';
import { HuddlesHome, MeetingRow } from '../features/meetings/HuddlesLists';
import { mergePage } from '../features/meetings/useMeetingList';
import { NOTIFICATION_TYPE_META } from '../features/notifications/notificationTypes';
import { strokeDrawColor, isInk } from '../lib/collab/whiteboardStrokes';

const base = {
    id: 'm1', _id: 'm1', kind: 'scheduled', title: 'Planning', status: 'scheduled', huddleId: 'meeting-m1',
    conversation: { kind: 'channel', id: 'c1', name: 'design' },
    createdBy: { _id: 'u1', username: 'alice' }, participants: [{ _id: 'u2', username: 'bob' }], attendees: [],
    agenda: [], actionItems: [], summary: null,
};

function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}</p>; }
const withRouter = (ui, path = '/workspace/w1/huddles') => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/workspace/:workspaceId/*" element={<>{ui}<Where /></>} /></Routes>
    </MemoryRouter>,
);

beforeEach(() => { showToast.mockReset(); list.mockReset(); fakeSocket = null; });

describe('meeting model', () => {
    it('reads the summary as an object, a legacy string or nothing', () => {
        expect(normaliseSummary({ text: 'We ship', source: 'ai', by: { _id: 'u1' } })).toMatchObject({ text: 'We ship', source: 'ai', by: 'u1' });
        expect(summaryText({ text: 'Obj' })).toBe('Obj');
        expect(summaryText('Plain string')).toBe('Plain string');
        expect(summaryText(null)).toBe('');
        expect(normaliseSummary('  ')).toBeNull();
        expect(summaryText({ text: 42 })).toBe('');
    });

    it('normalises action items from either shape', () => {
        expect(normaliseActionItem({ _id: 'a1', text: 'Do', assignedTo: { _id: 'u2', username: 'bob' }, status: 'done' }))
            .toMatchObject({ id: 'a1', assigneeId: 'u2', assigneeName: 'bob', done: true });
        expect(normaliseActionItem({ id: 'a2', text: 'X', assigneeId: null, done: false, taskId: 't1' })).toMatchObject({ id: 'a2', assigneeId: null, done: false, taskId: 't1' });
        expect(normaliseActionItems([null, { text: 'no id' }, { id: 'a3', text: 'ok' }]).map((a) => a.id)).toEqual(['a3']);
    });

    it('knows the phase, tabs and lists', () => {
        expect(['scheduled', 'live', 'completed', 'cancelled'].map((status) => meetingPhase({ status }))).toEqual(['upcoming', 'live', 'ended', 'cancelled']);
        expect(MEETING_TAB_IDS).toEqual(['overview', 'agenda', 'notes', 'transcript', 'summary', 'whiteboard', 'brainstorm']);
        expect(normaliseTab('actions')).toBe('summary');
        expect(normaliseTab('chat')).toBeNull();
        expect(normaliseTab('chat', { allowChat: true })).toBe('chat');
        expect([huddlesTab('history'), huddlesTab('scheduled'), huddlesTab(null)]).toEqual(['past', 'upcoming', 'live']);
        expect(meetingPath('w1', 'm1', 'summary')).toBe('/workspace/w1/meetings/m1?tab=summary');
        expect(meetingErrorKind({ response: { status: 403 } })).toBe('forbidden');
    });

    it('finds the conversation and the people', () => {
        expect(conversationLabel(meetingConversation(base))).toBe('# design');
        expect(meetingConversation({ dmSessionId: 'd1' })).toEqual({ kind: 'dm', id: 'd1', name: null });
        expect(conversationLabel(meetingConversation({}))).toBe('Workspace');
        expect(meetingPeople({ ...base, attendees: [{ userId: 'u3', username: 'cy' }, { userId: 'u2', username: 'bob' }] }).map((p) => p.name)).toEqual(['alice', 'bob', 'cy']);
    });

    it('pages without duplicates', () => {
        expect(mergePage([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]).map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('has a meeting_recap notification type', () => {
        expect(NOTIFICATION_TYPE_META.meeting_recap.label).toBe('Recap');
    });

    it('draws whiteboard ink in the theme text colour', () => {
        const theme = { ink: '#222', board: '#fff' };
        expect(isInk('#FFFFFF')).toBe(true);
        expect(isInk('#b8956a')).toBe(false);
        expect(strokeDrawColor({ color: '#FFFFFF' }, theme)).toBe('#222');
        expect(strokeDrawColor({ color: '#b8956a' }, theme)).toBe('#b8956a');
        expect(strokeDrawColor({ tool: 'eraser', color: '#000' }, theme)).toBe('#fff');
    });
});

describe('meeting tabs', () => {
    it('uses the same seven tabs everywhere, Chat last when asked', () => {
        expect(meetingTabs().map((t) => t.label)).toEqual(['Overview', 'Agenda', 'Notes', 'Transcript', 'Summary & actions', 'Whiteboard', 'Brainstorm']);
        expect(meetingTabs({ withChat: true }).map((t) => t.id).slice(-1)).toEqual(['chat']);
        const onChange = vi.fn();
        render(<MeetingTabBar active="notes" onChange={onChange} meeting={{ actionItems: [{ id: 'a', text: 'x', done: false }] }} />);
        expect(screen.getByTestId('meeting-tab-notes').getAttribute('aria-selected')).toBe('true');
        expect(screen.getByTestId('meeting-tab-summary').textContent).toContain('1');
        fireEvent.click(screen.getByTestId('meeting-tab-whiteboard'));
        expect(onChange).toHaveBeenCalledWith('whiteboard');
    });

    it('shows the summary text from the summary object, and generates one', async () => {
        const onSummarize = vi.fn().mockResolvedValue({ source: 'transcript' });
        const { rerender } = render(<SummaryBlock meeting={{ ...base, summary: { text: 'We agreed to ship Monday', source: 'ai', generatedAt: new Date().toISOString() } }} onSummarize={onSummarize} onSave={vi.fn()} />);
        expect(screen.getByTestId('meeting-summary-text').textContent).toBe('We agreed to ship Monday');
        expect(screen.getByText(/AI summary/)).toBeTruthy();
        fireEvent.click(screen.getByTestId('meeting-summarize'));
        await waitFor(() => expect(onSummarize).toHaveBeenCalled());
        rerender(<SummaryBlock meeting={{ ...base, summary: 'legacy text' }} onSummarize={onSummarize} onSave={vi.fn()} />);
        expect(screen.getByTestId('meeting-summary-text').textContent).toBe('legacy text');
        rerender(<SummaryBlock meeting={{ ...base, summary: null }} onSummarize={onSummarize} onSave={vi.fn()} />);
        expect(screen.queryByTestId('meeting-summary-text')).toBeNull();
    });

    it('edits the summary by hand', async () => {
        const onSave = vi.fn().mockResolvedValue({});
        render(<SummaryBlock meeting={{ ...base, summary: { text: 'Old' } }} onSummarize={vi.fn()} onSave={onSave} />);
        fireEvent.click(screen.getByText('Edit'));
        fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'New text' } });
        fireEvent.click(screen.getByText('Save summary'));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith('New text'));
    });

    it('manages the one action item list', async () => {
        const record = {
            addActionItem: vi.fn().mockResolvedValue({}), toggleActionItem: vi.fn().mockResolvedValue({}),
            convertActionItem: vi.fn().mockResolvedValue({ task: { _id: 't1' } }), deleteActionItem: vi.fn().mockResolvedValue({}),
            updateActionItem: vi.fn().mockResolvedValue({}), extractActionItems: vi.fn().mockResolvedValue({ added: 0 }),
        };
        const meeting = { ...base, actionItems: [{ id: 'a1', text: 'Write notes', done: false, assigneeId: null }] };
        withRouter(<ActionItems meeting={meeting} workspaceId="w1" record={record} />);
        fireEvent.change(screen.getByLabelText('New action item'), { target: { value: 'Send deck' } });
        fireEvent.click(screen.getByTestId('action-item-add'));
        await waitFor(() => expect(record.addActionItem).toHaveBeenCalledWith({ text: 'Send deck' }));
        fireEvent.click(screen.getByLabelText('Mark as done'));
        await waitFor(() => expect(record.toggleActionItem).toHaveBeenCalledWith('a1'));
        fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'u2' } });
        await waitFor(() => expect(record.updateActionItem).toHaveBeenCalledWith('a1', { assigneeId: 'u2' }));
        fireEvent.click(screen.getByTestId('action-item-convert'));
        await waitFor(() => expect(record.convertActionItem).toHaveBeenCalledWith('a1', {}));
        fireEvent.click(screen.getByLabelText('Delete action item'));
        await waitFor(() => expect(record.deleteActionItem).toHaveBeenCalledWith('a1'));
    });

    it('saves agenda items as soon as they are added, moved, edited or removed', async () => {
        const onSave = vi.fn().mockResolvedValue({});
        render(<AgendaTab meeting={base} onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('New agenda item'), { target: { value: 'Launch date' } });
        fireEvent.keyDown(screen.getByLabelText('New agenda item'), { key: 'Enter' });
        expect(screen.getAllByTestId('agenda-item')).toHaveLength(1);
        await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ title: 'Launch date', notes: '', order: 0 }]));
        fireEvent.change(screen.getByLabelText('New agenda item'), { target: { value: 'Budget' } });
        fireEvent.keyDown(screen.getByLabelText('New agenda item'), { key: 'Enter' });
        await waitFor(() => expect(onSave).toHaveBeenLastCalledWith([
            { title: 'Launch date', notes: '', order: 0 }, { title: 'Budget', notes: '', order: 1 },
        ]));
        fireEvent.click(screen.getAllByLabelText('Move up')[0]);
        await waitFor(() => expect(onSave.mock.lastCall[0].map((i) => i.title)).toEqual(['Budget', 'Launch date']));
        fireEvent.click(screen.getAllByLabelText('Edit item')[0]);
        fireEvent.change(screen.getByLabelText('Agenda item'), { target: { value: 'Budget review' } });
        expect(onSave).toHaveBeenCalledTimes(3); // typing doesn't save each letter
        fireEvent.keyDown(screen.getByLabelText('Agenda item'), { key: 'Enter' });
        await waitFor(() => expect(onSave.mock.lastCall[0][0].title).toBe('Budget review'));
        fireEvent.click(screen.getAllByLabelText('Remove item')[1]);
        await waitFor(() => expect(onSave.mock.lastCall[0].map((i) => i.title)).toEqual(['Budget review']));
        expect(screen.getByTestId('agenda-status').textContent).toContain('Saved');
    });

    it('overview offers Start / Join huddle and End for everyone', () => {
        const { unmount } = withRouter(<OverviewTab meeting={base} workspaceId="w1" onEnd={vi.fn()} />);
        expect(screen.getByTestId('meeting-join').textContent).toContain('Start huddle');
        expect(screen.queryByTestId('meeting-end')).toBeNull();
        fireEvent.click(screen.getByTestId('meeting-join'));
        expect(screen.getByTestId('where').textContent).toBe('/workspace/w1/huddles?meeting=m1');
        unmount();
        withRouter(<OverviewTab meeting={{ ...base, status: 'live', startedAt: new Date().toISOString() }} workspaceId="w1" onEnd={vi.fn()} />);
        expect(screen.getByTestId('meeting-join').textContent).toContain('Join huddle');
        expect(screen.getByTestId('meeting-end').textContent).toContain('End for everyone');
    });

    it('a finished quick huddle offers the recap, not a new call', () => {
        const onOpenTab = vi.fn();
        withRouter(<OverviewTab meeting={{ ...base, kind: 'huddle', status: 'completed', durationSec: 600 }} workspaceId="w1" onOpenTab={onOpenTab} />);
        expect(screen.queryByTestId('meeting-join')).toBeNull();
        fireEvent.click(screen.getByTestId('meeting-view-recap'));
        expect(onOpenTab).toHaveBeenCalledWith('summary');
    });

    it('says clearly when you have no access', () => {
        render(<MeetingState error={{ kind: 'forbidden', message: 'x' }} onBack={vi.fn()} />);
        expect(screen.getByTestId('meeting-no-access').textContent).toContain("You don't have access to this meeting");
    });
});

describe('Huddles lists', () => {
    it('past cards open the meeting page on the recap', () => {
        withRouter(<MeetingRow meeting={{ ...base, kind: 'huddle', status: 'completed', startedAt: '2026-10-20T10:00:00Z', durationSec: 300 }} workspaceId="w1" />);
        fireEvent.click(screen.getByTestId('past-meeting-row'));
        expect(screen.getByTestId('where').textContent).toBe('/workspace/w1/meetings/m1?tab=summary');
    });

    it('lists past meetings with paging and search', async () => {
        list.mockImplementation(({ before, q }) => Promise.resolve(before
            ? { meetings: [{ ...base, id: 'm2', _id: 'm2', title: 'Retro', status: 'completed' }], hasMore: false, nextBefore: null }
            : { meetings: [{ ...base, title: q ? `Found ${q}` : 'Planning', status: 'completed' }], hasMore: true, nextBefore: 'cursor-1' }));
        withRouter(<HuddlesHome onStart={vi.fn()} onStartVideo={vi.fn()} onSchedule={vi.fn()} />, '/workspace/w1/huddles?tab=past');
        expect(await screen.findByText('Planning')).toBeTruthy();
        expect(list).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'w1', status: 'past' }));
        fireEvent.click(screen.getByTestId('meetings-load-more'));
        expect(await screen.findByText('Retro')).toBeTruthy();
        expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ before: 'cursor-1' }));
        fireEvent.change(screen.getByLabelText('Search meetings'), { target: { value: 'plan' } });
        expect(await screen.findByText('Found plan')).toBeTruthy();
    });

    it('switches between Live now, Upcoming and Past', async () => {
        list.mockResolvedValue({ meetings: [], hasMore: false });
        withRouter(<HuddlesHome onStart={vi.fn()} onStartVideo={vi.fn()} onSchedule={vi.fn()} />);
        expect(screen.getByText('No live huddles')).toBeTruthy();
        fireEvent.click(screen.getByRole('tab', { name: 'Upcoming' }));
        expect(screen.getByTestId('where').textContent).toBe('/workspace/w1/huddles?tab=upcoming');
        expect(await screen.findByText('Nothing scheduled')).toBeTruthy();
    });
});

describe('recap notice', () => {
    it('builds "Meeting ended · View recap" unless that meeting is open', () => {
        expect(recapNotice({ meetingId: 'm1', title: 'Planning' }, { workspaceId: 'w1', pathname: '/workspace/w1/channel/c1' }))
            .toEqual({ key: 'meeting-recap:m1', title: 'Planning', message: 'Meeting ended · View recap', href: '/workspace/w1/meetings/m1?tab=summary' });
        expect(recapNotice({ meetingId: 'm1' }, { workspaceId: 'w1', pathname: '/workspace/w1/meetings/m1' })).toBeNull();
        expect(recapNotice({}, { workspaceId: 'w1' })).toBeNull();
    });

    it('shows a toast on meeting:ended that opens the recap, once per meeting', () => {
        const handlers = {};
        fakeSocket = { on: (e, fn) => { handlers[e] = fn; }, off: vi.fn() };
        withRouter(<MeetingRecapListener workspaceId="w1" />, '/workspace/w1/channel/c1');
        act(() => { handlers['meeting:ended']({ meetingId: 'm1', title: 'Huddle in #design' }); });
        act(() => { handlers['meeting:ended']({ meetingId: 'm1', title: 'Huddle in #design' }); });
        expect(showToast).toHaveBeenCalledTimes(1);
        const [message, , , opts] = showToast.mock.calls[0];
        expect(message).toBe('Meeting ended · View recap');
        expect(opts).toMatchObject({ title: 'Huddle in #design', key: 'meeting-recap:m1' });
        act(() => opts.onClick());
        expect(screen.getByTestId('where').textContent).toBe('/workspace/w1/meetings/m1?tab=summary');
    });
});
