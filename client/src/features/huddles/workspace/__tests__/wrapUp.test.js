import { describe, it, expect } from 'vitest';
import { buildWrapUp, formatDuration, htmlToPlain, readNoteBlocks, notesAsText, newId } from '../wrapUp';

describe('huddle wrap-up helpers', () => {
    it('reads the huddle note blocks written by the server', () => {
        const content = JSON.stringify([
            { id: 'huddle-heading', type: 'heading', content: 'Discussion', meta: { level: 3 } },
            { id: 'p1', type: 'text', content: 'Ship &lt;v2&gt;<br>on Friday', meta: { author: 'alice' } },
            { id: 'huddle-actions', type: 'heading', content: 'Action items', meta: { huddleActionsHeading: true } },
            { id: 'huddle-actions-list', type: 'checklist', content: JSON.stringify([{ id: 1, text: 'Bob: write tests', done: false, taskId: null }]), meta: { huddleActions: true } },
        ]);
        const { paragraphs, actions } = readNoteBlocks(content);
        expect(paragraphs).toEqual([{ id: 'p1', text: 'Ship <v2>\non Friday', author: 'alice' }]);
        expect(actions).toEqual([{ id: '1', text: 'Bob: write tests', done: false, taskId: null }]);
        expect(notesAsText({ paragraphs, actions })).toBe('Ship <v2>\non Friday\n\nAction items:\n- [ ] Bob: write tests');
    });

    it('converts stored HTML back to text and tolerates legacy notes', () => {
        expect(htmlToPlain('<p>a &amp; b</p><p>c</p>')).toBe('a & b\nc');
        expect(readNoteBlocks('<p>old note</p>').paragraphs[0].text).toBe('old note');
        expect(readNoteBlocks('').paragraphs).toEqual([]);
    });

    it('formats durations', () => {
        expect(formatDuration(42)).toBe('42s');
        expect(formatDuration(75)).toBe('1m 15s');
        expect(formatDuration(600)).toBe('10m');
        expect(formatDuration(3900)).toBe('1h 5m');
    });

    it('builds the wrap-up message with people, actions, tasks and the notes link', () => {
        const text = buildWrapUp({
            title: '# design',
            durationSec: 1500,
            participants: ['alice', 'bob'],
            summary: '- Ship v2 on Friday',
            actions: [{ text: 'Bob: write tests', done: false, taskKey: 'ENG-7' }, { text: 'Book room', done: true }, { text: '  ' }],
            tasks: [{ title: 'Fix *login*', key: 'ENG-3', change: 'To do → In progress' }],
            notesUrl: 'https://app.test/workspace/w/notes/n1',
            notesTitle: 'Huddle notes — #design — Sep 28, 2026',
        });
        expect(text).toBe([
            '**Huddle wrap-up — # design**',
            'Duration 25m · With @alice, @bob',
            '',
            '- Ship v2 on Friday',
            '',
            '**Action items**',
            '- [ ] Bob: write tests (ENG-7)',
            '- [x] Book room',
            '',
            '**Tasks**',
            '- ENG-3 Fix \\*login\\* — To do → In progress',
            '',
            'Notes: [Huddle notes — #design — Sep 28, 2026](https://app.test/workspace/w/notes/n1)',
        ].join('\n'));
    });

    it('makes ids the server accepts', () => {
        const ids = new Set(Array.from({ length: 50 }, () => newId('a')));
        expect(ids.size).toBe(50);
        for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    });
});
