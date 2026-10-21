'use strict';

const t = require('../transcript');

const A = '64b0000000000000000000a1';
const B = '64b0000000000000000000b1';
const at = (sec) => new Date(Date.UTC(2026, 9, 19, 10, 0, sec)).toISOString();

describe('validateSegments', () => {
    test('accepts a list or a single segment and normalises it', () => {
        const { segments } = t.validateSegments({ segments: [{ speakerId: A, text: '  hi  ', startedAt: at(0), endedAt: at(2) }] }, { addedBy: B });
        expect(segments).toEqual([{ speakerId: A, speakerName: '', text: 'hi', startedAt: new Date(at(0)), endedAt: new Date(at(2)), addedBy: B }]);
        expect(t.validateSegments({ text: 'x', startedAt: at(0) }).segments[0].endedAt).toEqual(new Date(at(0)));
    });

    test.each([
        [{}, 'segments must be a non-empty array'],
        [{ segments: [] }, 'segments must be a non-empty array'],
        [{ segments: [{ text: '', startedAt: at(0) }] }, 'segments[0].text is required'],
        [{ segments: [{ text: 'x', startedAt: 'nope' }] }, 'segments[0].startedAt is invalid'],
        [{ segments: [{ text: 'x', startedAt: at(5), endedAt: at(1) }] }, 'segments[0].endedAt must be on or after startedAt'],
        [{ segments: [{ text: 'x', startedAt: at(0), speakerId: 'bob' }] }, 'segments[0].speakerId is invalid'],
        [{ segments: [{ text: 'x'.repeat(t.MAX_TEXT_LENGTH + 1), startedAt: at(0) }] }, `segments[0].text is longer than ${t.MAX_TEXT_LENGTH} characters`],
    ])('rejects %j', (body, error) => {
        expect(t.validateSegments(body)).toEqual({ error });
    });

    test('caps the batch size', () => {
        const segments = Array.from({ length: t.MAX_SEGMENTS_PER_REQUEST + 1 }, () => ({ text: 'x', startedAt: at(0) }));
        expect(t.validateSegments({ segments }).error).toMatch(/At most/);
    });
});

describe('renderTranscript', () => {
    test('sorted lines with offsets from the meeting start and resolved names', () => {
        const text = t.renderTranscript([
            { speakerId: B, speakerName: 'b-fallback', text: 'second', startedAt: at(75) },
            { speakerId: A, text: 'first', startedAt: at(5) },
            { speakerId: null, text: 'third', startedAt: at(3700) },
        ], { origin: at(0), names: new Map([[A, 'alice']]) });
        expect(text.split('\n')).toEqual(['[00:05] alice: first', '[01:15] b-fallback: second', '[1:01:40] Speaker: third']);
    });

    test('empty transcript renders as empty text', () => {
        expect(t.renderTranscript([])).toBe('');
    });
});

describe('extractActionItems', () => {
    test('finds commitments, requests and explicit action items', () => {
        const items = t.extractActionItems([
            { speakerId: A, text: "Thanks all. I'll send the deck to marketing by Friday.", startedAt: at(1) },
            { speakerId: B, text: 'Can you review the pricing page?', startedAt: at(2) },
            { speakerId: B, text: 'Action item: update the roadmap doc', startedAt: at(3) },
            { speakerId: A, text: 'We need to fix the login bug before release.', startedAt: at(4) },
            { speakerId: A, text: 'I think that is fine. The weather is nice.', startedAt: at(5) },
        ]);
        expect(items.map((i) => [i.text, i.assigneeId])).toEqual([
            ['Send the deck to marketing by Friday', A],
            ['Review the pricing page', null],
            ['Update the roadmap doc', null],
            ['Fix the login bug before release', null],
        ]);
    });

    test('drops duplicates and respects max', () => {
        const segs = [
            { speakerId: A, text: "I'll write the notes.", startedAt: at(1) },
            { speakerId: B, text: "I'll write the notes", startedAt: at(2) },
            { speakerId: B, text: 'TODO - ship it. Todo: test it', startedAt: at(3) },
        ];
        expect(t.extractActionItems(segs).map((i) => i.text)).toEqual(['Write the notes', 'Ship it', 'Test it']);
        expect(t.extractActionItems(segs, { max: 1 })).toHaveLength(1);
    });
});
