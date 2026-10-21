// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const conversation = vi.fn();
vi.mock('../services/aiService', () => ({
    aiService: { conversation: (...a) => conversation(...a) },
    aiErrorMessage: (err, fb) => err?.response?.data?.message || fb,
}));
const summarize = vi.fn();
const extractActionItems = vi.fn();
vi.mock('../features/huddles/capture/captureApi', () => ({
    captureApi: { summarize: (...a) => summarize(...a), extractActionItems: (...a) => extractActionItems(...a) },
    errorText: (err, fb) => err?.message || fb,
}));
vi.mock('../contexts/SocketContext', () => ({ useOptionalSocket: () => null, useSocket: () => ({ socket: null }) }));
vi.mock('../contexts/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { AI_MAX_TEXT, assistantRequest, buildAiMessages, normaliseActionItems } from '../features/huddles/capture/meetingAi';
import { CAPTURE_MARKERS } from '../features/huddles/capture/captions';
import MeetingAssistant from '../features/huddles/capture/MeetingAssistant';
import { ConsentDialog } from '../features/huddles/capture/CaptureOverlay';
import { legacySegments } from '../features/meetings/tabs/TranscriptTab';

const at = (s) => new Date(Date.UTC(2026, 9, 21, 10, 0, s)).toISOString();
const seg = (speakerId, speakerName, text, s) => ({ speakerId, speakerName, text, startedAt: at(s) });

describe('meeting AI context', () => {
    it('merges consecutive lines of one speaker and leaves out consent markers', () => {
        const msgs = buildAiMessages([
            seg('u1', 'Ada', 'Hi all.', 0),
            seg('u1', 'Ada', 'Let us start.', 1),
            seg('u2', 'Bo', CAPTURE_MARKERS['captions:on'], 2),
            seg('u2', 'Bo', 'Sounds good.', 3),
        ], { myId: 'u2' });
        expect(msgs).toEqual([
            { sender: 'Ada', text: 'Hi all. Let us start.', isMe: false },
            { sender: 'Bo', text: 'Sounds good.', isMe: true },
        ]);
    });

    it('keeps the latest part of a long meeting within the API limits', () => {
        const many = Array.from({ length: 450 }, (_, i) => seg(`u${i % 2}`, i % 2 ? 'B' : 'A', `line ${i}`, i));
        const msgs = buildAiMessages(many);
        expect(msgs).toHaveLength(200);
        expect(msgs[199].text).toBe('line 449');
        const long = buildAiMessages([seg('u1', 'A', 'x'.repeat(3000), 0), seg('u1', 'A', 'y'.repeat(3000), 1)]);
        expect(long).toHaveLength(2);
        expect(long.every((m) => m.text.length <= AI_MAX_TEXT)).toBe(true);
    });

    it('builds the request, or nothing without a transcript', () => {
        expect(assistantRequest({ segments: [seg('u', 'A', CAPTURE_MARKERS['recording:on'], 0)], question: 'x' })).toBeNull();
        const body = assistantRequest({ workspaceId: 'w1', segments: [seg('u', 'A', 'We ship Friday', 0)], question: ' When? ', title: 'Planning' });
        expect(body).toMatchObject({ workspaceId: 'w1', mode: 'question', question: 'When?', title: 'Meeting: Planning' });
        expect(assistantRequest({ segments: [seg('u', 'A', 'x', 0)], mode: 'decisions' }).mode).toBe('decisions');
    });

    it('normalises action items and resolves assignees', () => {
        expect(normaliseActionItems(['Do it', { text: ' Send deck ', assigneeId: 'u1' }, { text: '' }], { u1: 'Ada' }))
            .toEqual([{ text: 'Do it', assignee: null, assigneeId: null }, { text: 'Send deck', assignee: 'Ada', assigneeId: 'u1' }]);
    });

    it('turns a pasted transcript into speaker lines', () => {
        const lines = legacySegments('[00:01] Ada: hello\nno speaker here\n\n', at(0));
        expect(lines.map((l) => [l.speakerName, l.text])).toEqual([['Ada', 'hello'], ['Transcript', 'no speaker here']]);
    });
});

describe('MeetingAssistant', () => {
    it('explains that it needs a transcript', () => {
        render(<MeetingAssistant segments={[]} target={null} />);
        expect(screen.getByTestId('assistant-no-transcript').textContent).toMatch(/live captions/);
    });

    it('answers a question from the transcript', async () => {
        conversation.mockResolvedValue({ text: 'Friday.' });
        render(<MeetingAssistant segments={[seg('u1', 'Ada', 'We ship on Friday', 0)]} workspaceId="w1" title="Sync" myId="u1" />);
        fireEvent.change(screen.getByLabelText('Ask the assistant'), { target: { value: 'When do we ship?' } });
        fireEvent.click(screen.getByLabelText('Ask'));
        await screen.findByText('Friday.');
        expect(conversation).toHaveBeenCalledWith(expect.objectContaining({
            workspaceId: 'w1', mode: 'question', question: 'When do we ship?',
            messages: [{ sender: 'Ada', text: 'We ship on Friday', isMe: true }],
        }));
    });

    it('shows an AI error', async () => {
        conversation.mockRejectedValue({ response: { data: { message: 'AI is off' } } });
        render(<MeetingAssistant segments={[seg('u1', 'Ada', 'x', 0)]} />);
        fireEvent.click(screen.getByText('Decisions made'));
        expect((await screen.findByRole('alert')).textContent).toBe('AI is off');
    });

    it('summarises a finished huddle with its action items', async () => {
        summarize.mockResolvedValue({ summary: 'We agreed to ship.', actionItems: [{ text: 'Write notes', assigneeId: 'u2' }], aiFallback: true });
        render(<MeetingAssistant ended segments={[]} target={{ kind: 'huddle', id: 'h1', base: '/x', query: '' }} names={{ u2: 'Bo' }} />);
        fireEvent.click(screen.getByTestId('assistant-wrapup'));
        await screen.findByText('We agreed to ship.');
        expect(screen.getByText('Write notes — Bo')).toBeTruthy();
        expect(screen.getByText(/plain excerpt/)).toBeTruthy();
        expect(extractActionItems).not.toHaveBeenCalled();
    });

    it('extracts action items for a meeting when the summary has none', async () => {
        summarize.mockResolvedValue({ summary: 'Done.' });
        extractActionItems.mockResolvedValue({ extracted: [{ text: 'Book room' }] });
        render(<MeetingAssistant ended segments={[]} target={{ kind: 'meeting', id: 'm1', base: '/m', query: '' }} />);
        fireEvent.click(screen.getByTestId('assistant-wrapup'));
        await screen.findByText('Book room');
        expect(extractActionItems).toHaveBeenCalledWith(expect.objectContaining({ kind: 'meeting' }), false);
    });
});

describe('ConsentDialog', () => {
    it('renders nothing when there is nothing to agree to', () => {
        const { container } = render(<ConsentDialog pending={[]} onAccept={() => {}} onLeave={() => {}} />);
        expect(container.innerHTML).toBe('');
    });

    it('names who records and lets me stay or leave', async () => {
        const onAccept = vi.fn();
        const onLeave = vi.fn();
        const pending = [{ userId: 'u2', name: 'Bo', kind: 'recording' }, { userId: 'u3', name: 'Cy', kind: 'captions' }];
        render(<ConsentDialog pending={pending} onAccept={onAccept} onLeave={onLeave} />);
        expect(screen.getByRole('alertdialog').textContent).toMatch(/This call is being recorded/);
        expect(screen.getByText('Bo').parentElement.textContent).toMatch(/recording the call audio/);
        expect(screen.getByText('Cy').parentElement.textContent).toMatch(/live captions/);
        fireEvent.click(screen.getByTestId('capture-consent-accept'));
        expect(onAccept).toHaveBeenCalledWith(pending);
        fireEvent.click(screen.getByTestId('capture-consent-leave'));
        await waitFor(() => expect(onLeave).toHaveBeenCalled());
    });
});
