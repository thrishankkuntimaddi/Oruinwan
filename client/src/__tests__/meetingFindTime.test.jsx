// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@services/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../contexts/SocketContext', () => ({ useSocket: () => ({ socket: null }) }));

import { normalizeTimeSuggestions, suggestionNote, slotFit } from '../utils/meetingSlots';
import FindTimeSlots from '../components/meetingsComp/FindTimeSlots';

const NOW = Date.parse('2026-10-21T09:00:00Z');
const iso = (h, m = 0) => new Date(Date.UTC(2026, 9, 21, h, m)).toISOString();

describe('normalizeTimeSuggestions', () => {
    it('reads the current single-slot answer', () => {
        const slots = normalizeTimeSuggestions({ suggestedStart: iso(10), suggestedEnd: iso(10, 30), durationMinutes: 30, note: 'x' }, { now: NOW });
        expect(slots).toHaveLength(1);
        expect(slots[0].start.toISOString()).toBe(iso(10));
        expect(slots[0].end.toISOString()).toBe(iso(10, 30));
        expect(slots[0].score).toBeNull();
    });

    it('reads an array of scored slots, best first, dropping past and broken ones', () => {
        const slots = normalizeTimeSuggestions([
            { start: iso(11), end: iso(11, 30), score: 0.5 },
            { start: iso(8), end: iso(8, 30), score: 1 },        // past
            { start: 'not a date', end: iso(12) },               // unreadable
            { start: iso(13), end: iso(13, 30), score: 0.9 },
            { start: iso(13), end: iso(13, 30), score: 0.9 },    // duplicate
        ], { now: NOW });
        expect(slots.map(s => s.start.toISOString())).toEqual([iso(13), iso(11)]);
    });

    it('reads { slots: [...] } and fills a missing end from the duration', () => {
        const slots = normalizeTimeSuggestions({ slots: [{ start: iso(15) }] }, { durationMinutes: 45, now: NOW });
        expect(slots[0].end.toISOString()).toBe(iso(15, 45));
    });

    it('copes with nothing useful', () => {
        expect(normalizeTimeSuggestions(null)).toEqual([]);
        expect(normalizeTimeSuggestions({})).toEqual([]);
    });

    it('hides developer placeholder notes and labels scores', () => {
        expect(suggestionNote({ note: 'Next available slot (placeholder — integrate calendar API)' })).toBe('');
        expect(suggestionNote({ note: 'Based on 3 calendars' })).toBe('Based on 3 calendars');
        expect(slotFit(0.95)).toBe('Everyone free');
        expect(slotFit(70)).toBe('Most people free');
        expect(slotFit(null)).toBe('');
    });
});

describe('FindTimeSlots', () => {
    it('asks for the invited people and duration, then hands back the chosen slot', async () => {
        const start = new Date(Date.now() + 2 * 3600e3);
        const end = new Date(start.getTime() + 30 * 60e3);
        const suggest = vi.fn().mockResolvedValue([{ start: start.toISOString(), end: end.toISOString(), score: 0.9 }]);
        const onPick = vi.fn();
        render(<FindTimeSlots participantIds={['u1', 'u2']} durationMinutes={30} onPick={onPick} suggest={suggest} />);

        fireEvent.click(screen.getByRole('button', { name: /Find a time/ }));
        expect(suggest).toHaveBeenCalledWith(['u1', 'u2'], 30);
        const chip = await screen.findByRole('button', { name: /Everyone free/ });
        fireEvent.click(chip);
        expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ start, end }));
        expect(chip.getAttribute('aria-pressed')).toBe('true');
    });

    it('works with the current single-slot answer', async () => {
        const start = new Date(Date.now() + 3600e3);
        const suggest = vi.fn().mockResolvedValue({ suggestedStart: start.toISOString(), suggestedEnd: new Date(start.getTime() + 1800e3).toISOString(), note: 'placeholder' });
        render(<FindTimeSlots onPick={vi.fn()} suggest={suggest} />);
        fireEvent.click(screen.getByRole('button', { name: /Find a time/ }));
        await waitFor(() => expect(screen.getByRole('group', { name: 'Suggested times' }).children).toHaveLength(1));
        expect(screen.queryByText(/placeholder/)).toBeNull();
    });

    it('shows an error when the server fails', async () => {
        const suggest = vi.fn().mockRejectedValue({ response: { data: { message: 'Nope' } } });
        render(<FindTimeSlots onPick={vi.fn()} suggest={suggest} />);
        fireEvent.click(screen.getByRole('button', { name: /Find a time/ }));
        expect(await screen.findByRole('alert')).toHaveTextContent('Nope');
    });
});
